import { RefreshCw, AlertCircle } from "lucide-react";

interface ErrorRetryProps {
    message?: string;
    onRetry: () => void;
    loading?: boolean;
}

export function ErrorRetry({ message = "Failed to load content", onRetry, loading }: ErrorRetryProps) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-500/5 border border-red-500/10 rounded-2xl mx-auot max-w-sm">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4 text-red-500">
                <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-zinc-300 font-medium mb-1">{message}</p>
            <p className="text-zinc-500 text-xs mb-4">Network request timed out or failed</p>

            <button
                onClick={onRetry}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Retrying...' : 'Try Again'}
            </button>
        </div>
    );
}
