/**
 * Lightweight Nostr relay client for direct event queries.
 * Uses native WebSocket — no external library needed.
 * Queries specific event kinds with limits to avoid firehose exposure.
 */

// Top-scored relays from the user's relay directory
const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
    "wss://nostr.wine",
];

export const CURATED_RELAYS = [
    "wss://140.f7z.io",
];

export interface NostrEvent {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
}

export interface RelayFilter {
    kinds?: number[];
    limit?: number;
    since?: number;
    until?: number;
    authors?: string[];
    "#t"?: string[];
}

/**
 * Query a single relay for events matching a filter.
 * Returns within timeoutMs or when EOSE is received.
 */
function queryRelay(
    relayUrl: string,
    filter: RelayFilter,
    timeoutMs: number = 5000,
    retries: number = 1
): Promise<NostrEvent[]> {
    return new Promise((resolve) => {
        const events: NostrEvent[] = [];
        let resolved = false;

        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                try { ws.close(); } catch { }
                resolve(events);
            }
        };

        const timer = setTimeout(() => {
            if (!resolved) {
                console.warn(`[Nostr] Relay timeout: ${relayUrl}`);
                cleanup();
            }
        }, timeoutMs);

        let ws: WebSocket;
        try {
            ws = new WebSocket(relayUrl);
        } catch (e) {
            clearTimeout(timer);
            if (retries > 0) {
                console.log(`[Nostr] Connection failed to ${relayUrl}, retrying...`);
                resolve(queryRelay(relayUrl, filter, timeoutMs, retries - 1));
            } else {
                resolve([]);
            }
            return;
        }

        const subId = "sp_" + Math.random().toString(36).slice(2, 8);

        ws.onopen = () => {
            ws.send(JSON.stringify(["REQ", subId, filter]));
        };

        ws.onmessage = (msg) => {
            try {
                const data = JSON.parse(msg.data);
                if (data[0] === "EVENT" && data[1] === subId && data[2]) {
                    events.push(data[2] as NostrEvent);
                } else if (data[0] === "EOSE" && data[1] === subId) {
                    clearTimeout(timer);
                    cleanup();
                }
            } catch { }
        };

        ws.onerror = () => {
            if (!resolved && retries > 0) {
                console.log(`[Nostr] Error on ${relayUrl}, retrying...`);
                clearTimeout(timer);
                resolved = true; // prevent cleanup from resolving/closing this attempt
                try { ws.close(); } catch { }
                resolve(queryRelay(relayUrl, filter, timeoutMs, retries - 1));
            } else {
                // If retries exhausted or already resolved, just cleanup
                if (!resolved) cleanup();
            }
        };

        ws.onclose = () => {
            if (!resolved) cleanup();
        };
    });
}

/**
 * Query multiple relays in parallel, deduplicate results by event ID,
 * and return sorted by created_at (newest first).
 */
export async function queryRelays(
    filter: RelayFilter,
    relays: string[] = DEFAULT_RELAYS,
    timeoutMs: number = 5000,
): Promise<NostrEvent[]> {
    const results = await Promise.allSettled(
        relays.map((url) => queryRelay(url, filter, timeoutMs))
    );

    const seenIds = new Set<string>();
    const events: NostrEvent[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            for (const event of result.value) {
                if (!seenIds.has(event.id)) {
                    seenIds.add(event.id);
                    events.push(event);
                }
            }
        }
    }

    // Sort newest first
    events.sort((a, b) => b.created_at - a.created_at);
    return events;
}

// Nostr event kinds for media content
export const NOSTR_KIND = {
    SHORT_NOTE: 1,
    IMAGE: 20,        // kind:20 — Olas-style photos
    VIDEO: 34236,      // kind:34236 — DiVine-style videos
} as const;
