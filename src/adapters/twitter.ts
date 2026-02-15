import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchWithInstanceFallback, NITTER_INSTANCES } from "../lib/instances";

export class TwitterAdapter implements FeedAdapter {
    name = "Twitter";
    description = "Privacy-focused Twitter explorer (via Nitter)";
    private query: string;

    constructor(query: string = "trending") {
        this.query = query;
    }

    async fetchPosts(topic?: string, options?: { forceRefresh?: boolean, category?: 'text' | 'media' | 'all' }): Promise<UnifiedPost[]> {
        const q = topic || this.query;
        // Nitter RSS path
        const path = `/search/rss?q=${encodeURIComponent(q)}`;

        try {
            const rawXml = await fetchWithInstanceFallback(path, NITTER_INSTANCES, {
                ...options,
                headers: { 'User-Agent': 'SocialPortal/1.0' },
                validate: (content: string) => {
                    const hasRss = content.includes('<rss') || content.includes('<channel');
                    const isError = content.toLowerCase().includes('whitelisted') ||
                        content.includes('Verify your request') ||
                        content.includes('bot protection');
                    return hasRss && !isError;
                }
            });

            // Basic RSS parsing (we could use a library, but let's keep it lightweight)
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(rawXml, "text/xml");
            const items = Array.from(xmlDoc.querySelectorAll("item"));

            return items.map(item => {
                const title = item.querySelector("title")?.textContent || "";
                const description = item.querySelector("description")?.textContent || "";
                const link = item.querySelector("link")?.textContent || "";
                const pubDate = item.querySelector("pubDate")?.textContent || "";
                const creator = item.querySelector("dc\\:creator, creator")?.textContent || "twitter_user";
                const guid = item.querySelector("guid")?.textContent || link;

                // Extract media from description (Nitter puts image tags in description)
                const media: { type: 'image' | 'video'; url: string }[] = [];
                const imgMatches = description.match(/<img[^>]+src="([^">]+)"/g);
                if (imgMatches) {
                    imgMatches.forEach(img => {
                        const src = img.match(/src="([^">]+)"/)?.[1];
                        if (src) media.push({ type: 'image', url: src });
                    });
                }

                // Clean up content (strip HTML tags from description for content, or keep some)
                const cleanContent = description.replace(/<img[^>]*>/g, "").trim();

                return {
                    id: guid,
                    source: 'twitter' as const,
                    author: {
                        name: creator,
                        handle: `@${creator}`,
                        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${creator}`,
                        url: link.split('/status/')[0],
                    },
                    content: cleanContent || title,
                    media,
                    url: link,
                    timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
                    originalData: item,
                };
            });
        } catch (e) {
            console.error("Twitter fetch error:", e);
            throw e;
        }
    }
}
