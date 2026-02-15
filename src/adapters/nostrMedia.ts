import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";
import { queryRelays, NOSTR_KIND, type NostrEvent } from "../lib/nostrRelay";
import { fetchProfiles, profileDisplayName, profileHandle } from "../lib/nostrProfiles";

/**
 * Helper: try multiple HTTP API endpoints in order, return first success.
 */
async function tryEndpoints(endpoints: string[]): Promise<string | null> {
    for (const url of endpoints) {
        try {
            const result = await fetchProxyContent(url);
            if (result && result.trim().length > 2) return result;
        } catch (e) {
            console.warn(`[NostrMedia] Endpoint failed: ${url}`, e);
        }
    }
    return null;
}

/**
 * Race: run strategies concurrently, resolve as soon as ANY returns data.
 * Unlike Promise.allSettled, this doesn't wait for all to finish.
 */
function raceStrategies(strategies: (() => Promise<UnifiedPost[]>)[]): Promise<UnifiedPost[]> {
    return new Promise((resolve) => {
        let resolved = false;
        let pending = strategies.length;

        for (const fn of strategies) {
            fn().then((posts) => {
                if (!resolved && posts.length > 0) {
                    resolved = true;
                    resolve(posts);
                }
            }).catch(() => { }).finally(() => {
                pending--;
                if (pending === 0 && !resolved) {
                    resolve([]);
                }
            });
        }
    });
}

// ── Shared helpers ──────────────────────────────────────────────

function parseProfile(note: any): Record<string, string> {
    try {
        return note.author?.profile
            ? JSON.parse(note.author.profile.content || "{}")
            : {};
    } catch { return {}; }
}

function extractImageUrls(event: NostrEvent | any): string[] {
    const urls: string[] = [];
    const content = event.content || "";

    const imgMatches = content.match(/https?:\/\/[^\s"<>]+\.(jpg|jpeg|png|gif|webp)/gi) || [];
    urls.push(...imgMatches);

    const tags: string[][] = event.tags || [];
    for (const tag of tags) {
        if (tag[0] === 'url' || tag[0] === 'image' || tag[0] === 'thumb') {
            if (tag[1] && /\.(jpg|jpeg|png|gif|webp)/i.test(tag[1])) {
                urls.push(tag[1]);
            }
        }
        if (tag[0] === 'imeta') {
            for (const entry of tag.slice(1)) {
                if (entry.startsWith('url ') && /\.(jpg|jpeg|png|gif|webp)/i.test(entry)) {
                    urls.push(entry.substring(4));
                }
            }
        }
    }

    return [...new Set(urls)];
}

function extractVideoUrls(event: NostrEvent | any): string[] {
    const urls: string[] = [];
    const content = event.content || "";

    // Match explicit video file extensions
    const vidMatches = content.match(/https?:\/\/[^\s"<>]+\.(mp4|webm|mov|m3u8|avi|mkv)/gi) || [];
    urls.push(...vidMatches);

    const tags: string[][] = event.tags || [];
    for (const tag of tags) {
        if (tag[0] === 'url' || tag[0] === 'video' || tag[0] === 'streaming') {
            if (tag[1] && tag[1].startsWith('http')) {
                urls.push(tag[1]);
            }
        }
        if (tag[0] === 'imeta') {
            for (const entry of tag.slice(1)) {
                if (entry.startsWith('url ')) {
                    const u = entry.substring(4);
                    if (/\.(mp4|webm|mov|m3u8|avi|mkv)/i.test(u) || u.includes('video')) {
                        urls.push(u);
                    }
                }
            }
        }
    }

    return [...new Set(urls)];
}

function stripMediaUrls(content: string): string {
    return content
        .replace(/https?:\/\/[^\s"<>]+\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|m3u8)/gi, '')
        .trim();
}

// ── Photos Adapter ──────────────────────────────────────────────

/**
 * Nostr Photos adapter — Olas-style curated photo feed.
 * Runs API and relay strategies CONCURRENTLY — first to return data wins.
 *   A) nostr.band trending images/notes (HTTP)
 *   B) Direct relay queries for kind:20 (WebSocket)
 */
export class NostrPhotosAdapter implements FeedAdapter {
    name = "Nostr Photos";
    description = "Trending photos from Nostr (Olas-style)";

    async fetchPosts(_topic?: string, options?: { category?: 'text' | 'media' | 'all' | 'all' }): Promise<UnifiedPost[]> {
        if (options?.category === 'text') return []; // Don't return photos in text tab

        return raceStrategies([
            () => this.fetchFromAPIs(),
            () => this.fetchFromRelays(),
        ]);
    }

    private async fetchFromAPIs(): Promise<UnifiedPost[]> {
        const rawContent = await tryEndpoints([
            "https://api.nostr.band/v0/trending/images",
            "https://api.nostr.band/v0/trending/notes",
        ]);
        if (!rawContent) return [];

        try {
            const data = JSON.parse(rawContent);
            const notes = data.notes || [];

            return notes
                .slice(0, 40)
                .map((note: any) => {
                    const event = note.event || {};
                    const profile = parseProfile(note);
                    const npub = note.author?.npub || event.pubkey?.substring(0, 12) || "nostr-user";
                    const imageUrls = extractImageUrls(event);
                    if (imageUrls.length === 0) return null;

                    return {
                        id: event.id || String(Math.random()),
                        source: 'nostr-photos' as const,
                        author: {
                            name: profile.display_name || profile.name || npub.substring(0, 10),
                            handle: npub.substring(0, 16),
                            avatar: profile.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${event.pubkey || npub}`,
                            url: `https://njump.me/${npub}`,
                        },
                        content: stripMediaUrls(event.content || ""),
                        media: imageUrls.slice(0, 4).map(url => ({
                            type: 'image' as const, url, previewUrl: url,
                        })),
                        url: `https://njump.me/${event.id || ""}`,
                        timestamp: (event.created_at || 0) * 1000,
                        originalData: event,
                    };
                })
                .filter(Boolean) as UnifiedPost[];
        } catch (e) {
            console.error("Nostr Photos API parse error:", e);
            return [];
        }
    }

    private async fetchFromRelays(): Promise<UnifiedPost[]> {
        try {
            console.log("[NostrPhotos] Querying relays for kind:20...");
            const events = await queryRelays(
                { kinds: [NOSTR_KIND.IMAGE], limit: 20 },
                undefined, 6000,
            );
            console.log(`[NostrPhotos] Got ${events.length} events from relays`);

            // Batch-fetch profiles for all unique pubkeys
            const pubkeys = [...new Set(events.map(e => e.pubkey))];
            const profiles = await fetchProfiles(pubkeys);
            console.log(`[NostrPhotos] Resolved ${profiles.size} profiles`);

            return events
                .slice(0, 40)
                .map((event) => {
                    const imageUrls = extractImageUrls(event);
                    if (imageUrls.length === 0) return null;

                    const profile = profiles.get(event.pubkey);
                    return {
                        id: event.id,
                        source: 'nostr-photos' as const,
                        author: {
                            name: profileDisplayName(profile, event.pubkey),
                            handle: profileHandle(profile, event.pubkey),
                            avatar: profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${event.pubkey}`,
                            url: `https://njump.me/${event.pubkey}`,
                        },
                        content: stripMediaUrls(event.content || ""),
                        media: imageUrls.slice(0, 4).map(url => ({
                            type: 'image' as const, url, previewUrl: url,
                        })),
                        url: `https://njump.me/${event.id}`,
                        timestamp: event.created_at * 1000,
                        originalData: event,
                    };
                })
                .filter(Boolean) as UnifiedPost[];
        } catch (e) {
            console.error("Nostr Photos relay error:", e);
            return [];
        }
    }
}

// ── Videos Adapter ──────────────────────────────────────────────

/**
 * Nostr Videos adapter — DiVine-style curated video feed.
 * Runs API and relay strategies CONCURRENTLY.
 *   A) nostr.band trending videos/notes (HTTP)
 *   B) Direct relay queries for kind:34236 (WebSocket)
 */
export class NostrVideosAdapter implements FeedAdapter {
    name = "Nostr Videos";
    description = "Trending videos from Nostr (DiVine-style)";

    async fetchPosts(_topic?: string, options?: { category?: 'text' | 'media' | 'all' | 'all' }): Promise<UnifiedPost[]> {
        if (options?.category === 'text') return []; // Don't return videos in text tab

        return raceStrategies([
            () => this.fetchFromAPIs(),
            () => this.fetchFromRelays(),
        ]);
    }

    private async fetchFromAPIs(): Promise<UnifiedPost[]> {
        const rawContent = await tryEndpoints([
            "https://api.nostr.band/v0/trending/videos",
            "https://api.nostr.band/v0/trending/notes",
        ]);
        if (!rawContent) return [];

        try {
            const data = JSON.parse(rawContent);
            const notes = data.notes || [];

            return notes
                .slice(0, 15)
                .map((note: any) => {
                    const event = note.event || {};
                    const profile = parseProfile(note);
                    const npub = note.author?.npub || event.pubkey?.substring(0, 12) || "nostr-user";
                    const videoUrls = extractVideoUrls(event);
                    const thumbUrls = extractImageUrls(event);

                    const media: UnifiedPost['media'] = [];
                    for (const url of videoUrls.slice(0, 2)) {
                        media.push({ type: 'video', url, previewUrl: thumbUrls[0] });
                    }
                    if (media.length === 0 && thumbUrls.length > 0) {
                        media.push({ type: 'image', url: thumbUrls[0], previewUrl: thumbUrls[0] });
                    }
                    // Fallback: use njump.me embed for events with no extractable media
                    if (media.length === 0 && event.id) {
                        media.push({ type: 'embed', url: `https://njump.me/${event.id}` });
                    }
                    if (media.length === 0) return null;

                    return {
                        id: event.id || String(Math.random()),
                        source: 'nostr-videos' as const,
                        author: {
                            name: profile.display_name || profile.name || npub.substring(0, 10),
                            handle: npub.substring(0, 16),
                            avatar: profile.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${event.pubkey || npub}`,
                            url: `https://njump.me/${npub}`,
                        },
                        content: event.content || "",
                        media,
                        url: `https://njump.me/${event.id || ""}`,
                        timestamp: (event.created_at || 0) * 1000,
                        originalData: event,
                    };
                })
                .filter(Boolean) as UnifiedPost[];
        } catch (e) {
            console.error("Nostr Videos API parse error:", e);
            return [];
        }
    }

    private async fetchFromRelays(): Promise<UnifiedPost[]> {
        try {
            console.log("[NostrVideos] Querying relays for kind:34236...");
            const events = await queryRelays(
                { kinds: [NOSTR_KIND.VIDEO], limit: 15 },
                undefined, 6000,
            );
            console.log(`[NostrVideos] Got ${events.length} events from relays`);

            // Batch-fetch profiles for all unique pubkeys
            const pubkeys = [...new Set(events.map(e => e.pubkey))];
            const profiles = await fetchProfiles(pubkeys);
            console.log(`[NostrVideos] Resolved ${profiles.size} profiles`);

            return events
                .slice(0, 15)
                .map((event) => {
                    const videoUrls = extractVideoUrls(event);
                    const thumbUrls = extractImageUrls(event);

                    const media: UnifiedPost['media'] = [];
                    for (const url of videoUrls.slice(0, 2)) {
                        media.push({ type: 'video', url, previewUrl: thumbUrls[0] });
                    }
                    if (media.length === 0 && thumbUrls.length > 0) {
                        media.push({ type: 'image', url: thumbUrls[0], previewUrl: thumbUrls[0] });
                    }
                    // Fallback: use njump.me embed for events with no extractable media
                    if (media.length === 0 && event.id) {
                        media.push({ type: 'embed', url: `https://njump.me/${event.id}` });
                    }
                    if (media.length === 0) return null;

                    const profile = profiles.get(event.pubkey);
                    return {
                        id: event.id,
                        source: 'nostr-videos' as const,
                        author: {
                            name: profileDisplayName(profile, event.pubkey),
                            handle: profileHandle(profile, event.pubkey),
                            avatar: profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${event.pubkey}`,
                            url: `https://njump.me/${event.pubkey}`,
                        },
                        content: event.content || "",
                        media,
                        url: `https://njump.me/${event.id}`,
                        timestamp: event.created_at * 1000,
                        originalData: event,
                    };
                })
                .filter(Boolean) as UnifiedPost[];
        } catch (e) {
            console.error("Nostr Videos relay error:", e);
            return [];
        }
    }
}
