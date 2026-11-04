import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useUIStore } from './uiStore.js';

describe('Collapsible Sidebar & Icon Rail Store', () => {
    let mockStorage = {};

    beforeEach(() => {
        mockStorage = {};
        global.window = {};
        global.localStorage = {
            getItem: (key) => mockStorage[key] ?? null,
            setItem: (key, val) => { mockStorage[key] = String(val); }
        };
        // Reset store
        useUIStore.setState({ isSidebarCollapsed: false });
    });

    it('defaults to expanded (isSidebarCollapsed = false)', () => {
        const state = useUIStore.getState();
        assert.equal(state.isSidebarCollapsed, false);
    });

    it('toggles to collapsed and persists preference to localStorage', () => {
        useUIStore.getState().toggleSidebarCollapse();
        assert.equal(useUIStore.getState().isSidebarCollapsed, true);
        assert.equal(mockStorage['novujobs_sidebar_collapsed'], 'true');

        // Toggle back to expanded
        useUIStore.getState().toggleSidebarCollapse();
        assert.equal(useUIStore.getState().isSidebarCollapsed, false);
        assert.equal(mockStorage['novujobs_sidebar_collapsed'], 'false');
    });

    it('explicitly sets collapsed state via setSidebarCollapsed', () => {
        useUIStore.getState().setSidebarCollapsed(true);
        assert.equal(useUIStore.getState().isSidebarCollapsed, true);
        assert.equal(mockStorage['novujobs_sidebar_collapsed'], 'true');

        useUIStore.getState().setSidebarCollapsed(false);
        assert.equal(useUIStore.getState().isSidebarCollapsed, false);
        assert.equal(mockStorage['novujobs_sidebar_collapsed'], 'false');
    });

    it('preserves other UI store states (modals, search) when toggling sidebar', () => {
        useUIStore.getState().openNewJobModal();
        useUIStore.getState().openGlobalSearch('Engineer');

        useUIStore.getState().toggleSidebarCollapse();

        assert.equal(useUIStore.getState().isSidebarCollapsed, true);
        assert.equal(useUIStore.getState().isJobModalOpen, true);
        assert.equal(useUIStore.getState().isGlobalSearchOpen, true);
        assert.equal(useUIStore.getState().globalSearchInitialQuery, 'Engineer');
    });
});
