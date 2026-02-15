import { useState, useCallback, useEffect } from 'react';
import { polycentricManager } from '../lib/polycentric/manager';

// ── Types ─────────────────────────────────────────────────────────

export interface PostComment {
    id: string;
    author: string;
    text: string;
    timestamp: number;
}

interface LikesStore {
    [postUrl: string]: boolean;
}

interface CommentsStore {
    [postUrl: string]: PostComment[];
}

// ── Storage keys ──────────────────────────────────────────────────

const LIKES_KEY = 'social-portal-likes';
const COMMENTS_KEY = 'social-portal-comments';

function loadLikes(): LikesStore {
    try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); }
    catch { return {}; }
}

function saveLikes(likes: LikesStore) {
    localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
}

function loadComments(): CommentsStore {
    try { return JSON.parse(localStorage.getItem(COMMENTS_KEY) || '{}'); }
    catch { return {}; }
}

function saveComments(comments: CommentsStore) {
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
}

// ── Hooks ─────────────────────────────────────────────────────────

export function useLike(postUrl: string) {
    const [liked, setLiked] = useState(() => {
        const store = loadLikes();
        return !!store[postUrl];
    });

    const toggleLike = useCallback(() => {
        const store = loadLikes();
        const next = !store[postUrl];
        if (next) {
            store[postUrl] = true;
        } else {
            delete store[postUrl];
        }
        saveLikes(store);
        setLiked(next);
    }, [postUrl]);

    return { liked, toggleLike };
}

export function useComments(postUrl: string) {
    const [comments, setComments] = useState<PostComment[]>(() => {
        const store = loadComments();
        return store[postUrl] || [];
    });

    // Sync when postUrl changes
    useEffect(() => {
        const store = loadComments();
        setComments(store[postUrl] || []);
    }, [postUrl]);

    const addComment = useCallback((text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const comment: PostComment = {
            id: crypto.randomUUID(),
            author: polycentricManager.username || 'Anonymous',
            text: trimmed,
            timestamp: Date.now(),
        };

        const store = loadComments();
        if (!store[postUrl]) store[postUrl] = [];
        store[postUrl].push(comment);
        saveComments(store);
        setComments([...store[postUrl]]);
    }, [postUrl]);

    const removeComment = useCallback((commentId: string) => {
        const store = loadComments();
        if (store[postUrl]) {
            store[postUrl] = store[postUrl].filter(c => c.id !== commentId);
            saveComments(store);
            setComments([...store[postUrl]]);
        }
    }, [postUrl]);

    return { comments, addComment, removeComment };
}
