import { useState, useEffect } from "react";
import { useUnifiedFeed } from "../hooks/useUnifiedFeed";
import {
    Pin, PinOff, Plus, X, ExternalLink,
    Loader2, Globe, Zap, Rss, LayoutGrid
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────

interface BoardPin {
    id: string;
    type: 'source' | 'topic';
    value: string;
    label: string;
}

const STORAGE_KEY = 'social-portal-board-pins';

function loadPins(): BoardPin[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
}

function savePins(pins: BoardPin[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}

// ── Source Icon Helper ────────────────────────────────────────────

function SourceIcon({ source }: { source: string }) {
    switch (source) {
        case 'mastodon': return <Globe className="w-4 h-4 text-indigo-400" />;
        case 'nostr': return <Zap className="w-4 h-4 text-purple-400" />;
        case 'rss': return <Rss className="w-4 h-4 text-amber-400" />;
        default: return <Pin className="w-4 h-4 text-zinc-400" />;
    }
}

// ── Pin Feed Card ─────────────────────────────────────────────────

function PinFeedCard({ pin, onRemove }: { pin: BoardPin; onRemove: () => void }) {
    const feedOptions = pin.type === 'source'
        ? { sourceFilter: pin.value }
        : { topic: pin.value };

    const { posts, loading } = useUnifiedFeed(feedOptions);

    const borderColors: Record<string, string> = {
        mastodon: 'border-indigo-500/30 hover:border-indigo-500/50',
        nostr: 'border-purple-500/30 hover:border-purple-500/50',
        rss: 'border-amber-500/30 hover:border-amber-500/50',
    };
    const borderClass = pin.type === 'source'
        ? borderColors[pin.value] || 'border-zinc-700/50'
        : 'border-zinc-700/50 hover:border-zinc-600';

    return (
        <div className={`rounded-2xl bg-zinc-900/80 backdrop-blur border ${borderClass} p-4 transition-all`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {pin.type === 'source' ? <SourceIcon source={pin.value} /> : <Pin className="w-4 h-4 text-emerald-400" />}
                    <h3 className="font-semibold text-sm text-zinc-200">{pin.label}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {pin.type}
                    </span>
                </div>
                <button
                    onClick={onRemove}
                    className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                    title="Unpin"
                >
                    <PinOff className="w-3.5 h-3.5" />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
                </div>
            ) : posts.length === 0 ? (
                <p className="text-center py-4 text-zinc-600 text-sm">No posts yet</p>
            ) : (
                <div className="space-y-2">
                    {posts.slice(0, 3).map(post => (
                        <a
                            key={`${post.source}-${post.id}`}
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 p-2.5 rounded-xl bg-zinc-800/40 hover:bg-zinc-800/70 transition-all group"
                        >
                            <img
                                src={post.author.avatar}
                                alt=""
                                className="w-6 h-6 rounded-full bg-zinc-700 shrink-0"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${post.author.name}`;
                                }}
                            />
                            <div className="flex-1 min-w-0">
                                <div
                                    className="text-xs text-zinc-300 line-clamp-2 prose prose-invert prose-xs max-w-none"
                                    dangerouslySetInnerHTML={{ __html: post.content }}
                                />
                                <span className="text-[10px] text-zinc-600 mt-1 block">
                                    {new Date(post.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <ExternalLink className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 shrink-0 mt-1 transition-colors" />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Add Pin Dialog ────────────────────────────────────────────────

function AddPinDialog({ onAdd, onClose, existingPins }: {
    onAdd: (pin: BoardPin) => void;
    onClose: () => void;
    existingPins: BoardPin[];
}) {
    const [pinType, setPinType] = useState<'source' | 'topic'>('source');
    const [value, setValue] = useState('');

    const sourceOptions = [
        { value: 'mastodon', label: 'Mastodon' },
        { value: 'nostr', label: 'Nostr' },
        { value: 'rss', label: 'RSS Feeds' },
    ].filter(s => !existingPins.some(p => p.type === 'source' && p.value === s.value));

    return (
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-700/60 mb-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-200">Pin to Board</h3>
                <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setPinType('source')}
                    className={`px-3 py-1.5 rounded-lg text-sm ${pinType === 'source' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                >
                    Network
                </button>
                <button
                    onClick={() => setPinType('topic')}
                    className={`px-3 py-1.5 rounded-lg text-sm ${pinType === 'topic' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                >
                    Topic
                </button>
            </div>

            {pinType === 'source' ? (
                <div className="space-y-2">
                    {sourceOptions.length === 0 ? (
                        <p className="text-sm text-zinc-500">All networks are already pinned!</p>
                    ) : (
                        sourceOptions.map(s => (
                            <button
                                key={s.value}
                                onClick={() => onAdd({ id: `source-${s.value}`, type: 'source', value: s.value, label: s.label })}
                                className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 transition-all text-left"
                            >
                                <SourceIcon source={s.value} />
                                <span className="text-sm text-zinc-300">{s.label}</span>
                            </button>
                        ))
                    )}
                </div>
            ) : (
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="e.g. technology, gaming, crypto"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && value.trim()) {
                                onAdd({ id: `topic-${value.trim()}`, type: 'topic', value: value.trim(), label: `#${value.trim()}` });
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            if (value.trim()) {
                                onAdd({ id: `topic-${value.trim()}`, type: 'topic', value: value.trim(), label: `#${value.trim()}` });
                            }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                        Pin
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main Board Page ───────────────────────────────────────────────

export function Board() {
    const [pins, setPins] = useState<BoardPin[]>(loadPins);
    const [showAdd, setShowAdd] = useState(false);

    useEffect(() => { savePins(pins); }, [pins]);

    const addPin = (pin: BoardPin) => {
        setPins(prev => [...prev, pin]);
        setShowAdd(false);
    };

    const removePin = (id: string) => {
        setPins(prev => prev.filter(p => p.id !== id));
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        My Board
                    </h1>
                    <p className="text-zinc-500 mt-1">Your pinned feeds and topics at a glance</p>
                </div>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Pin
                </button>
            </div>

            {showAdd && <AddPinDialog onAdd={addPin} onClose={() => setShowAdd(false)} existingPins={pins} />}

            {pins.length === 0 ? (
                <div className="text-center py-24">
                    <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-zinc-800/60 flex items-center justify-center">
                        <LayoutGrid className="w-10 h-10 text-zinc-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-zinc-300 mb-2">No Pins Yet</h2>
                    <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
                        Pin your favorite networks or topics to see their latest posts at a glance.
                        Visit <span className="text-indigo-400">Discover</span> to explore, or click the button above to add pins.
                    </p>
                    <button
                        onClick={() => setShowAdd(true)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-5 py-2.5 rounded-xl text-sm transition-colors border border-zinc-700/50"
                    >
                        Add Your First Pin
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pins.map(pin => (
                        <PinFeedCard key={pin.id} pin={pin} onRemove={() => removePin(pin.id)} />
                    ))}
                </div>
            )}
        </div>
    );
}
