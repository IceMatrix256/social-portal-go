/**
 * Accessibility settings store — persists in localStorage,
 * applies to <html> data-* attributes for CSS theming.
 */

export type ThemeMode = 'dark' | 'light';

export interface AccessibilitySettings {
    theme: ThemeMode;
    highVisibility: boolean;
    atkinsonFont: boolean;
}

const STORAGE_KEY = 'social-portal-accessibility';

const DEFAULTS: AccessibilitySettings = {
    theme: 'dark',
    highVisibility: false,
    atkinsonFont: false,
};

/** Read current settings from localStorage */
export function getAccessibilitySettings(): AccessibilitySettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULTS };
    }
}

/** Save settings and apply to DOM */
export function saveAccessibilitySettings(settings: AccessibilitySettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applyAccessibilitySettings(settings);
}

/** Apply settings to the <html> element's data-* attributes */
export function applyAccessibilitySettings(settings?: AccessibilitySettings) {
    const s = settings ?? getAccessibilitySettings();
    const html = document.documentElement;

    html.setAttribute('data-theme', s.theme);
    html.setAttribute('data-high-vis', String(s.highVisibility));
    html.setAttribute('data-font', s.atkinsonFont ? 'atkinson' : 'default');
}

// Apply on module load so settings take effect immediately
applyAccessibilitySettings();
