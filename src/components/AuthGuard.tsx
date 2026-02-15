import { useEffect, useState } from "react";
import { polycentricManager } from "../lib/polycentric/manager";

type AuthState = 'loading' | 'ready';

/**
 * AuthGuard that always lets users through.
 * If Polycentric identity is available → full features.
 * If SDK fails or no identity → demo mode (browsing only, commenting disabled).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>('loading');

    useEffect(() => {
        async function checkAuth() {
            try {
                if (!polycentricManager.processHandle) {
                    const hasIdentity = await polycentricManager.init();
                    if (hasIdentity) {
                        console.log('[AuthGuard] Identity loaded, full mode');
                    } else if (polycentricManager.getError()) {
                        console.warn('[AuthGuard] Polycentric SDK unavailable, entering demo mode');
                    } else {
                        console.log('[AuthGuard] No identity found, entering demo mode');
                    }
                }
            } catch (e) {
                console.error('[AuthGuard] Init error, entering demo mode', e);
            }
            // Always show the app — demo mode if no identity
            setState('ready');
        }
        checkAuth();
    }, []);

    if (state === 'loading') {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center animate-pulse">
                        <span className="text-xl font-bold text-indigo-500">P</span>
                    </div>
                    <p className="text-zinc-500 text-sm">Loading Social Portal...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
