import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
    calculateGoalProgress, 
    isCurrentWeek, 
    isCurrentMonth, 
    isToday, 
    getCycleDaysRemaining,
    resolveAppliedAtForStatusChange,
    isSubmittedApplication,
    findMiscountedApplications,
    DEFAULT_GOAL 
} from './goal-tracker.js';

describe('Goal Tracker Engine Unit Tests', () => {
    const fixedNow = new Date('2026-06-17T12:00:00Z'); // Wednesday

    describe('1. Date boundary helpers', () => {
        it('identifies today accurately', () => {
            const todayDate = new Date('2026-06-17T08:30:00Z');
            const yesterdayDate = new Date('2026-06-16T23:59:00Z');
            assert.equal(isToday(todayDate, fixedNow), true);
            assert.equal(isToday(yesterdayDate, fixedNow), false);
        });

        it('identifies current week accurately (Monday to Sunday)', () => {
            const monday = new Date('2026-06-15T12:00:00Z');
            const sunday = new Date('2026-06-21T12:00:00Z');
            const lastSunday = new Date('2026-06-14T12:00:00Z');
            const nextMonday = new Date('2026-06-22T12:00:00Z');

            assert.equal(isCurrentWeek(monday, fixedNow), true);
            assert.equal(isCurrentWeek(sunday, fixedNow), true);
            assert.equal(isCurrentWeek(lastSunday, fixedNow), false);
            assert.equal(isCurrentWeek(nextMonday, fixedNow), false);
        });

        it('identifies current month accurately', () => {
            const sameMonth = new Date('2026-06-02T10:00:00Z');
            const diffMonth = new Date('2026-05-31T23:59:59Z');
            assert.equal(isCurrentMonth(sameMonth, fixedNow), true);
            assert.equal(isCurrentMonth(diffMonth, fixedNow), false);
        });
    });

    describe('2. Progress and Cadence Calculations', () => {
        const sampleJobs = [
            // Current week applications (3 submitted)
            { id: '1', company: 'Stripe', status: 'applied', appliedAt: '2026-06-16T10:00:00Z' },
            { id: '2', company: 'Google', status: 'interviewing', appliedAt: '2026-06-17T09:00:00Z' },
            { id: '3', company: 'Figma', status: 'applied', appliedAt: '2026-06-17T11:00:00Z' },
            // Wishlist job (should NOT count towards applied goal)
            { id: '4', company: 'Apple', status: 'wishlist', createdAt: '2026-06-17T10:00:00Z' },
            // Last week application (in current month, but not current week)
            { id: '5', company: 'Netflix', status: 'applied', appliedAt: '2026-06-08T15:00:00Z' },
            // Last month application
            { id: '6', company: 'Amazon', status: 'rejected', appliedAt: '2026-05-15T15:00:00Z' }
        ];

        it('calculates weekly progress correctly', () => {
            const goal = { target: 10, cadence: 'weekly' };
            const progress = calculateGoalProgress(sampleJobs, goal, fixedNow);

            // 3 jobs applied in current week
            assert.equal(progress.count, 3);
            assert.equal(progress.target, 10);
            assert.equal(progress.percentage, 30);
            assert.equal(progress.remaining, 7);
            assert.equal(progress.cadence, 'weekly');
        });

        it('calculates monthly progress correctly', () => {
            const goal = { target: 20, cadence: 'monthly' };
            const progress = calculateGoalProgress(sampleJobs, goal, fixedNow);

            // 4 jobs applied in June (Stripe, Google, Figma, Netflix)
            assert.equal(progress.count, 4);
            assert.equal(progress.target, 20);
            assert.equal(progress.percentage, 20);
            assert.equal(progress.remaining, 16);
        });

        it('calculates total pipeline goal correctly', () => {
            const goal = { target: 10, cadence: 'total' };
            const progress = calculateGoalProgress(sampleJobs, goal, fixedNow);

            // 5 non-wishlist jobs total
            assert.equal(progress.count, 5);
            assert.equal(progress.percentage, 50);
            assert.equal(progress.remaining, 5);
        });

        it('flags completed pace when target is reached', () => {
            const goal = { target: 3, cadence: 'weekly' };
            const progress = calculateGoalProgress(sampleJobs, goal, fixedNow);

            assert.equal(progress.percentage, 100);
            assert.equal(progress.pace, 'completed');
            assert.equal(progress.remaining, 0);
        });

        it('calculates remaining cycle time and defaults accurately', () => {
            assert.equal(DEFAULT_GOAL.cadence, 'weekly');
            assert.equal(DEFAULT_GOAL.target, 10);

            const weeklyRemaining = getCycleDaysRemaining('weekly', fixedNow);
            assert.ok(weeklyRemaining.includes('days left this week') || weeklyRemaining.includes('day left'));

            const monthlyRemaining = getCycleDaysRemaining('monthly', fixedNow);
            assert.ok(monthlyRemaining.includes('days left this month') || monthlyRemaining.includes('day left'));

            const dailyRemaining = getCycleDaysRemaining('daily', fixedNow);
            assert.ok(dailyRemaining.includes('h left today'));
        });

        it('returns todayJobs, todayCount, and cycleJobs sorted newest-first', () => {
            const goal = { target: 10, cadence: 'weekly' };
            const progress = calculateGoalProgress(sampleJobs, goal, fixedNow);

            // 2 jobs applied on fixedNow (2026-06-17): Figma (11:00Z) and Google (09:00Z)
            assert.equal(progress.todayCount, 2);
            assert.equal(progress.todayJobs.length, 2);
            assert.equal(progress.todayJobs[0].company, 'Figma');
            assert.equal(progress.todayJobs[1].company, 'Google');

            // 3 jobs in current week: Figma, Google, Stripe
            assert.equal(progress.cycleJobs.length, 3);
            assert.equal(progress.cycleJobs[0].company, 'Figma');
            assert.equal(progress.cycleJobs[2].company, 'Stripe');
        });
    });

    describe('3. Status changes must not count towards the goal', () => {
        const nowIso = fixedNow.toISOString();
        const lastMonth = '2026-05-10T10:00:00Z';

        it('stamps appliedAt only for a genuine wishlist -> pipeline transition', () => {
            const wishlistJob = { id: 'w', status: 'wishlist', createdAt: lastMonth };
            assert.equal(resolveAppliedAtForStatusChange(wishlistJob, 'applied', nowIso), nowIso);
        });

        it('never re-dates an application when moving between pipeline stages', () => {
            const appliedJob = { id: 'a', status: 'applied', appliedAt: lastMonth, createdAt: lastMonth };
            for (const stage of ['screening', 'interviewing', 'offer', 'accepted', 'rejected']) {
                assert.equal(resolveAppliedAtForStatusChange(appliedJob, stage, nowIso), undefined, stage);
            }
        });

        it('backfills legacy pipeline jobs missing appliedAt with their creation date, not now', () => {
            const legacyJob = { id: 'l', status: 'applied', createdAt: lastMonth };
            assert.equal(resolveAppliedAtForStatusChange(legacyJob, 'screening', nowIso), lastMonth);
        });

        it('does not stamp appliedAt when restoring an archived pipeline job', () => {
            const archived = { id: 'r', status: 'archived', previousStatus: 'interviewing', appliedAt: lastMonth };
            assert.equal(resolveAppliedAtForStatusChange(archived, 'interviewing', nowIso), undefined);
        });

        it('ignores updatedAt so a stage change today does not count as applied today', () => {
            const movedToday = {
                id: 'm',
                status: 'screening',
                createdAt: lastMonth,
                updatedAt: nowIso
            };
            const progress = calculateGoalProgress([movedToday], { target: 3, cadence: 'daily' }, fixedNow);
            assert.equal(progress.count, 0);
            assert.equal(progress.todayCount, 0);
        });
    });

    describe('4. Submitted application rules & memoization', () => {
        it('excludes wishlist, deleted, and archived wishlist bookmarks', () => {
            assert.equal(isSubmittedApplication({ status: 'wishlist' }), false);
            assert.equal(isSubmittedApplication({ status: 'deleted' }), false);
            assert.equal(isSubmittedApplication({ status: 'archived', previousStatus: 'wishlist' }), false);
            assert.equal(isSubmittedApplication({ status: 'archived' }), false);
        });

        it('includes pipeline stages and archived pipeline jobs', () => {
            for (const s of ['applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected']) {
                assert.equal(isSubmittedApplication({ status: s }), true, s);
            }
            assert.equal(isSubmittedApplication({ status: 'archived', previousStatus: 'screening' }), true);
        });

        it('does not count archiving a wishlist bookmark created today', () => {
            const jobs = [{ id: 'b', status: 'archived', previousStatus: 'wishlist', createdAt: fixedNow.toISOString() }];
            assert.equal(calculateGoalProgress(jobs, { target: 3, cadence: 'daily' }, fixedNow).count, 0);
        });

        it('returns a cached result for identical inputs and recomputes when jobs change', () => {
            const jobs = [{ id: '1', status: 'applied', appliedAt: fixedNow.toISOString() }];
            const goal = { target: 5, cadence: 'weekly' };
            const first = calculateGoalProgress(jobs, goal, fixedNow);
            const second = calculateGoalProgress(jobs, { ...goal }, fixedNow);
            assert.equal(first, second);

            const nextJobs = [...jobs, { id: '2', status: 'screening', appliedAt: fixedNow.toISOString() }];
            const third = calculateGoalProgress(nextJobs, goal, fixedNow);
            assert.notEqual(third, first);
            assert.equal(third.count, 2);
        });
    });

    describe('5. One-time cleanup of miscounted applications', () => {
        const created = '2026-05-01T10:00:00.000Z';
        const stampedToday = fixedNow.toISOString();

        it('repairs an existing job moved applied -> rejected that was re-stamped today', () => {
            const jobs = [{ id: 'x', status: 'rejected', createdAt: created, appliedAt: stampedToday, updatedAt: stampedToday }];
            assert.deepEqual(findMiscountedApplications(jobs), [{ id: 'x', appliedAt: created }]);

            const repaired = jobs.map(j => ({ ...j, appliedAt: created }));
            assert.equal(calculateGoalProgress(repaired, { target: 3, cadence: 'daily' }, fixedNow).count, 0);
        });

        it('repairs other pipeline stages (screening, interviewing, offer)', () => {
            const jobs = ['screening', 'interviewing', 'offer'].map((s, i) => ({
                id: String(i), status: s, createdAt: created, appliedAt: stampedToday, updatedAt: stampedToday
            }));
            assert.equal(findMiscountedApplications(jobs).length, 3);
        });

        it('leaves genuine data untouched', () => {
            const jobs = [
                // applied: indistinguishable from a real wishlist -> applied move
                { id: 'a', status: 'applied', createdAt: created, appliedAt: stampedToday, updatedAt: stampedToday },
                // later stage change kept original appliedAt (updatedAt differs)
                { id: 'b', status: 'rejected', createdAt: created, appliedAt: created, updatedAt: stampedToday },
                // created directly in a pipeline stage
                { id: 'c', status: 'interviewing', createdAt: stampedToday, appliedAt: stampedToday },
                // wishlist / deleted never touched
                { id: 'd', status: 'wishlist', createdAt: created, appliedAt: stampedToday, updatedAt: stampedToday },
                { id: 'e', status: 'deleted', createdAt: created, appliedAt: stampedToday, updatedAt: stampedToday }
            ];
            assert.deepEqual(findMiscountedApplications(jobs), []);
        });

        it('only repairs stamps written before the cutoff (previous deployment)', () => {
            const jobs = [{ id: 'x', status: 'rejected', createdAt: created, appliedAt: stampedToday, updatedAt: stampedToday }];
            assert.equal(findMiscountedApplications(jobs, '2026-06-17T11:00:00Z').length, 0);
            assert.equal(findMiscountedApplications(jobs, '2026-06-17T13:00:00Z').length, 1);
        });
    });
});
