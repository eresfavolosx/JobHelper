import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateChartData,
    resolveGranularity,
    getGoalCadenceGranularity,
    getGranularityLabel
} from '../lib/chart-utils.js';

describe('Application History Chart & Granularity Switcher', () => {

    describe('1. Automatic Granularity Switching Based on Goal Cadence', () => {
        it('should automatically switch to daily granularity when goal is daily', () => {
            const goal = { cadence: 'daily', target: 5 };
            const granularity = getGoalCadenceGranularity(goal);
            assert.equal(granularity, 'daily');
            assert.equal(resolveGranularity('auto', goal), 'daily');
        });

        it('should automatically switch to weekly granularity when goal is weekly', () => {
            const goal = { cadence: 'weekly', target: 15 };
            const granularity = getGoalCadenceGranularity(goal);
            assert.equal(granularity, 'weekly');
            assert.equal(resolveGranularity('auto', goal), 'weekly');
        });

        it('should automatically switch to monthly granularity when goal is monthly', () => {
            const goal = { cadence: 'monthly', target: 50 };
            const granularity = getGoalCadenceGranularity(goal);
            assert.equal(granularity, 'monthly');
            assert.equal(resolveGranularity('auto', goal), 'monthly');
        });

        it('should intelligently scale total pipeline goals based on date range', () => {
            const goal = { cadence: 'total', target: 100 };
            // Short span (<= 21 days) -> daily
            assert.equal(getGoalCadenceGranularity(goal, 10), 'daily');
            // Medium span (22 - 90 days) -> weekly
            assert.equal(getGoalCadenceGranularity(goal, 45), 'weekly');
            // Long span (> 90 days) -> monthly
            assert.equal(getGoalCadenceGranularity(goal, 120), 'monthly');
        });
    });

    describe('2. Manual Granularity Switcher Overrides', () => {
        const weeklyGoal = { cadence: 'weekly', target: 10 };

        it('should allow manual override to daily even if goal is weekly', () => {
            assert.equal(resolveGranularity('daily', weeklyGoal), 'daily');
        });

        it('should allow manual override to monthly even if goal is weekly', () => {
            assert.equal(resolveGranularity('monthly', weeklyGoal), 'monthly');
        });

        it('should allow manual override to weekly even if goal is daily', () => {
            const dailyGoal = { cadence: 'daily', target: 3 };
            assert.equal(resolveGranularity('weekly', dailyGoal), 'weekly');
        });

        it('should re-align to goal cadence when switching back to auto', () => {
            assert.equal(resolveGranularity('auto', weeklyGoal), 'weekly');
        });

        it('should provide formatted human-readable labels for switcher buttons', () => {
            assert.equal(getGranularityLabel('daily'), 'Daily');
            assert.equal(getGranularityLabel('weekly'), 'Weekly');
            assert.equal(getGranularityLabel('monthly'), 'Monthly');
        });
    });

    describe('3. Time-Series Data Aggregation Engine', () => {
        const refNow = new Date('2026-10-13T12:00:00Z');
        const twoDaysAgo = new Date('2026-10-11T10:00:00Z');
        const yesterday = new Date('2026-10-12T15:00:00Z');
        const today = new Date('2026-10-13T09:00:00Z');

        it('calculateChartData handles basic case correctly in daily mode', () => {
            const jobs = [
                { id: 1, createdAt: twoDaysAgo.toISOString() },
                { id: 2, createdAt: yesterday.toISOString() },
                { id: 3, createdAt: today.toISOString() }
            ];

            const data = calculateChartData(jobs, 'daily', { now: refNow });
            assert.ok(data.length >= 7, 'Should display at least 7 days');

            const lastPoint = data[data.length - 1];
            assert.equal(lastPoint.count, 3, 'Cumulative count today should be 3');
            assert.equal(lastPoint.newJobs, 1, 'New jobs today should be 1');

            const secondLast = data[data.length - 2];
            assert.equal(secondLast.count, 2, 'Cumulative count yesterday should be 2');
            assert.equal(secondLast.newJobs, 1, 'New jobs yesterday should be 1');
        });

        it('calculateChartData handles multiple jobs on same day', () => {
            const jobs = [
                { id: 1, createdAt: today.toISOString() },
                { id: 2, createdAt: today.toISOString() }
            ];

            const data = calculateChartData(jobs, 'daily', { now: refNow });
            const lastPoint = data[data.length - 1];
            assert.equal(lastPoint.count, 2, 'Should count both jobs for today');
            assert.equal(lastPoint.newJobs, 2, 'Should record 2 new jobs today');
        });

        it('calculateChartData handles empty jobs array', () => {
            const data = calculateChartData([]);
            assert.deepEqual(data, [], 'Should return empty array for no jobs');
        });

        it('calculateChartData uses a custom getDate accessor and skips undated jobs instead of counting them as today', () => {
            const jobs = [
                { id: 1, createdAt: today.toISOString(), appliedAt: yesterday.toISOString() },
                { id: 2 } // no date at all -> must not be counted as "today"
            ];
            const data = calculateChartData(jobs, 'daily', { now: refNow, getDate: j => j.appliedAt });
            const lastPoint = data[data.length - 1];
            const secondLast = data[data.length - 2];
            assert.equal(lastPoint.newJobs, 0, 'Nothing applied today');
            assert.equal(secondLast.newJobs, 1, 'Dated by appliedAt (yesterday)');
            assert.equal(lastPoint.count, 1, 'Undated job is excluded');
        });

        it('calculateChartData groups by weekly intervals accurately', () => {
            const jobs = [
                { id: 1, createdAt: '2026-09-15T10:00:00Z' }, // Week of Sep 14
                { id: 2, createdAt: '2026-09-28T10:00:00Z' }, // Week of Sep 28
                { id: 3, createdAt: '2026-10-02T10:00:00Z' }, // Week of Sep 28
                { id: 4, createdAt: '2026-10-13T10:00:00Z' }  // Week of Oct 12
            ];

            const data = calculateChartData(jobs, 'weekly', { now: refNow });
            assert.ok(data.length >= 4, 'Should contain at least 4 weekly points');

            const lastWeek = data[data.length - 1];
            assert.equal(lastWeek.count, 4, 'Cumulative count in current week should be 4');
            assert.equal(lastWeek.newJobs, 1, 'New jobs in current week should be 1');
            assert.ok(lastWeek.periodLabel.includes('Week of'));
        });

        it('calculateChartData groups by monthly intervals accurately', () => {
            const jobs = [
                { id: 1, createdAt: '2026-08-10T10:00:00Z' }, // August
                { id: 2, createdAt: '2026-09-15T10:00:00Z' }, // September
                { id: 3, createdAt: '2026-09-20T10:00:00Z' }, // September
                { id: 4, createdAt: '2026-10-05T10:00:00Z' }, // October
                { id: 5, createdAt: '2026-10-13T10:00:00Z' }  // October
            ];

            const data = calculateChartData(jobs, 'monthly', { now: refNow });
            assert.ok(data.length >= 3, 'Should contain at least 3 monthly points');

            const oct = data.find(p => p.date === 'Oct 2026');
            assert.ok(oct, 'Should contain an entry for Oct 2026');
            assert.equal(oct.count, 5, 'Cumulative count in Oct should be 5');
            assert.equal(oct.newJobs, 2, 'New jobs in Oct should be 2');
        });
    });

    describe('4. Time Range Filtering & Daily Zero-Skipping Timeline', () => {
        const refNow = new Date('2026-10-13T12:00:00Z');
        const olderJob = { id: 1, createdAt: '2026-08-01T10:00:00Z' }; // 73 days ago
        const recentJob1 = { id: 2, createdAt: '2026-10-11T10:00:00Z' }; // 2 days ago
        const recentJob2 = { id: 3, createdAt: '2026-10-13T09:00:00Z' }; // Today
        const allJobs = [olderJob, recentJob1, recentJob2];

        it('should generate exactly 7 consecutive days for range=7d without skipping a single day', () => {
            const data = calculateChartData(allJobs, 'daily', { now: refNow, range: '7d' });
            assert.equal(data.length, 7, 'Should contain exactly 7 points for 7D range');
            // The first point should already include the older job in cumulative count
            assert.equal(data[0].count, 1, 'Cumulative count at start of 7D range includes past job');
            assert.equal(data[data.length - 1].count, 3, 'Cumulative count at end includes all 3 jobs');
        });

        it('should generate exactly 14 consecutive days for range=14d without skipping a single day', () => {
            const data = calculateChartData(allJobs, 'daily', { now: refNow, range: '14d' });
            assert.equal(data.length, 14, 'Should contain exactly 14 points for 14D range');
            assert.equal(data[data.length - 1].count, 3);
        });

        it('should generate exactly 30 consecutive days for range=30d without skipping a single day', () => {
            const data = calculateChartData(allJobs, 'daily', { now: refNow, range: '30d' });
            assert.equal(data.length, 30, 'Should contain exactly 30 points for 30D range');
            assert.equal(data[data.length - 1].count, 3);
        });

        it('should generate exactly 90 consecutive days for range=90d without skipping a single day', () => {
            const data = calculateChartData(allJobs, 'daily', { now: refNow, range: '90d' });
            assert.equal(data.length, 90, 'Should contain exactly 90 points for 90D range');
            assert.equal(data[data.length - 1].count, 3);
        });

        it('should generate complete consecutive day interval from first application for range=all', () => {
            const data = calculateChartData(allJobs, 'daily', { now: refNow, range: 'all' });
            // August 1 to October 13 is 31 (Aug) + 30 (Sep) + 13 (Oct) = 74 days
            assert.equal(data.length, 74, 'Should contain all 74 days from Aug 1 to Oct 13 without skipping');
            assert.equal(data[0].date, 'Aug 1');
            assert.equal(data[data.length - 1].date, 'Oct 13');
            assert.equal(data[data.length - 1].count, 3);
        });
    });
});
