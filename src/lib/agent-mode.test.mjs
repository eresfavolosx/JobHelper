import test from 'node:test';
import assert from 'node:assert/strict';
import { useUIStore } from './uiStore.js';
import { AGENT_SELECTORS, buildAgentSnapshot, STAGES } from './agent-helper.js';

test('Agent Mode & Automation Bridge Test Suite', async (t) => {
    // Setup mock browser globals for tests
    const originalWindow = global.window;
    const originalDocument = global.document;
    const originalLocalStorage = global.localStorage;

    const mockStorage = new Map();
    const mockDocumentElement = {
        attributes: new Map(),
        setAttribute(k, v) {
            this.attributes.set(k, String(v));
        },
        removeAttribute(k) {
            this.attributes.delete(k);
        },
        getAttribute(k) {
            return this.attributes.get(k) || null;
        }
    };

    global.localStorage = {
        getItem(k) {
            return mockStorage.has(k) ? mockStorage.get(k) : null;
        },
        setItem(k, v) {
            mockStorage.set(k, String(v));
        },
        removeItem(k) {
            mockStorage.delete(k);
        },
        clear() {
            mockStorage.clear();
        }
    };

    global.document = {
        documentElement: mockDocumentElement
    };

    global.window = {
        location: { pathname: '/kanban' },
        localStorage: global.localStorage,
        document: global.document
    };

    t.after(() => {
        global.window = originalWindow;
        global.document = originalDocument;
        global.localStorage = originalLocalStorage;
    });

    await t.test('1. uiStore Agent Mode State & DOM Persistence', () => {
        // Reset state
        useUIStore.getState().setAgentMode(false);
        assert.equal(useUIStore.getState().isAgentMode, false);
        assert.equal(mockDocumentElement.getAttribute('data-agent-mode'), null);
        assert.equal(mockStorage.get('novujobs_agent_mode'), 'false');

        // Toggle on
        useUIStore.getState().toggleAgentMode();
        assert.equal(useUIStore.getState().isAgentMode, true);
        assert.equal(mockDocumentElement.getAttribute('data-agent-mode'), 'true');
        assert.equal(mockStorage.get('novujobs_agent_mode'), 'true');

        // Toggle off
        useUIStore.getState().toggleAgentMode();
        assert.equal(useUIStore.getState().isAgentMode, false);
        assert.equal(mockDocumentElement.getAttribute('data-agent-mode'), null);
        assert.equal(mockStorage.get('novujobs_agent_mode'), 'false');

        // Explicit setAgentMode(true)
        useUIStore.getState().setAgentMode(true);
        assert.equal(useUIStore.getState().isAgentMode, true);
        assert.equal(mockDocumentElement.getAttribute('data-agent-mode'), 'true');
        assert.equal(mockStorage.get('novujobs_agent_mode'), 'true');

        // Clean up
        useUIStore.getState().setAgentMode(false);
    });

    await t.test('2. buildAgentSnapshot Structured State Serialization', () => {
        const mockAppStoreState = {
            jobs: [
                {
                    id: 'job-1',
                    role: 'Senior Staff AI Engineer',
                    company: 'Anthropic',
                    status: 'interviewing',
                    location: 'San Francisco, CA',
                    salary: '$280k',
                    url: 'https://anthropic.com/careers',
                    createdAt: '2026-11-01T12:00:00Z',
                    lastFollowUpAt: '2026-11-05T10:00:00Z'
                },
                {
                    id: 'job-2',
                    role: 'Product Designer',
                    company: 'Linear',
                    status: 'applied',
                    location: 'Remote',
                    salary: '$180k',
                    url: 'https://linear.app/careers',
                    createdAt: '2026-11-02T12:00:00Z'
                },
                {
                    id: 'job-3',
                    role: 'Software Engineer',
                    company: 'Old Co',
                    status: 'deleted'
                }
            ]
        };

        const mockUiStoreState = {
            isAgentMode: true,
            isSidebarCollapsed: false,
            isJobModalOpen: true,
            isGlobalSearchOpen: false,
            editingJob: { id: 'job-1' },
            boardSearchQuery: 'Anthropic',
            boardStageFilter: 'interviewing',
            boardCompanyFilter: 'Anthropic',
            boardLocationFilter: 'all',
            boardQuickFilter: 'all',
            boardSortBy: 'default'
        };

        const mockUser = {
            uid: 'usr-42',
            email: 'agent@novu.works',
            displayName: 'Agent Automator'
        };

        const snapshot = buildAgentSnapshot({
            appStoreState: mockAppStoreState,
            uiStoreState: mockUiStoreState,
            user: mockUser
        });

        assert.equal(snapshot.agentMode, true);
        assert.equal(snapshot.route, '/kanban');
        assert.equal(snapshot.user.email, 'agent@novu.works');
        assert.equal(snapshot.stats.totalJobs, 3);
        assert.equal(snapshot.stats.activeJobs, 2); // job-3 is deleted
        assert.equal(snapshot.stats.byStage.interviewing, 1);
        assert.equal(snapshot.stats.byStage.applied, 1);
        assert.equal(snapshot.stats.byStage.wishlist, 0);
        assert.equal(snapshot.ui.isJobModalOpen, true);
        assert.equal(snapshot.ui.editingJobId, 'job-1');
        assert.equal(snapshot.ui.boardFilters.searchQuery, 'Anthropic');
        assert.equal(snapshot.jobs.length, 3);
        assert.equal(snapshot.jobs[0].company, 'Anthropic');
    });

    await t.test('3. buildAgentSnapshot Gracefully Handles Empty / Nil State', () => {
        const snapshot = buildAgentSnapshot({
            appStoreState: null,
            uiStoreState: null,
            user: null
        });

        assert.equal(snapshot.agentMode, false);
        assert.equal(snapshot.user, null);
        assert.equal(snapshot.stats.totalJobs, 0);
        assert.equal(snapshot.stats.activeJobs, 0);
        assert.equal(snapshot.stats.byStage.wishlist, 0);
        assert.equal(snapshot.jobs.length, 0);
    });

    await t.test('4. AGENT_SELECTORS Deterministic Selectors Contract', () => {
        assert.equal(AGENT_SELECTORS.agentModeToggle, '[data-agent-action="toggle-agent-mode"]');
        assert.equal(AGENT_SELECTORS.agentModeHud, '[data-agent-target="hud"]');
        assert.equal(AGENT_SELECTORS.newJobButton, '[data-agent-action="new-job"]');
        assert.equal(AGENT_SELECTORS.globalSearchButton, '[data-agent-action="global-search"]');
        assert.equal(AGENT_SELECTORS.toggleSidebarButton, '[data-agent-action="toggle-sidebar"]');
        assert.equal(AGENT_SELECTORS.boardSearchInput, '[data-agent-action="board-search-input"]');
        assert.equal(AGENT_SELECTORS.jobModal, '[data-agent-target="add-job-modal"]');
        assert.equal(AGENT_SELECTORS.jobModalRoleInput, '[data-agent-input="job-role"]');
        assert.equal(AGENT_SELECTORS.jobModalSubmitButton, '[data-agent-action="submit-job-modal"]');

        // Dynamic selector functions
        assert.equal(AGENT_SELECTORS.kanbanColumn('applied'), '[data-agent-column="applied"]');
        assert.equal(AGENT_SELECTORS.jobCard('job-99'), '[data-agent-job-id="job-99"]');
        assert.equal(AGENT_SELECTORS.jobCardEditButton('job-99'), '[data-agent-job-id="job-99"] [data-agent-action="edit-job"]');
        assert.equal(AGENT_SELECTORS.columnAddButton('screening'), '[data-agent-column="screening"] [data-agent-action="column-add-job"]');

        // Stages enumeration contract
        assert.equal(STAGES.includes('wishlist'), true);
        assert.equal(STAGES.includes('applied'), true);
        assert.equal(STAGES.includes('screening'), true);
        assert.equal(STAGES.includes('interviewing'), true);
        assert.equal(STAGES.includes('offer'), true);
        assert.equal(STAGES.includes('accepted'), true);
        assert.equal(STAGES.includes('rejected'), true);
        assert.equal(STAGES.includes('archived'), true);
        assert.equal(STAGES.includes('deleted'), true);
    });
});
