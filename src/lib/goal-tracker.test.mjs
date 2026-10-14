import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
    calculateGoalProgress, 
    isCurrentWeek, 
    isCurrentMonth, 
    isToday, 
    getCycleDaysRemaining,
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
    });
});
