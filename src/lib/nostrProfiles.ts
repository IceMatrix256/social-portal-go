/**
 * Nostr profile resolver — fetches kind:0 metadata events
 * to resolve pubkeys into display names, avatars, and NIP-05 handles.
 * Includes an in-memory cache to avoid redundant queries.
 */

import { queryRelays, type NostrEvent } from "./nostrRelay";

export interface NostrProfile {
    pubkey: string;
    name: string;
    displayName: string;
    nip05: string;
    picture: string;
    about: string;
}

// ── In-memory cache ────────────────────────────────────────────
const profileCache = new Map<string, NostrProfile>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Get a cached profile. Returns undefined if not cached.
 */
export function getCachedProfile(pubkey: string): NostrProfile | undefined {
    const ts = cacheTimestamps.get(pubkey);
    if (ts && Date.now() - ts > CACHE_TTL_MS) {
        profileCache.delete(pubkey);
        cacheTimestamps.delete(pubkey);
        return undefined;
    }
    return profileCache.get(pubkey);
}

/**
 * Parse a kind:0 metadata event into a NostrProfile.
 */
function parseMetadataEvent(event: NostrEvent): NostrProfile | null {
    try {
        const meta = JSON.parse(event.content);
        return {
            pubkey: event.pubkey,
            name: meta.name || "",
            displayName: meta.display_name || meta.displayName || meta.name || "",
            nip05: meta.nip05 || "",
            picture: meta.picture || meta.image || "",
            about: meta.about || "",
        };
    } catch {
        return null;
    }
}

/**
 * Batch-fetch profiles for a list of pubkeys.
 * Queries relays for kind:0 events, deduplicates, and picks
 * the most recent metadata event per pubkey.
 */
export async function fetchProfiles(pubkeys: string[]): Promise<Map<string, NostrProfile>> {
    const result = new Map<string, NostrProfile>();
    const toFetch: string[] = [];

    for (const pk of pubkeys) {
        const cached = getCachedProfile(pk);
        if (cached) {
            result.set(pk, cached);
        } else {
            toFetch.push(pk);
        }
    }

    if (toFetch.length === 0) return result;

    // Cap batch size — relay filters with too many authors may be rejected
    const batch = toFetch.slice(0, 50);

    try {
        console.log(`[NostrProfiles] Fetching ${batch.length} profiles from relays...`);
        const events = await queryRelays(
            { kinds: [0], authors: batch, limit: batch.length * 2 },
            undefined, // default relays
            2500,      // 2.5s timeout — prevent feed blocking
        );
        console.log(`[NostrProfiles] Got ${events.length} kind:0 events`);

        // Keep only the newest kind:0 per pubkey
        const newest = new Map<string, NostrEvent>();
        for (const ev of events) {
            const existing = newest.get(ev.pubkey);
            if (!existing || ev.created_at > existing.created_at) {
                newest.set(ev.pubkey, ev);
            }
        }

        for (const [pk, ev] of newest) {
            const profile = parseMetadataEvent(ev);
            if (profile) {
                profileCache.set(pk, profile);
                cacheTimestamps.set(pk, Date.now());
                result.set(pk, profile);
            }
        }
    } catch (e) {
        console.warn("[NostrProfiles] Batch fetch failed:", e);
    }

    return result;
}

/**
 * Convenience: get the best display string for a pubkey.
 * Returns NIP-05 handle if available, else display name, else truncated pubkey.
 */
export function profileDisplayName(profile: NostrProfile | undefined, pubkey: string): string {
    if (!profile) return pubkey.substring(0, 12);
    if (profile.nip05) return profile.nip05.replace(/^_@/, ""); // strip leading _@
    if (profile.displayName) return profile.displayName;
    if (profile.name) return profile.name;
    return pubkey.substring(0, 12);
}

/**
 * Convenience: get the best handle for a pubkey.
 */
export function profileHandle(profile: NostrProfile | undefined, pubkey: string): string {
    if (!profile) return pubkey.substring(0, 16);
    if (profile.nip05) return profile.nip05.replace(/^_@/, "");
    if (profile.name) return `@${profile.name}`;
    return pubkey.substring(0, 16);
}
