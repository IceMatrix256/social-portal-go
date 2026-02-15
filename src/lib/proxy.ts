import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Configuration constants
const RETRIES_PER_PROXY = 2;
const RETRY_BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;
const DIRECT_FETCH_HOSTS = new Set([
    'public.api.bsky.app',
    'mastodon.social',
    'misskey.io',
    'misskey.design',
]);

/**
 * List of CORS proxy services to try in order
 * First one is preferred, others are fallbacks
 */
const PROXY_SERVICES: Array<{
    name: string;
    url: string;
    parseResponse: (response: Response) => Promise<string>;
    enabled?: () => boolean;
}> = [
        {
            name: 'allorigins',
            url: 'https://api.allorigins.win/get?url=',
            parseResponse: async (response: Response) => {
                const wrapper = await response.json();
                return wrapper.contents;
            }
        },
        {
            name: 'corsproxy',
            url: 'https://corsproxy.io/?',
            parseResponse: async (response: Response) => {
                return await response.text();
            }
        },
        {
            name: 'cors-anywhere',
            url: 'https://cors-anywhere.herokuapp.com/',
            parseResponse: async (response: Response) => {
                return await response.text();
            }
        },
        // Placeholder for self-hosted proxy
        {
            name: 'self-hosted',
            url: import.meta.env.VITE_CORS_PROXY_URL || '',
            parseResponse: async (response: Response) => {
                return await response.text();
            },
            enabled: () => !!import.meta.env.VITE_CORS_PROXY_URL
        }
    ];

function isLikelyHtmlResponse(contentType: string | null, body: string): boolean {
    const ct = (contentType || '').toLowerCase();
    if (ct.includes('text/html')) return true;
    const sample = body.trim().slice(0, 64).toLowerCase();
    return sample.startsWith('<!doctype html') || sample.startsWith('<html');
}

function getNativeContentType(headers: unknown): string | null {
    if (!headers || typeof headers !== 'object') return null;
    const h = headers as Record<string, unknown>;
    const ct = h['content-type'] ?? h['Content-Type'];
    return typeof ct === 'string' ? ct : null;
}

/**
 * Exponential backoff retry logic
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error('All retry attempts failed');
}

export function getProxyUrl(targetUrl: string): string {
    // Detect if we are running in a native Capacitor environment
    const isNative = Capacitor.isNativePlatform();
    const canUseSameOriginBackend = !isNative && /^https?:$/.test(window.location.protocol);

    // Misskey instances usually support CORS, and our proxy gets blocked by Cloudflare (403)
    if (targetUrl.includes('misskey.io') || targetUrl.includes('misskey.design')) {
        return targetUrl;
    }

    // In Development (Web), we use Vite's proxy.
    // In Native (Android APK), we MUST use a public proxy because localhost:8090 isn't available.
    if (import.meta.env.DEV && !isNative) {
        if (targetUrl.includes('reddit.com')) {
            return targetUrl.replace(/^https?:\/\/(www\.)?reddit\.com/, '/api/reddit');
        }
        if (targetUrl.includes('mastodon.social')) {
            return targetUrl.replace(/^https?:\/\/(www\.)?mastodon\.social/, '/api/mastodon');
        }
        if (targetUrl.includes('api.nostr.band')) {
            return targetUrl.replace(/^https?:\/\/api\.nostr\.band/, '/api/nostr');
        }
        if (targetUrl.includes('lemmy.world')) {
            return targetUrl.replace(/^https?:\/\/(www\.)?lemmy\.world/, '/api/lemmy');
        }
        if (targetUrl.includes('public.api.bsky.app')) {
            return targetUrl.replace(/^https?:\/\/public\.api\.bsky\.app/, '/api/bluesky');
        }
        if (targetUrl.includes('misskey.io')) {
            return targetUrl.replace(/^https?:\/\/misskey\.io/, '/api/misskey');
        }
        if (targetUrl.includes('misskey.design')) {
            return targetUrl.replace(/^https?:\/\/misskey\.design/, '/api/misskey-design');
        }
        if (targetUrl.includes('piefed.social')) {
            return targetUrl.replace(/^https?:\/\/piefed\.social/, '/api/custom-feed');
        }
    }

    // In web mode (dev or self-hosted production), use same-origin backend when available
    if (canUseSameOriginBackend) {
        return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
    }
    return `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
}

/**
 * Fetches content through multiple proxy services with fallback
 */
export async function fetchProxyContent(targetUrl: string, options?: RequestInit): Promise<string> {
    const isNative = Capacitor.isNativePlatform();
    const canUseSameOriginBackend = !isNative && /^https?:$/.test(window.location.protocol);

    if (isNative) {
        try {
            const nativeResponse = await CapacitorHttp.request({
                method: 'GET',
                url: targetUrl,
                connectTimeout: REQUEST_TIMEOUT_MS,
                readTimeout: REQUEST_TIMEOUT_MS,
                headers: {
                    Accept: 'application/json, application/rss+xml, application/xml, text/xml, */*',
                },
            });
            if (nativeResponse.status >= 200 && nativeResponse.status < 300) {
                const body = typeof nativeResponse.data === 'string'
                    ? nativeResponse.data
                    : JSON.stringify(nativeResponse.data);
                if (!isLikelyHtmlResponse(getNativeContentType(nativeResponse.headers), body)) {
                    return body;
                }
                throw new Error('Native fetch returned HTML challenge page');
            }
            throw new Error(`HTTP ${nativeResponse.status}`);
        } catch (error) {
            console.warn('[Proxy] Native direct request failed, falling back:', error);
        }
    }

    if (canUseSameOriginBackend && !import.meta.env.DEV) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`, {
                ...options,
                signal: controller.signal
            });
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.warn('[Proxy] Same-origin backend unavailable, falling back to public proxies:', error);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // For native apps or production, try multiple proxies
    if (import.meta.env.PROD || isNative) {
        const directHost = (() => {
            try {
                return new URL(targetUrl).hostname.toLowerCase();
            } catch {
                return '';
            }
        })();

        if (DIRECT_FETCH_HOSTS.has(directHost)) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

            try {
                const response = await fetch(targetUrl, {
                    ...options,
                    signal: controller.signal
                });

                if (response.ok) {
                    const body = await response.text();
                    if (!isLikelyHtmlResponse(response.headers.get('content-type'), body)) {
                        return body;
                    }
                    throw new Error('Direct fetch returned HTML challenge page');
                }
            } catch (error) {
                console.warn(`[Proxy] Direct fetch failed for ${directHost}, falling back to proxies:`, error);
            } finally {
                clearTimeout(timeoutId);
            }
        }

        const enabledProxies = PROXY_SERVICES.filter(p => !p.enabled || p.enabled());
        const errors: Array<{ proxy: string; error: string }> = [];

        for (const proxy of enabledProxies) {
            if (!proxy.url) continue;

            try {
                console.log(`[Proxy] Trying ${proxy.name}...`);

                const result = await retryWithBackoff(async () => {
                    const proxyUrl = proxy.url + encodeURIComponent(targetUrl);
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

                    try {
                        const response = await fetch(proxyUrl, {
                            ...options,
                            signal: controller.signal,
                            headers: options?.headers
                        });
                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }

                        const body = await proxy.parseResponse(response);
                        if (isLikelyHtmlResponse(response.headers.get('content-type'), body)) {
                            throw new Error('Proxy returned HTML page');
                        }
                        return body;
                    } catch (error) {
                        clearTimeout(timeoutId);
                        throw error;
                    }
                }, RETRIES_PER_PROXY, RETRY_BASE_DELAY_MS);  // Retries per proxy

                console.log(`[Proxy] Success with ${proxy.name}`);
                return result;

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push({ proxy: proxy.name, error: errorMsg });
                console.warn(`[Proxy] ${proxy.name} failed:`, error);
                continue;
            }
        }

        // Include all proxy failures in error message
        const failureSummary = errors.map(e => `${e.proxy}: ${e.error}`).join('; ');
        throw new Error(`All proxies failed. Errors: ${failureSummary}`);
    }

    // Development mode: use Vite proxy
    const url = getProxyUrl(targetUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        if (url.includes('allorigins.win')) {
            const wrapper = await response.json();
            return wrapper.contents;
        } else {
            return await response.text();
        }
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
