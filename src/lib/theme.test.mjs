import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getStoredTheme, applyTheme, THEME_STORAGE_KEY } from './theme.js';

describe('Theme Switcher & Preference Manager', () => {
    let mockStorage = {};
    let mockAttributes = {};
    let mockEvents = [];

    beforeEach(() => {
        mockStorage = {};
        mockAttributes = {};
        mockEvents = [];

        global.window = {
            dispatchEvent: (event) => mockEvents.push(event),
            matchMedia: (query) => ({
                matches: query.includes('dark'),
                addEventListener: () => {},
                removeEventListener: () => {}
            })
        };
        global.document = {
            documentElement: {
                setAttribute: (key, val) => { mockAttributes[key] = val; },
                removeAttribute: (key) => { delete mockAttributes[key]; }
            }
        };
        global.localStorage = {
            getItem: (key) => mockStorage[key] || null,
            setItem: (key, val) => { mockStorage[key] = val; }
        };
        global.CustomEvent = class {
            constructor(type, init) {
                this.type = type;
                this.detail = init?.detail;
            }
        };
    });

    it('defaults to "system" when no theme is stored', () => {
        assert.equal(getStoredTheme(), 'system');
    });

    it('applies explicit "light" theme to document and storage', () => {
        applyTheme('light');
        assert.equal(mockStorage[THEME_STORAGE_KEY], 'light');
        assert.equal(mockAttributes['data-theme'], 'light');
        assert.equal(mockAttributes['data-theme-forced'], 'true');
        assert.equal(mockEvents.length, 1);
        assert.equal(mockEvents[0].detail.theme, 'light');
    });

    it('applies explicit "dark" theme to document and storage', () => {
        applyTheme('dark');
        assert.equal(mockStorage[THEME_STORAGE_KEY], 'dark');
        assert.equal(mockAttributes['data-theme'], 'dark');
        assert.equal(mockAttributes['data-theme-forced'], 'true');
    });

    it('resolves "system" theme based on OS media query preference', () => {
        applyTheme('system');
        assert.equal(mockStorage[THEME_STORAGE_KEY], 'system');
        assert.equal(mockAttributes['data-theme'], 'dark'); // based on mock prefers-color-scheme: dark
        assert.equal(mockAttributes['data-theme-forced'], undefined);
    });

    it('reads saved theme preference accurately from storage', () => {
        mockStorage[THEME_STORAGE_KEY] = 'light';
        assert.equal(getStoredTheme(), 'light');

        mockStorage[THEME_STORAGE_KEY] = 'dark';
        assert.equal(getStoredTheme(), 'dark');
    });
});
