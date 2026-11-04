import { create } from 'zustand';

// Separate store for UI state (Modals, Panels, and Cross-System Search/Filter state)
export const useUIStore = create((set) => ({
    isJobModalOpen: false,
    editingJob: null, // If set, we are editing this job

    openNewJobModal: () => set({ isJobModalOpen: true, editingJob: null }),
    openEditJobModal: (job) => set({ isJobModalOpen: true, editingJob: job }),
    closeJobModal: () => set({ isJobModalOpen: false, editingJob: null }),

    // Desktop Collapsible Sidebar state (Hidable into icons)
    isSidebarCollapsed: false,
    toggleSidebarCollapse: () =>
        set((state) => {
            const next = !state.isSidebarCollapsed;
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem('novujobs_sidebar_collapsed', String(next));
                } catch {
                    // Ignore storage access errors
                }
            }
            return { isSidebarCollapsed: next };
        }),
    setSidebarCollapsed: (isSidebarCollapsed) => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('novujobs_sidebar_collapsed', String(isSidebarCollapsed));
            } catch {
                // Ignore storage access errors
            }
        }
        set({ isSidebarCollapsed: !!isSidebarCollapsed });
    },

    // Global Search Command Palette state
    isGlobalSearchOpen: false,
    globalSearchInitialQuery: '',
    openGlobalSearch: (initialQuery = '') =>
        set({
            isGlobalSearchOpen: true,
            globalSearchInitialQuery: typeof initialQuery === 'string' ? initialQuery : ''
        }),
    closeGlobalSearch: () => set({ isGlobalSearchOpen: false }),

    // Shared Board Search & Multi-Parameter Filters
    boardSearchQuery: '',
    boardCompanyFilter: 'all',
    boardStageFilter: 'all',
    boardLocationFilter: 'all',
    boardQuickFilter: 'all',
    boardSortBy: 'default',
    highlightedJobId: null,

    setBoardSearchQuery: (boardSearchQuery) => set({ boardSearchQuery }),
    setBoardFilters: (filters) => set((state) => ({ ...state, ...filters })),
    resetBoardFilters: () =>
        set({
            boardSearchQuery: '',
            boardCompanyFilter: 'all',
            boardStageFilter: 'all',
            boardLocationFilter: 'all',
            boardQuickFilter: 'all',
            boardSortBy: 'default'
        }),
    setHighlightedJobId: (highlightedJobId) => set({ highlightedJobId })
}));
