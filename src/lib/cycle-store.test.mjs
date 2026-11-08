import test from 'node:test';
import assert from 'node:assert/strict';
import { useAppStore } from './store.js';
import { filterJobsByCycle, calculateCycleStats } from './cycle-utils.js';

test('Store Job Search Cycles Lifecycle Engine', async (t) => {
    // Reset store state
    useAppStore.setState({
        jobs: [],
        cycles: [],
        selectedCycleId: 'all',
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
});
