export interface UnifiedPost {
    id: string;
    source: 'mastodon' | 'nostr' | 'reddit' | 'lemmy' | 'pixelfed' | 'imgur' | 'piefed' | 'rss' | 'bluesky' | 'peertube' | 'polycentric' | 'misskey' | 'nostr-photos' | 'nostr-videos' | 'twitter' | 'youtube';
    author: {
        name: string;
        avatar: string;
        handle: string;
        url: string;
    };
    content: string; // HTML or Markdown
    media: {
        type: 'image' | 'video' | 'embed';
        url: string;
        previewUrl?: string;
    }[];
    url: string; // Original URL (key for commenting)
    timestamp: number; // Unix timestamp
    originalData: any;
}

export interface FeedAdapter {
    name: string;
    description: string;
    fetchPosts(topic?: string, options?: { forceRefresh?: boolean, category?: 'text' | 'media' | 'all' | 'all' }): Promise<UnifiedPost[]>;
}
