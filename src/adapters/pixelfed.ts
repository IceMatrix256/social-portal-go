import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";

/**
 * Pixelfed-style adapter — aggregates open photography images.
 * Uses Picsum's public list API as a reliable photo source.
 */
export class PixelfedAdapter implements FeedAdapter {
    name = "Pixelfed";
    description = "Photography & visual art — curated from open photo sources";

    async fetchPosts(_topic?: string): Promise<UnifiedPost[]> {
        const jsonUrl = "https://picsum.photos/v2/list?page=2&limit=40";

        try {
            const rawContent = await fetchProxyContent(jsonUrl);
            const data = JSON.parse(rawContent) as Array<{
                id: string;
                author: string;
                url: string;
                download_url: string;
            }>;

            if (!Array.isArray(data)) return [];

            return data
                .slice(0, 40)
                .map((post, index) => {
                    const imageUrl = post.download_url;
                    return {
                        id: `pxf-${post.id}-${index}`,
                        source: 'pixelfed' as const,
                        author: {
                            name: post.author || "Photographer",
                            handle: `picsum/${post.id}`,
                            avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${post.author || post.id}`,
                            url: post.url || "https://picsum.photos",
                        },
                        content: `<strong>Photo by ${post.author || "Photographer"}</strong>`,
                        media: [{
                            type: 'image' as const,
                            url: imageUrl,
                            previewUrl: `https://picsum.photos/id/${post.id}/800/600`,
                        }],
                        url: post.url || imageUrl,
                        timestamp: Date.now() - (index * 60_000),
                        originalData: post,
                    };
                });
        } catch (e) {
            console.error("Pixelfed adapter error:", e);
            throw e;
        }
    }
}
