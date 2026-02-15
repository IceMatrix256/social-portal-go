import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";

/**
 * PieFed adapter — pulls from federated image/art communities on Lemmy.
 * Since piefed.social doesn't have a working RSS endpoint,
 * we use Lemmy image-focused communities.
 */
export class PieFedAdapter implements FeedAdapter {
    name = "PieFed";
    description = "Federated community discussions & visual content";

    async fetchPosts(_topic?: string): Promise<UnifiedPost[]> {
        // Pull from Lemmy's image/photography communities
        const feedUrl = "https://lemmy.world/feeds/c/pics.xml?sort=Hot";

        try {
            const rawContent = await fetchProxyContent(feedUrl);
            const parser = new DOMParser();
            const xml = parser.parseFromString(rawContent, "text/xml");

            const items = Array.from(xml.querySelectorAll("item"));

            return items.slice(0, 40).map((item) => {
                const title = item.querySelector("title")?.textContent || "No Title";
                const link = item.querySelector("link")?.textContent || "";
                const pubDate = item.querySelector("pubDate")?.textContent || "";
                const description = item.querySelector("description")?.textContent || "";
                const guid = item.querySelector("guid")?.textContent || link;
                // dc:creator — try multiple selector strategies for browser compat
                const author = item.querySelector("dc\\:creator")?.textContent
                    || item.getElementsByTagName("dc:creator")[0]?.textContent
                    || "";

                // Extract images from description HTML
                const imgMatch = description.match(/src="([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i);
                const media: { type: 'image' | 'video'; url: string; previewUrl?: string }[] = [];
                if (imgMatch) {
                    media.push({
                        type: 'image',
                        url: imgMatch[1],
                        previewUrl: imgMatch[1],
                    });
                }

                const displayName = author || "pics";
                return {
                    id: `pf-${guid}`,
                    source: 'piefed' as const,
                    author: {
                        name: author || "c/pics",
                        handle: author ? `@${author}@lemmy.world` : "lemmy.world/c/pics",
                        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${displayName}`,
                        url: author ? `https://lemmy.world/u/${author}` : "https://lemmy.world/c/pics",
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
        } catch (e) {
            console.error("PieFed fetch error:", e);
            return [];
        }
    }
}
