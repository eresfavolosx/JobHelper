import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetricsTrendAnalysis, TREND_WINDOW_OPTIONS } from './trend-analytics.js';

describe('trend-analytics — Recent Metrics Trend & Momentum Engine', () => {
    const fixedNow = '2026-11-11T12:00:00.000Z';

    test('identifies improving screening, interview, early rejection, and response speed over last 14d vs prior 14d', () => {
        // Prior window (15..28 days ago: Oct 14 - Oct 28):
        // 5 applied, 1 screening (takes 8d), 0 interviewing, 3 early rejected (60%)
        // Recent window (0..14 days ago: Oct 29 - Nov 11):
        // 5 applied, 3 screening (2 took 2d, 1 took 3d), 2 interviewing, 1 early rejected (20%)
        const jobs = [
            // Prior window
            { id: 'p1', status: 'rejected', appliedAt: '2026-10-16T12:00:00.000Z' },
            { id: 'p2', status: 'rejected', appliedAt: '2026-10-18T12:00:00.000Z' },
            { id: 'p3', status: 'rejected', appliedAt: '2026-10-20T12:00:00.000Z' },
            { id: 'p4', status: 'applied', appliedAt: '2026-10-22T12:00:00.000Z' },
            { id: 'p5', status: 'screening', appliedAt: '2026-10-18T12:00:00.000Z', screeningDate: '2026-10-26T12:00:00.000Z' },

            // Recent window
            { id: 'r1', status: 'interviewing', appliedAt: '2026-11-01T12:00:00.000Z', screeningDate: '2026-11-03T12:00:00.000Z' },
            { id: 'r2', status: 'interviewing', appliedAt: '2026-11-03T12:00:00.000Z', screeningDate: '2026-11-05T12:00:00.000Z' },
            { id: 'r3', status: 'screening', appliedAt: '2026-11-05T12:00:00.000Z', screeningDate: '2026-11-08T12:00:00.000Z' },
            { id: 'r4', status: 'rejected', appliedAt: '2026-11-06T12:00:00.000Z' },
            { id: 'r5', status: 'applied', appliedAt: '2026-11-09T12:00:00.000Z' }
        ];

        const result = computeMetricsTrendAnalysis(jobs, { windowId: '14d', now: fixedNow });

        assert.equal(result.recentStats.appliedCount, 5);
        assert.equal(result.priorStats.appliedCount, 5);

        const screenMetric = result.metrics.find(m => m.id === 'screening_rate');
        assert.equal(screenMetric.recentValue, 60);
        assert.equal(screenMetric.priorValue, 20);
        assert.equal(screenMetric.delta, 40);
        assert.equal(screenMetric.status, 'improving');

        const interviewMetric = result.metrics.find(m => m.id === 'interview_rate');
        assert.equal(interviewMetric.recentValue, 40);
        assert.equal(interviewMetric.priorValue, 0);
        assert.equal(interviewMetric.status, 'improving');

        const rejectMetric = result.metrics.find(m => m.id === 'early_rejection_rate');
        assert.equal(rejectMetric.recentValue, 20);
        assert.equal(rejectMetric.priorValue, 60);
        assert.equal(rejectMetric.delta, -40);
        // Lower rejection rate is improving!
        assert.equal(rejectMetric.status, 'improving');

        assert.equal(result.summary.tone, 'positive');
        assert.equal(result.summary.verdict, 'Improving Trend');
        assert.ok(result.weeklySeries.length >= 4);
    });

    test('flags lower-is-better metric increases as declining (watch)', () => {
        const jobs = [
            // Prior: 3 applied, 0 early rejected -> 0%
            { id: 'p1', status: 'applied', appliedAt: '2026-10-18T12:00:00.000Z' },
            { id: 'p2', status: 'applied', appliedAt: '2026-10-19T12:00:00.000Z' },
            { id: 'p3', status: 'screening', appliedAt: '2026-10-20T12:00:00.000Z' },
            // Recent: 3 applied, 3 early rejected -> 100%
            { id: 'r1', status: 'rejected', appliedAt: '2026-11-04T12:00:00.000Z' },
            { id: 'r2', status: 'rejected', appliedAt: '2026-11-05T12:00:00.000Z' },
            { id: 'r3', status: 'rejected', appliedAt: '2026-11-06T12:00:00.000Z' }
        ];

        const result = computeMetricsTrendAnalysis(jobs, { windowId: '14d', now: fixedNow });
        const rejectMetric = result.metrics.find(m => m.id === 'early_rejection_rate');
        assert.equal(rejectMetric.recentValue, 100);
        assert.equal(rejectMetric.priorValue, 0);
        assert.equal(rejectMetric.status, 'declining');
    });

    test('respects small sample threshold and excludes deleted/wishlist jobs', () => {
        const jobs = [
            { id: 'w1', status: 'wishlist', appliedAt: '2026-11-05T12:00:00.000Z' },
            { id: 'd1', status: 'deleted', appliedAt: '2026-11-05T12:00:00.000Z' },
            { id: 'r1', status: 'interviewing', appliedAt: '2026-11-05T12:00:00.000Z' },
            { id: 'p1', status: 'applied', appliedAt: '2026-10-20T12:00:00.000Z' }
        ];

        const result = computeMetricsTrendAnalysis(jobs, { windowId: '14d', now: fixedNow });
        assert.equal(result.recentStats.appliedCount, 1);
        assert.equal(result.priorStats.appliedCount, 1);

        const screenMetric = result.metrics.find(m => m.id === 'screening_rate');
        assert.equal(screenMetric.status, 'insufficient');
    });

    test('supports 7d, 14d, and 30d window presets cleanly', () => {
        assert.deepEqual(TREND_WINDOW_OPTIONS.map(w => w.id), ['7d', '14d', '30d']);
        const res7 = computeMetricsTrendAnalysis([], { windowId: '7d', now: fixedNow });
        const res30 = computeMetricsTrendAnalysis([], { windowId: '30d', now: fixedNow });
        assert.equal(res7.window.days, 7);
        assert.equal(res30.window.days, 30);
        assert.equal(res7.weeklySeries.length, 0);
    });
});
