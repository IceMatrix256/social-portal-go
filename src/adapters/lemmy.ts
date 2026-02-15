import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";

/**
 * Lemmy adapter — aggregates content from federated communities.
 * Uses RSS feeds via proxy to avoid CORS/API complexity.
 */
export class LemmyAdapter implements FeedAdapter {
    name = "Lemmy";
    description = "Federated link aggregator & discussion platform";
    private instanceUrl: string;

    constructor(instanceUrl: string = "https://lemmy.world") {
        this.instanceUrl = instanceUrl;
    }

    async fetchPosts(topic?: string, options?: { forceRefresh?: boolean, category?: 'text' | 'media' | 'all' }): Promise<UnifiedPost[]> {
        let feedUrl = `${this.instanceUrl}/feeds/all.xml?sort=Hot`;
        if (topic) {
            feedUrl = `${this.instanceUrl}/feeds/c/${topic}.xml?sort=Hot`;
        }
        if (options?.forceRefresh) {
            feedUrl += `&_t=${Date.now()}`;
        }

        try {
            const rawContent = await fetchProxyContent(feedUrl);
            const parser = new DOMParser();
            const xml = parser.parseFromString(rawContent, "text/xml");

            const items = Array.from(xml.querySelectorAll("item"));
            const instanceHost = new URL(this.instanceUrl).hostname;

            const posts = items.slice(0, 40).map((item) => {
                const title = item.querySelector("title")?.textContent || "No Title";
                const link = item.querySelector("link")?.textContent || "";
                const pubDate = item.querySelector("pubDate")?.textContent || "";
                const description = item.querySelector("description")?.textContent || "";
                const guid = item.querySelector("guid")?.textContent || link;
                const rawCreator = item.querySelector("dc\\:creator")?.textContent
                    || item.getElementsByTagName("dc:creator")[0]?.textContent
                    || "Lemmy User";

                // dc:creator can be a URL like "https://pawb.social/u/tonytins" or just "tonytins"
                let author = rawCreator;
                let authorInstance = instanceHost;
                const creatorUrlMatch = rawCreator.match(/https?:\/\/([^/]+)\/u\/(.+)/);
                if (creatorUrlMatch) {
                    authorInstance = creatorUrlMatch[1];
                    author = creatorUrlMatch[2];
                }

                // Extract image if present in description
                const imgMatch = description.match(/src="([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i);
                const media: { type: 'image' | 'video'; url: string; previewUrl?: string }[] = [];
                if (imgMatch) {
                    media.push({
                        type: 'image',
                        url: imgMatch[1],
                        previewUrl: imgMatch[1],
                    });
                }

                // Extract video if present
                const vidMatch = description.match(/src="([^"]+\.(mp4|webm|mov))"/i);
                if (vidMatch) {
                    media.push({
                        type: 'video',
                        url: vidMatch[1],
                    });
                } else if (/\.(mp4|webm|mov|mkv)$/i.test(link)) {
                    media.push({
                        type: 'video',
                        url: link,
                    });
                }

                return {
                    id: `lemmy-${guid}`,
                    source: 'lemmy' as const,
                    author: {
                        name: author,
                        handle: `@${author}@${authorInstance}`,
                        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${author}`,
                        url: creatorUrlMatch ? rawCreator : `${this.instanceUrl}/u/${author}`,
                    },
                    content: (() => {
                        const cleanDesc = description
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim()
                            .substring(0, 280);
                        return `<strong>${title}</strong>${cleanDesc ? `<p class="mt-1 text-zinc-400">${cleanDesc}</p>` : ''}`;
                    })(),
                    media,
                    url: link,
                    timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
                    originalData: { title, link, description },
                };
            });

            // Filter based on category
            // (Handled by useUnifiedFeed)

            return posts;
        } catch (e) {
            console.error("Lemmy fetch error:", e);
            throw e;
        }
    }
}
