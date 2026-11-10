import { create } from 'zustand';

// Separate store for UI state (Modals, Panels, and Cross-System Search/Filter state)
export const useUIStore = create((set) => ({
    isJobModalOpen: false,
    editingJob: null, // If set, we are editing this job

    openNewJobModal: (initialData = null) =>
        set({
            isJobModalOpen: true,
            editingJob: typeof initialData === 'string' ? { status: initialData } : initialData
        }),
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

    // Agent Mode: Optimizes UI for automated AI agents, headless runners & vision OCR
    isAgentMode: false,
    toggleAgentMode: () =>
        set((state) => {
            const next = !state.isAgentMode;
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem('novujobs_agent_mode', String(next));
                    if (next) {
                        document.documentElement.setAttribute('data-agent-mode', 'true');
                    } else {
                        document.documentElement.removeAttribute('data-agent-mode');
                    }
                } catch {
                    // Ignore storage access errors
                }
            }
            return { isAgentMode: next };
        }),
    setAgentMode: (isAgentMode) => {
        const next = !!isAgentMode;
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('novujobs_agent_mode', String(next));
                if (next) {
                    document.documentElement.setAttribute('data-agent-mode', 'true');
                } else {
                    document.documentElement.removeAttribute('data-agent-mode');
                }
            } catch {
                // Ignore storage access errors
            }
        }
        set({ isAgentMode: next });
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
    setHighlightedJobId: (highlightedJobId) => set({ highlightedJobId }),

    // Full-screen Goal Completion Confetti & Celebration state
    isGoalCelebrationOpen: false,
    goalCelebrationBurstId: 0,
    triggerGoalCelebration: () =>
        set((state) => ({
            isGoalCelebrationOpen: true,
            goalCelebrationBurstId: state.goalCelebrationBurstId + 1
        })),
    closeGoalCelebration: () => set({ isGoalCelebrationOpen: false })
}));
