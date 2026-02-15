import type { FeedAdapter, UnifiedPost } from "./types";
import { fetchProxyContent } from "../lib/proxy";

/**
 * Misskey adapter — uses the Misskey API which differs from Mastodon's.
 * Misskey uses POST requests for timeline queries.
 * Default instance: misskey.design (faster than misskey.io).
 */
export class MisskeyAdapter implements FeedAdapter {
    name = "Misskey";
    description = "Popular Japanese federated microblogging platform";
    private instanceUrl: string;

    constructor(instanceUrl: string = "https://misskey.design") {
        this.instanceUrl = instanceUrl;
    }

    async fetchPosts(_topic?: string): Promise<UnifiedPost[]> {
        const endpoint = `${this.instanceUrl}/api/notes/local-timeline`;

        try {
            // Misskey uses POST for API requests
            const rawContent = await fetchProxyContent(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 40 }),
            });

            const notes = JSON.parse(rawContent);

            if (!Array.isArray(notes)) {
                console.warn("Misskey: unexpected response", notes);
                return [];
            }

            return notes
                .filter((note: any) => {
                    const target = note.renote || note;
                    return target.text || (target.files && target.files.length > 0);
                })
                .map((note: any) => {
                    const target = note.renote || note;
                    const user = target.user || {};
                    const files: any[] = target.files || [];

                    return {
                        id: target.id,
                        source: 'misskey' as const,
                        author: {
                            name: user.name || user.username || "Misskey User",
                            handle: `@${user.username || "unknown"}@${this.getHost()}`,
                            avatar: user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${target.id}`,
                            url: `${this.instanceUrl}/@${user.username || ""}`,
                        },
                        content: target.text || "",
                        media: files
                            .filter((f: any) => f.type?.startsWith('image/') || f.type?.startsWith('video/'))
                            .slice(0, 4)
                            .map((f: any) => ({
                                type: f.type?.startsWith('video/') ? 'video' as const : 'image' as const,
                                url: f.url || f.thumbnailUrl,
                                previewUrl: f.thumbnailUrl || f.url,
                            })),
                        url: `${this.instanceUrl}/notes/${target.id}`,
                        timestamp: new Date(note.createdAt).getTime(), // Keep original timestamp of the activity (boost time) or original? Usually boost time for timeline.
                        originalData: note,
                    };
                });
        } catch (e) {
            console.error("Misskey fetch error:", e);
            return [];
        }
    }

    private getHost(): string {
        try { return new URL(this.instanceUrl).host; }
        catch { return "misskey.io"; }
    }
}
