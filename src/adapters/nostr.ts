import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";
import { queryRelays, NOSTR_KIND, CURATED_RELAYS } from "../lib/nostrRelay";
import { fetchProfiles, profileDisplayName, profileHandle } from "../lib/nostrProfiles";

export class NostrAdapter implements FeedAdapter {
    name = "Nostr";
    description = "Decentralized, censorship-resistant social protocol";

    async fetchPosts(topic?: string): Promise<UnifiedPost[]> {
        // 0. Priority: Direct Relay (Global Feed)
        // If no topic (timeline), use the curated relay immediately to avoid API blocks/timeouts.
        if (!topic) {
            try {
                const results = await this.fetchFromRelays(topic);
                if (results.length > 0) return results;
            } catch (e) {
                console.warn("Nostr Relay priority failed, trying API fallback:", e);
            }
        }

        // 1. Try nostr.band trending/search API via proxy (Primary for Search)
        try {
            const results = await this.fetchFromNostrBand(topic);
            if (results.length > 0) return results;
        } catch (e) {
            console.warn("Nostr API failed, trying Relays (Fallback):", e);
        }

        // 2. Fallback: Direct Relay Query (if API failed or was skipped but returned empty)
        // Only run if we haven't already tried relays (i.e. if topic was present)
        if (topic) {
            try {
                const results = await this.fetchFromRelays(topic);
                if (results.length > 0) return results;
            } catch (e) {
                console.warn("Nostr Relay fallback failed, trying RSS:", e);
            }
        }



        // 3. Last Resort: RSS Feed
        try {
            return await this.fetchFromRSS();
        } catch (e) {
            console.error("All Nostr strategies failed:", e);
            return [];
        }
    }

    private async fetchFromNostrBand(topic?: string): Promise<UnifiedPost[]> {
        let apiUrl = "https://api.nostr.band/v0/trending/notes";
        if (topic) {
            apiUrl = `https://api.nostr.band/v0/search?q=${encodeURIComponent(topic)}&type=note&limit=40`;
        }

        const rawContent = await fetchProxyContent(apiUrl);
        const data = JSON.parse(rawContent);

        const notes = data.notes || [];

        return notes.slice(0, 40).map((note: any) => {
            const event = note.event || {};
            const profile = (() => {
                try {
                    return note.author?.profile
                        ? JSON.parse(note.author.profile.content || "{}")
                        : {};
                } catch { return {}; }
            })();
            const npub = note.author?.npub || event.pubkey?.substring(0, 12) || "nostr-user";

            return {
                id: event.id || String(Math.random()),
                source: 'nostr' as const,
                author: {
                    name: profile.display_name || profile.name || npub.substring(0, 10),
                    handle: npub.substring(0, 16),
                    avatar: profile.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${event.pubkey || npub}`,
                    url: `https://njump.me/${event.id || ""}`,
                },
                content: event.content || "",
                media: this.extractMedia(event.content || ""),
                url: `https://njump.me/${event.id || ""}`,
                timestamp: (event.created_at || 0) * 1000,
                originalData: event,
            };
        });
    }

    private async fetchFromRelays(topic?: string): Promise<UnifiedPost[]> {
        console.log("[Nostr] Querying relays for kind:1...");
        const filter: any = { kinds: [NOSTR_KIND.SHORT_NOTE], limit: 60 };

        if (topic) {
            // NIP-50 search is rare, fall back to hashtag filter
            filter["#t"] = [topic.toLowerCase().replace('#', '')];
        } else {
            // Global feed? Filter by time to get recent? queryRelays handles sort
            // Note: global kind 1 feed is very noisy.
        }

        const events = await queryRelays(filter, CURATED_RELAYS, 10000);

        // Resolve profiles
        const pubkeys = [...new Set(events.map(e => e.pubkey))];
        const profiles = await fetchProfiles(pubkeys);

        return events.map((event) => {
            const profile = profiles.get(event.pubkey);
            const media = this.extractMedia(event.content);

            return {
                id: event.id,
                source: 'nostr' as const,
                author: {
                    name: profileDisplayName(profile, event.pubkey),
                    handle: profileHandle(profile, event.pubkey),
                    avatar: profile?.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${event.pubkey}`,
                    url: `https://njump.me/${event.pubkey}`,
                },
                content: event.content,
                media,
                url: `https://njump.me/${event.id}`,
                timestamp: event.created_at * 1000,
                originalData: event,
            };
        });
    }

    private async fetchFromRSS(): Promise<UnifiedPost[]> {
        const feedUrl = "https://nostr.band/trending.rss";
        const rawContent = await fetchProxyContent(feedUrl);
        const parser = new DOMParser();
        const xml = parser.parseFromString(rawContent, "text/xml");

        const items = Array.from(xml.querySelectorAll("item"));

        return items.slice(0, 15).map((item) => {
            const title = item.querySelector("title")?.textContent || "";
            const link = item.querySelector("link")?.textContent || "";
            const pubDate = item.querySelector("pubDate")?.textContent || "";
            const description = item.querySelector("description")?.textContent || "";
            const guid = item.querySelector("guid")?.textContent || link;

            return {
                id: guid,
                source: 'nostr' as const,
                author: {
                    name: title.split(":")[0]?.trim() || "Nostr User",
                    handle: "nostr",
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${guid}`,
                    url: link,
                },
                content: description || title,
                media: this.extractMedia(description),
                url: link,
                timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
                originalData: { title, link, description },
            };
        });
    }

    private extractMedia(content: string): { type: 'image' | 'video'; url: string; previewUrl?: string }[] {
        const imgUrls = content.match(/https?:\/\/[^\s"<>]+\.(jpg|jpeg|png|gif|webp)/gi) || [];
        return imgUrls.slice(0, 4).map(url => ({
            type: 'image' as const,
            url,
            previewUrl: url,
        }));
    }
}
