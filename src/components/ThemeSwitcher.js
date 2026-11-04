"use client";
import React, { useSyncExternalStore } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { getStoredTheme, applyTheme } from '@/lib/theme';

const subscribeTheme = (callback) => {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('novujobs-theme-change', callback);
    return () => window.removeEventListener('novujobs-theme-change', callback);
};

const getThemeSnapshot = () => getStoredTheme();
const getThemeServerSnapshot = () => 'system';
const emptySubscribe = () => () => {};

export default function ThemeSwitcher({ compact = false, collapsed = false, style = {} }) {
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const currentTheme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

    const handleSelect = (mode) => {
        applyTheme(mode);
    };

    if (!mounted) {
        // Render placeholder to avoid hydration mismatch
        return (
            <div
                style={{
                    height: collapsed ? '40px' : compact ? '32px' : '38px',
                    width: collapsed ? '44px' : 'auto',
                    borderRadius: '10px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)',
                    ...style
                }}
            />
        );
    }

    if (collapsed) {
        const nextTheme = currentTheme === 'dark' ? 'light' : currentTheme === 'light' ? 'system' : 'dark';
        const CurrentIcon = currentTheme === 'dark' ? Moon : currentTheme === 'light' ? Sun : Laptop;
        const themeLabel = currentTheme === 'dark' ? 'Dark Mode' : currentTheme === 'light' ? 'Light Mode' : 'System Theme';

        return (
            <button
                type="button"
                onClick={() => handleSelect(nextTheme)}
                title={`Theme: ${themeLabel} (Click to toggle)`}
                aria-label={`Current theme is ${themeLabel}. Click to switch theme.`}
                style={{
                    width: '44px',
                    height: '40px',
                    borderRadius: '9px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    userSelect: 'none',
                    ...style
                }}
            >
                <CurrentIcon size={17} color="var(--accent-primary)" />
            </button>
        );
    }

    const options = [
        { id: 'light', label: 'Light', icon: Sun, title: 'Light Mode (Warm Cotton Plaster)' },
        { id: 'dark', label: 'Dark', icon: Moon, title: 'Dark Mode (Architectural Slate)' },
        { id: 'system', label: 'Auto', icon: Laptop, title: 'Auto (Follow system preference)' }
    ];

    return (
        <div
            role="radiogroup"
            aria-label="Theme mode selector"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px',
                borderRadius: '11px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                gap: '2px',
                boxSizing: 'border-box',
                ...style
            }}
        >
            {options.map((opt) => {
                const isSelected = currentTheme === opt.id;
                const IconComponent = opt.icon;

                return (
                    <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleSelect(opt.id)}
                        title={opt.title}
                        style={{
                            flex: compact ? '0 0 auto' : 1,
                            minWidth: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: compact ? '0px' : '4px',
                            padding: compact ? '5px 8px' : '6px 8px',
                            borderRadius: '8px',
                            fontSize: '0.76rem',
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            background: isSelected ? 'var(--bg-card)' : 'transparent',
                            border: isSelected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                            boxShadow: isSelected ? '0 2px 8px rgba(0, 0, 0, 0.12)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                            userSelect: 'none',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <IconComponent size={compact ? 13 : 14} color={isSelected ? 'var(--accent-primary)' : 'currentColor'} />
                        {!compact && <span>{opt.label}</span>}
                    </button>
                );
            })}
        </div>
    );
}
