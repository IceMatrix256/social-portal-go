import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";

/**
 * Imgur-style adapter — aggregates viral/meme images.
 * Uses Imgflip's public meme list API as a reliable source.
 */
export class ImgurAdapter implements FeedAdapter {
    name = "Imgur";
    description = "Viral images, memes, and community content";

    async fetchPosts(_topic?: string): Promise<UnifiedPost[]> {
        const jsonUrl = "https://api.imgflip.com/get_memes";

        try {
            const rawContent = await fetchProxyContent(jsonUrl);
            const data = JSON.parse(rawContent) as {
                success: boolean;
                data?: {
                    memes?: Array<{
                        id: string;
                        name: string;
                        url: string;
                    }>;
                };
            };

            const memes = data?.data?.memes;
            if (!Array.isArray(memes)) return [];

            return memes
                .slice(0, 40)
                .map((post, index) => {
                    return {
                        id: `img-${post.id}-${index}`,
                        source: 'imgur' as const,
                        author: {
                            name: "Imgflip",
                            handle: "imgflip/memes",
                            avatar: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${post.id}`,
                            url: "https://imgflip.com",
                        },
                        content: `<strong>${post.name}</strong>`,
                        media: [{
                            type: 'image' as const,
                            url: post.url,
                            previewUrl: post.url,
                        }],
                        url: `https://imgflip.com/meme/${post.id}`,
                        timestamp: Date.now() - (index * 60_000),
                        originalData: post,
                    };
                });
        } catch (e) {
            console.error("Imgur adapter error:", e);
            throw e;
        }
    }
}
