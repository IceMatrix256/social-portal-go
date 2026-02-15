/**
 * LoadMoreTrigger — uses IntersectionObserver to call loadMore()
 * when the user scrolls near the bottom of the feed.
 */

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface Props {
    hasMore: boolean;
    loading: boolean;
    loadMore: () => void;
    totalCount: number;
    visibleCount: number;
}

export function LoadMoreTrigger({ hasMore, loading, loadMore, totalCount, visibleCount }: Props) {
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    loadMore();
                }
            },
            { rootMargin: '400px' } // trigger 400px before reaching the bottom
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);

    if (!hasMore && !loading) return null;

    return (
        <div ref={sentinelRef} className="flex flex-col items-center py-8 gap-2">
            {hasMore && (
                <>
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500/60" />
                    <p className="text-zinc-600 text-xs">
                        Showing {visibleCount} of {totalCount} posts
                    </p>
                </>
            )}
        </div>
    );
}
