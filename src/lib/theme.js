/**
 * Theme Manager for NovuJobs
 * Supports 'light' (Warm Cotton Plaster), 'dark' (Architectural Slate), and 'system'
 */

export const THEME_STORAGE_KEY = 'novujobs_theme';

export function getStoredTheme() {
    if (typeof window === 'undefined') return 'system';
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored;
        }
    } catch {
        // localStorage blocked / SSR
    }
    return 'system';
}

export function applyTheme(theme) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        // Ignore storage errors
    }

    const root = document.documentElement;

    if (theme === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        root.removeAttribute('data-theme-forced');
    } else {
        root.setAttribute('data-theme', theme);
        root.setAttribute('data-theme-forced', 'true');
    }

    // Dispatch event so all ThemeSwitcher components update synchronously
    window.dispatchEvent(new CustomEvent('novujobs-theme-change', { detail: { theme } }));
}

export function initTheme() {
    if (typeof window === 'undefined') return () => {};

    const theme = getStoredTheme();
    applyTheme(theme);

    // Listen for system theme changes if set to 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
        if (getStoredTheme() === 'system') {
            applyTheme('system');
        }
    };

    if (mediaQuery?.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemChange);
        return () => mediaQuery.removeEventListener('change', handleSystemChange);
    } else if (mediaQuery?.addListener) {
        mediaQuery.addListener(handleSystemChange);
        return () => mediaQuery.removeListener(handleSystemChange);
    }

    return () => {};
}
