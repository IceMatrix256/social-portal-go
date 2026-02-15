import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";

/**
 * Bluesky adapter — uses the public AT Protocol API.
 * Fetches the "What's Hot" algorithmic feed (no auth required).
 */
export class BlueskyAdapter implements FeedAdapter {
    name = "Bluesky";
    description = "Decentralized social network built on AT Protocol";

    async fetchPosts(_topic?: string, options?: { forceRefresh?: boolean, category?: 'text' | 'media' | 'all' }): Promise<UnifiedPost[]> {
        // Public Bluesky API — fetch discover/what's hot feed
        let endpoint = "https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot&limit=40";
        if (options?.forceRefresh) {
            endpoint += `&_t=${Date.now()}`;
        }

        try {
            const rawContent = await fetchProxyContent(endpoint);
            const data = JSON.parse(rawContent);
            const feed = data.feed;

            if (!feed || !Array.isArray(feed)) {
                return [];
            }

            const posts = feed.map((item: any) => {
                const post = item.post;
                const author = post.author;

                const media: UnifiedPost['media'] = [];
                if (post.embed) {
                    if (post.embed.$type === 'app.bsky.embed.images#view') {
                        post.embed.images.forEach((img: any) => {
                            media.push({ type: 'image', url: img.fullsize, previewUrl: img.thumb });
                        });
                    } else if (post.embed.$type === 'app.bsky.embed.video#view') {
                        media.push({
                            type: 'video',
                            url: post.embed.playlist,
                            previewUrl: post.embed.thumbnail,
                        });
                    } else if (post.embed.$type === 'app.bsky.embed.recordWithMedia#view') {
                        const inner = post.embed.media;
                        if (inner.$type === 'app.bsky.embed.video#view') {
                            media.push({
                                type: 'video',
                                url: inner.playlist,
                                previewUrl: inner.thumbnail,
                            });
                        } else if (inner.$type === 'app.bsky.embed.images#view') {
                            inner.images.forEach((img: any) => {
                                media.push({ type: 'image', url: img.fullsize, previewUrl: img.thumb });
                            });
                        }
                    }
                }

                return {
                    id: post.uri,
                    source: 'bluesky' as const,
                    author: {
                        name: author.displayName || author.handle,
                        handle: author.handle,
                        avatar: author.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${author.handle}`,
                        url: `https://bsky.app/profile/${author.handle}`,
                    },
                    content: post.record.text,
                    media,
                    url: `https://bsky.app/profile/${author.handle}/post/${post.uri.split('/').pop()}`,
                    timestamp: new Date(post.indexedAt).getTime(),
                    originalData: post,
                };
            });

            // Filter based on category
            let filteredPosts = posts.slice(0, 40); // Apply initial limit

            return filteredPosts;

        } catch (e) {
            console.error("Bluesky fetch error:", e);
            throw e;
        }
    }
}
