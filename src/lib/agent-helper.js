/**
 * Agent Mode Bridge & Helpers
 * Provides deterministic selectors, programmatic state snapshots, and browser automation bridge
 * for AI web agents (Playwright, Puppeteer, Claude Computer Use, Gemini Live, Chrome DevTools MCP).
 */

export const AGENT_SELECTORS = {
    // Mode toggles
    agentModeToggle: '[data-agent-action="toggle-agent-mode"]',
    agentModeHud: '[data-agent-target="hud"]',

    // Core Actions
    newJobButton: '[data-agent-action="new-job"]',
    globalSearchButton: '[data-agent-action="global-search"]',
    toggleSidebarButton: '[data-agent-action="toggle-sidebar"]',
    boardSearchInput: '[data-agent-action="board-search-input"]',
    clearBoardSearchButton: '[data-agent-action="clear-board-search"]',
    toggleFiltersButton: '[data-agent-action="toggle-filters"]',
    resetFiltersButton: '[data-agent-action="reset-filters"]',

    // Nav Links
    navDashboard: '[data-agent-nav="dashboard"]',
    navBoard: '[data-agent-nav="kanban"]',
    navInsights: '[data-agent-nav="insights"]',
    navRecommendations: '[data-agent-nav="recommendations"]',
    navProfile: '[data-agent-nav="profile"]',

    // Modals & Containers
    jobModal: '[data-agent-target="add-job-modal"]',
    jobModalRoleInput: '[data-agent-input="job-role"]',
    jobModalCompanyInput: '[data-agent-input="job-company"]',
    jobModalStatusSelect: '[data-agent-input="job-status"]',
    jobModalSalaryInput: '[data-agent-input="job-salary"]',
    jobModalLocationInput: '[data-agent-input="job-location"]',
    jobModalNotesInput: '[data-agent-input="job-notes"]',
    jobModalSubmitButton: '[data-agent-action="submit-job-modal"]',
    jobModalCloseButton: '[data-agent-action="close-job-modal"]',

    // Dynamic Selectors
    kanbanColumn: (stage) => `[data-agent-column="${stage}"]`,
    jobCard: (jobId) => `[data-agent-job-id="${jobId}"]`,
    jobCardEditButton: (jobId) => `[data-agent-job-id="${jobId}"] [data-agent-action="edit-job"]`,
    jobCardArchiveButton: (jobId) => `[data-agent-job-id="${jobId}"] [data-agent-action="archive-job"]`,
    jobCardDeleteButton: (jobId) => `[data-agent-job-id="${jobId}"] [data-agent-action="delete-job"]`,
    columnAddButton: (stage) => `[data-agent-column="${stage}"] [data-agent-action="column-add-job"]`
};

export const STAGES = [
    'wishlist',
    'applied',
    'screening',
    'interviewing',
    'offer',
    'accepted',
    'rejected',
    'archived',
    'deleted'
];

/**
 * Builds a structured, machine-readable snapshot of the application state.
 */
export function buildAgentSnapshot({ appStoreState, uiStoreState, user }) {
    const jobs = Array.isArray(appStoreState?.jobs) ? appStoreState.jobs : [];
    const activeJobs = jobs.filter(j => j && j.status !== 'deleted' && j.status !== 'archived');

    const byStage = {};
    for (const s of STAGES) {
        byStage[s] = 0;
    }
    for (const job of jobs) {
        if (job && job.status && byStage[job.status] !== undefined) {
            byStage[job.status]++;
        }
    }

    return {
        timestamp: Date.now(),
        route: typeof window !== 'undefined' ? window.location.pathname : '',
        agentMode: !!uiStoreState?.isAgentMode,
        user: user ? {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || null
        } : null,
        stats: {
            totalJobs: jobs.length,
            activeJobs: activeJobs.length,
            byStage
        },
        ui: {
            isSidebarCollapsed: !!uiStoreState?.isSidebarCollapsed,
            isJobModalOpen: !!uiStoreState?.isJobModalOpen,
            isGlobalSearchOpen: !!uiStoreState?.isGlobalSearchOpen,
            editingJobId: uiStoreState?.editingJob?.id || null,
            boardFilters: {
                searchQuery: uiStoreState?.boardSearchQuery || '',
                stage: uiStoreState?.boardStageFilter || 'all',
                company: uiStoreState?.boardCompanyFilter || 'all',
                location: uiStoreState?.boardLocationFilter || 'all',
                quickFilter: uiStoreState?.boardQuickFilter || 'all',
                sortBy: uiStoreState?.boardSortBy || 'default'
            }
        },
        jobs: jobs.map(j => ({
            id: j.id,
            role: j.role || '',
            company: j.company || '',
            status: j.status || 'wishlist',
            location: j.location || '',
            salary: j.salary || '',
            url: j.url || '',
            dateAdded: j.createdAt || j.dateAdded || null,
            lastFollowUpAt: j.lastFollowUpAt || null
        }))
    };
}
