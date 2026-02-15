import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchWithInstanceFallback, INVIDIOUS_INSTANCES } from "../lib/instances";

export class InvidiousAdapter implements FeedAdapter {
    name = "YouTube";
    description = "Privacy-focused YouTube trending (via Invidious)";

    async fetchPosts(_topic?: string, options?: { forceRefresh?: boolean }): Promise<UnifiedPost[]> {
        // Invidious trending API
        const path = `/api/v1/trending`;

        try {
            const rawJson = await fetchWithInstanceFallback(path, INVIDIOUS_INSTANCES, {
                ...options,
                validate: (content: string) => content.trim().startsWith('[') || content.trim().startsWith('{')
            });
            const data = JSON.parse(rawJson);

            if (!Array.isArray(data)) {
                return [];
            }

            return data.map((video: any) => {
                const thumbnail = video.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url ||
                    video.videoThumbnails?.[0]?.url || "";

                return {
                    id: video.videoId,
                    source: 'youtube' as const,
                    author: {
                        name: video.author,
                        handle: video.author,
                        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${video.author}`,
                        url: `https://youtube.com/channel/${video.authorId}`,
                    },
                    content: `<strong>${video.title}</strong><p>${video.viewCountText} · ${video.publishedText}</p>`,
                    media: [{
                        type: 'video',
                        url: `https://www.youtube.com/watch?v=${video.videoId}`,
                        previewUrl: thumbnail,
                    }],
                    url: `https://www.youtube.com/watch?v=${video.videoId}`,
                    timestamp: video.published * 1000 || Date.now(),
                    originalData: video,
                };
            });
        } catch (e) {
            console.error("Invidious fetch error:", e);
            throw e;
        }
    }
}
