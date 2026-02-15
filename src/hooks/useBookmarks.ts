/**
 * React hook for the bookmark system.
 * Wraps the bookmark store with state management and re-renders.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { FeedCategory } from './useUnifiedFeed';
import type { UnifiedPost } from '../adapters/types';
import {
    addBookmark as storeAdd,
    removeBookmark as storeRemove,
    isBookmarked as storeIsBookmarked,
    getBookmarks as storeGetBookmarks,
    subscribeBookmarks,
    downloadBookmarksFile,
} from '../lib/bookmarks';

/** Global snapshot counter to drive useSyncExternalStore */
let snapshotVersion = 0;

function subscribe(onStoreChange: () => void): () => void {
    return subscribeBookmarks(() => {
        snapshotVersion++;
        onStoreChange();
    });
}

function getSnapshot(): number {
    return snapshotVersion;
}

/**
 * Hook to check if a specific post is bookmarked + toggle it.
 */
export function useBookmark(post: UnifiedPost) {
    // Re-render when bookmarks change
    useSyncExternalStore(subscribe, getSnapshot);

    const bookmarked = storeIsBookmarked(post.url);

    const toggleBookmark = useCallback(() => {
        if (storeIsBookmarked(post.url)) {
            storeRemove(post.url);
        } else {
            storeAdd(post);
        }
    }, [post]);

    return { bookmarked, toggleBookmark };
}

/**
 * Hook to get all bookmarks, optionally filtered by category.
 */
export function useBookmarkList(category?: FeedCategory | 'all') {
    useSyncExternalStore(subscribe, getSnapshot);

    const bookmarks = storeGetBookmarks(category);
    const count = bookmarks.length;

    const remove = useCallback((url: string) => {
        storeRemove(url);
    }, []);

    return { bookmarks, count, remove, exportBookmarks: downloadBookmarksFile };
}
