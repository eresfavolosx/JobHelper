/**
 * Agent Mode Bridge & Helpers
 * Provides deterministic selectors, programmatic state snapshots, and browser automation bridge
 * for AI web agents (Playwright, Puppeteer, Claude Computer Use, Gemini Live, Chrome DevTools MCP).
 */

/**
 * Agent Mode Bridge & Helpers
 * 
 * Provides deterministic CSS selectors, structured state snapshots, and browser
 * automation utilities for autonomous AI agents (Playwright, Puppeteer, Claude Computer Use,
 * Gemini Vision/Live, and Chrome DevTools Protocol / MCP).
 */

/**
 * Standardized CSS selector catalog.
 * Use these deterministic selectors across automation scripts and browser agents
 * instead of fragile XPath or ambiguous text-based locators.
 */
export const AGENT_SELECTORS = {
    // Mode toggles & indicators
    agentModeToggle: '[data-agent-action="toggle-agent-mode"]',
    agentModeHud: '[data-agent-target="hud"]',

    // Core interactive actions
    newJobButton: '[data-agent-action="new-job"]',
    globalSearchButton: '[data-agent-action="global-search"]',
    toggleSidebarButton: '[data-agent-action="toggle-sidebar"]',
    boardSearchInput: '[data-agent-action="board-search-input"]',
    clearBoardSearchButton: '[data-agent-action="clear-board-search"]',
    toggleFiltersButton: '[data-agent-action="toggle-filters"]',
    resetFiltersButton: '[data-agent-action="reset-filters"]',

    // Primary sidebar navigation links
    navDashboard: '[data-agent-nav="dashboard"]',
    navBoard: '[data-agent-nav="kanban"]',
    navInsights: '[data-agent-nav="insights"]',
    navRecommendations: '[data-agent-nav="recommendations"]',
    navProfile: '[data-agent-nav="profile"]',

    // Add / Edit Job Modal containers and form inputs
    jobModal: '[data-agent-target="add-job-modal"]',
    jobModalRoleInput: '[data-agent-input="job-role"]',
    jobModalCompanyInput: '[data-agent-input="job-company"]',
    jobModalStatusSelect: '[data-agent-input="job-status"]',
    jobModalSalaryInput: '[data-agent-input="job-salary"]',
    jobModalLocationInput: '[data-agent-input="job-location"]',
    jobModalNotesInput: '[data-agent-input="job-notes"]',
    jobModalSubmitButton: '[data-agent-action="submit-job-modal"]',
    jobModalCloseButton: '[data-agent-action="close-job-modal"]',

    // Dynamic parameterized selector generators
    /** Locates the Kanban column container by pipeline stage */
    kanbanColumn: (stage) => `[data-agent-column="${stage}"]`,
    /** Locates an individual application card by its unique job ID */
    jobCard: (jobId) => `[data-agent-job-id="${jobId}"]`,
    /** Locates the edit button on a specific job card */
    jobCardEditButton: (jobId) => `[data-agent-job-id="${jobId}"] [data-agent-action="edit-job"]`,
    /** Locates the archive/restore button on a specific job card */
    jobCardArchiveButton: (jobId) => `[data-agent-job-id="${jobId}"] [data-agent-action="archive-job"]`,
    /** Locates the delete button on a specific job card */
    jobCardDeleteButton: (jobId) => `[data-agent-job-id="${jobId}"] [data-agent-action="delete-job"]`,
    /** Locates the quick-add application button in a column header */
    columnAddButton: (stage) => `[data-agent-column="${stage}"] [data-agent-action="column-add-job"]`
};

/**
 * Complete list of supported application lifecycle stages in canonical pipeline order.
 */
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
 * Builds a structured, machine-readable snapshot of the entire application state.
 * Designed for immediate serialization to JSON when automated agents or LLMs inspect the browser.
 * 
 * @param {Object} options
 * @param {Object|null} options.appStoreState - State from useAppStore.getState()
 * @param {Object|null} options.uiStoreState - State from useUIStore.getState()
 * @param {Object|null} options.user - Current authenticated Firebase user or null
 * @returns {Object} Structured snapshot containing route, stats, UI filters, and application cards.
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
