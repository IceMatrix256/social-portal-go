import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";

export class MastodonAdapter implements FeedAdapter {
    name = "Mastodon";
    description = "Open, federated social network";
    private instanceUrl: string;

    constructor(instanceUrl: string = "https://mastodon.social") {
        this.instanceUrl = instanceUrl;
    }

    async fetchPosts(topic?: string, _options?: { forceRefresh?: boolean, category?: 'text' | 'media' | 'all' }): Promise<UnifiedPost[]> {
        let endpoint: string;
        if (topic) {
            endpoint = `${this.instanceUrl}/api/v1/trends/statuses?limit=40`;
        } else {
            endpoint = `${this.instanceUrl}/api/v1/trends/statuses?limit=40`;
        }

        try {
            const rawContent = await fetchProxyContent(endpoint);
            const data = JSON.parse(rawContent);

            if (!Array.isArray(data)) {
                console.warn("Mastodon: unexpected response", data);
                return [];
            }

            const posts = data.map((toot: any) => ({
                id: toot.id,
                source: 'mastodon' as const,
                author: {
                    name: toot.account?.display_name || toot.account?.username || "Unknown",
                    handle: `@${toot.account?.acct || "unknown"}`,
                    avatar: toot.account?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${toot.id}`,
                    url: toot.account?.url || "",
                },
                content: toot.content || "",
                media: (toot.media_attachments || []).map((m: any) => ({
                    type: m.type === 'video' ? 'video' as const : 'image' as const,
                    url: m.url,
                    previewUrl: m.preview_url,
                })),
                url: toot.url || "",
                timestamp: new Date(toot.created_at).getTime(),
                originalData: toot,
            }));

            // Filter based on category
            // (Handled by useUnifiedFeed)

            return posts;
        } catch (e) {
            console.error("Mastodon fetch error:", e);
            throw e;
        }
    }
}
