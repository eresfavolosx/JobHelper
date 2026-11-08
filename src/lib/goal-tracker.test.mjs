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
    getGoalCycleKey,
    getDailyMilestoneKey,
    shouldTriggerGoalCelebration,
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

    describe('6. Goal Completion & Celebration Trigger Engine', () => {
        it('generates deterministic cycle keys across cadences', () => {
            const dailyKey = getGoalCycleKey({ target: 3, cadence: 'daily' }, fixedNow);
            const weeklyKey = getGoalCycleKey({ target: 10, cadence: 'weekly' }, fixedNow);
            const monthlyKey = getGoalCycleKey({ target: 40, cadence: 'monthly' }, fixedNow);
            const totalKey = getGoalCycleKey({ target: 100, cadence: 'total' }, fixedNow);

            assert.equal(dailyKey.startsWith('daily:2026-06-17:target:3'), true);
            assert.equal(weeklyKey.startsWith('weekly:2026-06-15:target:10'), true);
            assert.equal(monthlyKey.startsWith('monthly:2026-06:target:40'), true);
            assert.equal(totalKey, 'total:all:target:100');
        });

        it('includes cycleKey on calculateGoalProgress output', () => {
            const progress = calculateGoalProgress([], { target: 5, cadence: 'weekly' }, fixedNow);
            assert.ok(progress.cycleKey);
            assert.equal(progress.cycleKey.includes('weekly:'), true);
            assert.equal(progress.cycleKey.includes('target:5'), true);
        });

        it('does not trigger celebration if goal is not yet completed', () => {
            const progress = { count: 4, target: 5, enabled: true, cycleKey: 'weekly:test:5' };
            const shouldTrigger = shouldTriggerGoalCelebration({
                prevCount: 3,
                prevCycleKey: 'weekly:test:5',
                currentProgress: progress,
                celebratedCycleKey: null
            });
            assert.equal(shouldTrigger, false);
        });

        it('does not trigger celebration if goal tracking is disabled', () => {
            const progress = { count: 5, target: 5, enabled: false, cycleKey: 'weekly:test:5' };
            const shouldTrigger = shouldTriggerGoalCelebration({
                prevCount: 4,
                prevCycleKey: 'weekly:test:5',
                currentProgress: progress,
                celebratedCycleKey: null
            });
            assert.equal(shouldTrigger, false);
        });

        it('triggers celebration when user crosses the target threshold in real-time', () => {
            const progress = { count: 5, target: 5, enabled: true, cycleKey: 'weekly:test:5' };
            const shouldTrigger = shouldTriggerGoalCelebration({
                prevCount: 4,
                prevCycleKey: 'weekly:test:5',
                currentProgress: progress,
                celebratedCycleKey: 'weekly:test:5'
            });
            assert.equal(shouldTrigger, true);
        });

        it('triggers celebration for a newly completed cycle that has not yet been celebrated', () => {
            const progress = { count: 5, target: 5, enabled: true, cycleKey: 'weekly:new-cycle:5' };
            const shouldTrigger = shouldTriggerGoalCelebration({
                prevCount: 5,
                prevCycleKey: 'weekly:new-cycle:5',
                currentProgress: progress,
                celebratedCycleKey: 'weekly:old-cycle:5'
            });
            assert.equal(shouldTrigger, true);
        });

        it('does not re-trigger celebration if already celebrated and count did not cross the threshold', () => {
            const progress = { count: 5, target: 5, enabled: true, cycleKey: 'weekly:test:5' };
            const shouldTrigger = shouldTriggerGoalCelebration({
                prevCount: 5,
                prevCycleKey: 'weekly:test:5',
                currentProgress: progress,
                celebratedCycleKey: 'weekly:test:5'
            });
            assert.equal(shouldTrigger, false);
        });

        it('generates deterministic daily milestone key for 5 daily applications', () => {
            const milestoneKey = getDailyMilestoneKey(fixedNow);
            assert.equal(milestoneKey, 'daily-milestone:2026-06-17:target:5');
        });

        it('includes dailyMilestoneKey and isDailyGoalMet in calculateGoalProgress', () => {
            const jobs5Today = [
                { id: '1', status: 'applied', appliedAt: '2026-06-17T08:00:00Z' },
                { id: '2', status: 'applied', appliedAt: '2026-06-17T09:00:00Z' },
                { id: '3', status: 'interviewing', appliedAt: '2026-06-17T10:00:00Z' },
                { id: '4', status: 'applied', appliedAt: '2026-06-17T11:00:00Z' },
                { id: '5', status: 'offer', appliedAt: '2026-06-17T12:00:00Z' }
            ];
            const progress = calculateGoalProgress(jobs5Today, { target: 10, cadence: 'weekly' }, fixedNow);
            assert.equal(progress.todayCount, 5);
            assert.equal(progress.count, 5);
            assert.equal(progress.target, 10);
            assert.equal(progress.percentage, 50); // Weekly target is not 100%
            assert.equal(progress.isDailyGoalMet, true); // But daily 5 applications is met!
            assert.equal(progress.dailyMilestoneKey, 'daily-milestone:2026-06-17:target:5');
        });

        it('triggers celebration when achieving 5 daily applications even if weekly target is 10 (count = 5)', () => {
            const progress = {
                count: 5,
                target: 10,
                todayCount: 5,
                enabled: true,
                cycleKey: 'weekly:2026-06-15:target:10',
                dailyMilestoneKey: 'daily-milestone:2026-06-17:target:5'
            };
            const shouldTrigger = shouldTriggerGoalCelebration({
                prevCount: 4,
                prevCycleKey: 'weekly:2026-06-15:target:10',
                prevTodayCount: 4,
                currentProgress: progress,
                celebratedCycleKey: null,
                celebratedDailyMilestoneKey: null
            });
            assert.equal(shouldTrigger, true);
        });

        it('triggers celebration in real-time when crossing from 4 to 5 daily applications', () => {
            const progress = {
                count: 5,
                target: 10,
                todayCount: 5,
                enabled: true,
                cycleKey: 'weekly:2026-06-15:target:10',
                dailyMilestoneKey: 'daily-milestone:2026-06-17:target:5'
            };
            const shouldTrigger = shouldTriggerGoalCelebration({
                prevCount: 5,
                prevCycleKey: 'weekly:2026-06-15:target:10',
                prevTodayCount: 4, // transition from 4 to 5 today
                currentProgress: progress,
                celebratedCycleKey: null,
                celebratedDailyMilestoneKey: 'daily-milestone:2026-06-17:target:5' // already marked
            });
            // prevTodayCount < 5 ensures real-time crossing triggers celebration
            assert.equal(shouldTrigger, true);
        });

        it('does not re-trigger daily celebration if already celebrated today and todayCount is steady at 5', () => {
            const progress = {
                count: 5,
                target: 10,
                todayCount: 5,
                enabled: true,
                cycleKey: 'weekly:2026-06-15:target:10',
                dailyMilestoneKey: 'daily-milestone:2026-06-17:target:5'
            };
            const shouldTrigger = shouldTriggerGoalCelebration({
                prevCount: 5,
                prevCycleKey: 'weekly:2026-06-15:target:10',
                prevTodayCount: 5, // already 5 previously
                currentProgress: progress,
                celebratedCycleKey: null,
                celebratedDailyMilestoneKey: 'daily-milestone:2026-06-17:target:5' // already celebrated today
            });
            assert.equal(shouldTrigger, false);
        });
    });
});
