import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    createCycle,
    getActiveCycle,
    resolveCyclesFromJobs,
    closeCycleWithAcceptedOffer,
    reopenCycleForRevertedOffer,
    filterJobsByCycle,
    calculateCycleStats
} from './cycle-utils.js';

describe('cycle-utils — Job Search Cycles & Cohort Filtering Engine', () => {
    describe('1. Cycle Creation & Active Resolution', () => {
        test('createCycle initializes with valid defaults and sequence number', () => {
            const cycle = createCycle(1, { name: 'Initial Search' });
            assert.equal(cycle.cycleNumber, 1);
            assert.equal(cycle.name, 'Initial Search');
            assert.equal(cycle.status, 'active');
            assert.equal(cycle.endedAt, null);
            assert.ok(cycle.startedAt);
            assert.ok(cycle.id);
        });

        test('getActiveCycle returns active cycle correctly', () => {
            const cycles = [
                createCycle(1, { id: 'c1', status: 'completed' }),
                createCycle(2, { id: 'c2', status: 'active' })
            ];
            const active = getActiveCycle(cycles);
            assert.equal(active.id, 'c2');
            assert.equal(active.cycleNumber, 2);
        });
    });

    describe('2. Auto-Resolving Cycles from Historical Applications', () => {
        test('creates single active Cycle 1 when no accepted jobs exist', () => {
            const jobs = [
                { id: '1', company: 'Google', status: 'applied', appliedAt: '2026-09-01T10:00:00Z' },
                { id: '2', company: 'Meta', status: 'interviewing', appliedAt: '2026-09-10T10:00:00Z' }
            ];
            const cycles = resolveCyclesFromJobs(jobs, []);
            assert.equal(cycles.length, 1);
            assert.equal(cycles[0].cycleNumber, 1);
            assert.equal(cycles[0].status, 'active');
            assert.equal(cycles[0].acceptedJobId, null);
        });

        test('auto-partitions history into completed Cycle 1 and active Cycle 2 when offer exists', () => {
            const jobs = [
                { id: '1', company: 'Amazon', status: 'rejected', appliedAt: '2026-08-01T10:00:00Z' },
                { id: '2', company: 'Stripe', role: 'Staff Engineer', status: 'accepted', appliedAt: '2026-08-15T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z' },
                { id: '3', company: 'Anthropic', status: 'applied', appliedAt: '2026-10-01T10:00:00Z' }
            ];
            const cycles = resolveCyclesFromJobs(jobs, []);
            assert.equal(cycles.length, 2);

            // Cycle 1 is completed with Stripe offer
            assert.equal(cycles[0].cycleNumber, 1);
            assert.equal(cycles[0].status, 'completed');
            assert.equal(cycles[0].acceptedCompany, 'Stripe');
            assert.equal(cycles[0].acceptedRole, 'Staff Engineer');
            assert.equal(cycles[0].acceptedJobId, '2');

            // Cycle 2 is active
            assert.equal(cycles[1].cycleNumber, 2);
            assert.equal(cycles[1].status, 'active');
            assert.equal(cycles[1].endedAt, null);
        });
    });

    describe('3. Closing Cycle on Accepted Offer & Starting New Cycle', () => {
        test('closes current active cycle and opens next active cycle seamlessly', () => {
            const initialCycles = [
                createCycle(1, { id: 'c1', status: 'active', startedAt: '2026-09-01T00:00:00Z' })
            ];
            const acceptedJob = {
                id: 'job_stripe',
                company: 'Stripe',
                role: 'Tech Lead'
            };
            const now = '2026-10-15T12:00:00Z';

            const { updatedCycles, closedCycle, newActiveCycle } = closeCycleWithAcceptedOffer(
                initialCycles,
                acceptedJob,
                { now }
            );

            assert.equal(updatedCycles.length, 2);

            // Closed cycle checks
            assert.equal(closedCycle.id, 'c1');
            assert.equal(closedCycle.status, 'completed');
            assert.equal(closedCycle.endedAt, now);
            assert.equal(closedCycle.acceptedJobId, 'job_stripe');
            assert.equal(closedCycle.acceptedCompany, 'Stripe');
            assert.equal(closedCycle.acceptedRole, 'Tech Lead');

            // New active cycle checks
            assert.equal(newActiveCycle.cycleNumber, 2);
            assert.equal(newActiveCycle.status, 'active');
            assert.equal(newActiveCycle.startedAt, now);
            assert.equal(newActiveCycle.endedAt, null);
        });
    });

    describe('4. Reopening Cycle on Reverted Offer', () => {
        test('reverts closed cycle back to active and cleans up empty downstream cycle', () => {
            const cycles = [
                createCycle(1, {
                    id: 'c1',
                    status: 'completed',
                    acceptedJobId: 'job_123',
                    acceptedCompany: 'Google'
                }),
                createCycle(2, {
                    id: 'c2',
                    status: 'active'
                })
            ];
            // No jobs assigned to c2 yet
            const jobs = [
                { id: 'job_123', company: 'Google', cycleId: 'c1', status: 'offer' }
            ];

            const updatedCycles = reopenCycleForRevertedOffer(cycles, 'job_123', jobs);
            assert.equal(updatedCycles.length, 1);
            assert.equal(updatedCycles[0].id, 'c1');
            assert.equal(updatedCycles[0].status, 'active');
            assert.equal(updatedCycles[0].acceptedJobId, null);
        });
    });

    describe('5. Filtering Jobs by Cycle', () => {
        test('filters jobs explicitly assigned to a cycle', () => {
            const cycles = [
                createCycle(1, { id: 'c1', status: 'completed' }),
                createCycle(2, { id: 'c2', status: 'active' })
            ];
            const jobs = [
                { id: '1', company: 'Apple', cycleId: 'c1', status: 'accepted' },
                { id: '2', company: 'Netflix', cycleId: 'c2', status: 'interviewing' },
                { id: '3', company: 'Amazon', cycleId: 'c2', status: 'applied' }
            ];

            const c1Jobs = filterJobsByCycle(jobs, cycles, 'c1');
            assert.equal(c1Jobs.length, 1);
            assert.equal(c1Jobs[0].company, 'Apple');

            const c2Jobs = filterJobsByCycle(jobs, cycles, 'c2');
            assert.equal(c2Jobs.length, 2);
            assert.deepEqual(c2Jobs.map(j => j.company), ['Netflix', 'Amazon']);

            const allJobs = filterJobsByCycle(jobs, cycles, 'all');
            assert.equal(allJobs.length, 3);

            // Default filter without 3rd parameter defaults to active cycle
            const defaultJobs = filterJobsByCycle(jobs, cycles);
            assert.equal(defaultJobs.length, 2);
            assert.deepEqual(defaultJobs.map(j => j.company), ['Netflix', 'Amazon']);
        });
    });

    describe('6. Cycle Statistics Calculation', () => {
        test('accurately calculates application funnel and duration for a cycle', () => {
            const cycle = createCycle(1, {
                status: 'completed',
                startedAt: '2026-09-01T00:00:00Z',
                endedAt: '2026-10-01T00:00:00Z',
                acceptedCompany: 'Vercel'
            });
            const jobs = [
                { id: '1', status: 'wishlist' },
                { id: '2', status: 'applied' },
                { id: '3', status: 'screening' },
                { id: '4', status: 'interviewing' },
                { id: '5', status: 'accepted' }
            ];

            const stats = calculateCycleStats(cycle, jobs);
            assert.equal(stats.totalJobs, 5);
            assert.equal(stats.wishlist, 1);
            assert.equal(stats.applied, 4); // submitted
            assert.equal(stats.screening, 1);
            assert.equal(stats.interviewing, 1);
            assert.equal(stats.offers, 1);
            assert.equal(stats.accepted, 1);
            assert.equal(stats.durationDays, 30);
            assert.equal(stats.isCompleted, true);
        });
    });
});
