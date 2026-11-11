import test from 'node:test';
import assert from 'node:assert/strict';
import { useAppStore } from './store.js';
import { filterJobsByCycle } from './cycle-utils.js';

test('Store Job Search Cycles Lifecycle Engine', async (t) => {
    // Reset store state
    useAppStore.setState({
        jobs: [],
        cycles: [],
        selectedCycleId: 'active',
        offerCelebrationModal: null,
        currentUserId: 'test-user-cycle-1'
    });

    await t.test('1. addJob assigns active cycleId to newly logged jobs', () => {
        const job1 = useAppStore.getState().addJob({
            company: 'TechCorp',
            role: 'Staff Engineer',
            status: 'applied'
        });

        assert.ok(job1.id, 'Job should have generated an id');
        assert.ok(job1.cycleId, 'Job should have an active cycleId');
        assert.strictEqual(job1.cycleNumber, 1, 'Initial job should belong to Cycle 1');

        const state = useAppStore.getState();
        assert.strictEqual(state.jobs.length, 1);
        assert.strictEqual(state.cycles.length, 1);
        assert.strictEqual(state.cycles[0].cycleNumber, 1);
        assert.strictEqual(state.cycles[0].status, 'active');
    });

    await t.test('2. moving job to accepted closes Cycle 1, launches celebration modal, and starts Cycle 2', () => {
        const state = useAppStore.getState();
        const job1 = state.jobs[0];

        // Move job to accepted
        useAppStore.getState().moveJob(job1.id, 'accepted');

        const nextState = useAppStore.getState();
        const updatedJob = nextState.jobs.find(j => j.id === job1.id);
        assert.strictEqual(updatedJob.status, 'accepted');

        // Check celebration modal
        assert.ok(nextState.offerCelebrationModal, 'Celebration modal should be triggered');
        assert.strictEqual(nextState.offerCelebrationModal.isOpen, true);
        assert.strictEqual(nextState.offerCelebrationModal.cycle.cycleNumber, 1);
        assert.strictEqual(nextState.offerCelebrationModal.cycle.status, 'completed');
        assert.strictEqual(nextState.offerCelebrationModal.cycle.acceptedCompany, 'TechCorp');
        assert.strictEqual(nextState.offerCelebrationModal.nextCycle.cycleNumber, 2);
        assert.strictEqual(nextState.offerCelebrationModal.nextCycle.status, 'active');

        // Check cycles in store
        assert.strictEqual(nextState.cycles.length, 2);
        const cycle1 = nextState.cycles.find(c => c.cycleNumber === 1);
        const cycle2 = nextState.cycles.find(c => c.cycleNumber === 2);
        assert.strictEqual(cycle1.status, 'completed');
        assert.strictEqual(cycle1.acceptedJobId, job1.id);
        assert.strictEqual(cycle2.status, 'active');
    });

    await t.test('3. newly logged jobs after offer acceptance belong to Cycle 2', () => {
        const job2 = useAppStore.getState().addJob({
            company: 'NextGen AI',
            role: 'Founding Engineer',
            status: 'applied'
        });

        assert.strictEqual(job2.cycleNumber, 2, 'New job after offer should belong to Cycle 2');
        const state = useAppStore.getState();
        assert.strictEqual(state.jobs.length, 2);

        // Filter by Cycle 1
        const cycle1 = state.cycles.find(c => c.cycleNumber === 1);
        const cycle1Jobs = filterJobsByCycle(state.jobs, state.cycles, cycle1.id);
        assert.strictEqual(cycle1Jobs.length, 1);
        assert.strictEqual(cycle1Jobs[0].company, 'TechCorp');

        // Filter by Cycle 2
        const cycle2 = state.cycles.find(c => c.cycleNumber === 2);
        const cycle2Jobs = filterJobsByCycle(state.jobs, state.cycles, cycle2.id);
        assert.strictEqual(cycle2Jobs.length, 1);
        assert.strictEqual(cycle2Jobs[0].company, 'NextGen AI');

        // Filter by All
        const allJobs = filterJobsByCycle(state.jobs, state.cycles, 'all');
        assert.strictEqual(allJobs.length, 2);
    });

    await t.test('4. modal can be closed and cycle selected via store actions', () => {
        useAppStore.getState().closeOfferCelebrationModal();
        assert.strictEqual(useAppStore.getState().offerCelebrationModal, null);

        const cycle1Id = useAppStore.getState().cycles[0].id;
        useAppStore.getState().setSelectedCycleId(cycle1Id);
        assert.strictEqual(useAppStore.getState().selectedCycleId, cycle1Id);
    });

    await t.test('5. manual startNewCycle creates Cycle 3 and completes Cycle 2', () => {
        const newCycle = useAppStore.getState().startNewCycle('Q2 Executive Search');
        assert.strictEqual(newCycle.cycleNumber, 3);
        assert.strictEqual(newCycle.name, 'Q2 Executive Search');
        assert.strictEqual(newCycle.status, 'active');

        const state = useAppStore.getState();
        assert.strictEqual(state.cycles.length, 3);
        const cycle2 = state.cycles.find(c => c.cycleNumber === 2);
        assert.strictEqual(cycle2.status, 'completed');
    });

    await t.test('6. reopening a cycle restores its active status', () => {
        const cycle1 = useAppStore.getState().cycles.find(c => c.cycleNumber === 1);
        useAppStore.getState().reopenCycle(cycle1.id);

        const state = useAppStore.getState();
        const updatedCycle1 = state.cycles.find(c => c.id === cycle1.id);
        assert.strictEqual(updatedCycle1.status, 'active');
        assert.strictEqual(updatedCycle1.endedAt, null);
    });

    await t.test('7. default view is prefiltered to active search cycle across state resets', () => {
        // clearUserData resets selectedCycleId to 'active'
        useAppStore.getState().clearUserData();
        assert.strictEqual(useAppStore.getState().selectedCycleId, 'active');

        // filterJobsByCycle defaults to 'active'
        const testCycles = [
            { id: 'cycle-1', cycleNumber: 1, status: 'completed' },
            { id: 'cycle-2', cycleNumber: 2, status: 'active' }
        ];
        const testJobs = [
            { id: 'j1', cycleId: 'cycle-1', company: 'Old Corp' },
            { id: 'j2', cycleId: 'cycle-2', company: 'New Corp' }
        ];

        const defaultFiltered = filterJobsByCycle(testJobs, testCycles);
        assert.strictEqual(defaultFiltered.length, 1);
        assert.strictEqual(defaultFiltered[0].company, 'New Corp');
    });

    await t.test('8. setJobSearchMode toggles mode and opens a new cycle when requested', () => {
        useAppStore.getState().clearUserData();
        useAppStore.getState().addJob({ id: 's8-j1', company: 'Alpha', role: 'SWE', status: 'applied' });
        const initialCyclesCount = useAppStore.getState().cycles.length;

        useAppStore.getState().setJobSearchMode(false);
        assert.strictEqual(useAppStore.getState().jobSearchMode, false);

        useAppStore.getState().setJobSearchMode(true, {
            openNewCycle: true,
            cycleName: 'Resumed Search',
            startDate: '2026-10-01'
        });
        const state = useAppStore.getState();
        assert.strictEqual(state.jobSearchMode, true);
        assert.strictEqual(state.cycles.length, initialCyclesCount + 1);
        const active = state.cycles.find(c => c.status === 'active');
        assert.strictEqual(active.name, 'Resumed Search');
    });

    await t.test('9. logJobLossAndStartSearch logs transition, enables search mode, and opens new cycle', () => {
        useAppStore.getState().clearUserData();
        useAppStore.getState().addJob({ company: 'PrevSearchCo', role: 'SWE', status: 'applied' });
        useAppStore.getState().setJobSearchMode(false);

        const res = useAppStore.getState().logJobLossAndStartSearch({
            date: '2026-10-01',
            company: 'PrevCo',
            role: 'Senior Engineer',
            note: 'Laid off'
        });

        const state = useAppStore.getState();
        assert.strictEqual(state.jobSearchMode, true);
        assert.ok(res.newCycle);
        assert.strictEqual(res.newCycle.triggerType, 'job_loss');
        assert.ok(res.event);
        assert.strictEqual(state.transitionLog.length, 2); // job_loss + prior search_paused
        assert.strictEqual(state.transitionLog[0].company, 'PrevCo');
        assert.strictEqual(state.transitionLog[0].note, 'Laid off');

        // Delete transition event removes it
        useAppStore.getState().deleteTransitionEvent(res.event.id);
        assert.strictEqual(useAppStore.getState().transitionLog.length, 1);
    });

    await t.test('10. splitCycleAtDate and updateCyclePeriod update cycles and reassign jobs', () => {
        useAppStore.getState().clearUserData();
        const oldJob = useAppStore.getState().addJob({ company: 'OldCo', role: 'SWE', status: 'rejected', appliedAt: '2026-07-01T12:00:00.000Z' });
        const octJobAdded = useAppStore.getState().addJob({ company: 'OctCo', role: 'SWE', status: 'applied', appliedAt: '2026-10-05T12:00:00.000Z' });

        useAppStore.getState().splitCycleAtDate('2026-10-01', { name: 'Oct Search' });

        let state = useAppStore.getState();
        assert.strictEqual(state.cycles.length, 2);
        const newCycle = state.cycles.find(c => c.name === 'Oct Search');
        const oldCycle = state.cycles.find(c => c.id !== newCycle.id);
        assert.ok(newCycle);
        const octJob = state.jobs.find(j => j.id === octJobAdded.id);
        const julyJob = state.jobs.find(j => j.id === oldJob.id);
        assert.strictEqual(octJob.cycleId, newCycle.id);
        assert.strictEqual(julyJob.cycleId, oldCycle.id);

        useAppStore.getState().updateCyclePeriod(newCycle.id, { name: 'October Sprint', notes: 'Focused AI roles' });
        state = useAppStore.getState();
        const renamed = state.cycles.find(c => c.id === newCycle.id);
        assert.strictEqual(renamed.name, 'October Sprint');
        assert.strictEqual(renamed.notes, 'Focused AI roles');
    });
});
