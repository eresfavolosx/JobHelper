import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    GANTT_STAGE_META,
    GANTT_TIME_RANGES,
    GANTT_STATUS_FILTERS,
    GANTT_SORT_OPTIONS,
    processJobGanttItem,
    calculateGanttInsights,
    buildGanttChartData,
    formatGanttInsightsMarkdown
} from './gantt-utils.js';

describe('gantt-utils — Job Search Application Gantt & Pipeline Velocity Insights', () => {
    // Fixed reference time for deterministic testing: 2026-11-08T12:00:00Z
    const fixedNowMs = new Date('2026-11-08T12:00:00Z').getTime();

    const sampleJobs = [
        {
            id: 'job-1',
            company: 'Google',
            role: 'Senior Staff Engineer',
            status: 'interviewing',
            appliedAt: '2026-10-25T10:00:00Z', // 14 days ago
            lastInteraction: '2026-11-04T10:00:00Z', // 4 days ago
            createdAt: '2026-10-25T10:00:00Z',
            interviews: [{ date: '2026-11-02T10:00:00Z', type: 'Technical' }]
        },
        {
            id: 'job-2',
            company: 'Stripe',
            role: 'Lead Fullstack Engineer',
            status: 'applied',
            appliedAt: '2026-10-20T10:00:00Z', // 19 days ago, no update -> ghost alert (>=10d)
            createdAt: '2026-10-20T10:00:00Z'
        },
        {
            id: 'job-3',
            company: 'Vercel',
            role: 'Frontend Architect',
            status: 'applied',
            appliedAt: '2026-11-02T10:00:00Z', // 6 days ago -> followup alert (5-9d)
            createdAt: '2026-11-02T10:00:00Z'
        },
        {
            id: 'job-4',
            company: 'Linear',
            role: 'Product Engineer',
            status: 'applied',
            appliedAt: '2026-11-07T10:00:00Z', // 1 day ago -> healthy (<5d)
            createdAt: '2026-11-07T10:00:00Z'
        },
        {
            id: 'job-5',
            company: 'Anthropic',
            role: 'AI Research Platform Lead',
            status: 'offer',
            appliedAt: '2026-10-10T10:00:00Z', // 29 days ago
            offerDate: '2026-11-06T10:00:00Z',
            createdAt: '2026-10-10T10:00:00Z',
            interviews: [
                { date: '2026-10-18T10:00:00Z' },
                { date: '2026-10-28T10:00:00Z' }
            ]
        },
        {
            id: 'job-6',
            company: 'OpenAI',
            role: 'Member of Technical Staff',
            status: 'accepted',
            appliedAt: '2026-09-15T10:00:00Z',
            offerDate: '2026-10-05T10:00:00Z',
            acceptedDate: '2026-10-10T10:00:00Z', // resolved in 25 days
            createdAt: '2026-09-15T10:00:00Z'
        },
        {
            id: 'job-7',
            company: 'Meta',
            role: 'Production Engineer',
            status: 'rejected',
            appliedAt: '2026-10-01T10:00:00Z',
            rejectedAt: '2026-10-15T10:00:00Z', // resolved in 14 days
            createdAt: '2026-10-01T10:00:00Z'
        },
        {
            id: 'job-8',
            company: 'Deleted Corp',
            role: 'Discarded',
            status: 'deleted',
            createdAt: '2026-10-01T10:00:00Z'
        }
    ];

    test('metadata constants are exported and well-formed', () => {
        assert.ok(GANTT_STAGE_META.applied);
        assert.ok(GANTT_STAGE_META.interviewing);
        assert.ok(GANTT_STAGE_META.accepted.isTerminal);
        assert.ok(GANTT_STAGE_META.rejected.isTerminal);
        assert.equal(GANTT_STAGE_META.applied.isTerminal, false);
        assert.equal(GANTT_TIME_RANGES.length, 4);
        assert.equal(GANTT_STATUS_FILTERS.length, 5);
        assert.ok(GANTT_SORT_OPTIONS.length >= 5);
    });

    test('processJobGanttItem calculates timestamps, duration, alerts, and milestones', () => {
        // Test null/empty job
        assert.equal(processJobGanttItem(null, fixedNowMs), null);
        assert.equal(processJobGanttItem({ status: 'deleted' }, fixedNowMs), null);

        // Test Job 2 (Stripe, applied 19 days ago, no updates -> ghost alert)
        const stripeItem = processJobGanttItem(sampleJobs[1], fixedNowMs);
        assert.ok(stripeItem);
        assert.equal(stripeItem.company, 'Stripe');
        assert.equal(stripeItem.status, 'applied');
        assert.equal(stripeItem.isActive, true);
        assert.equal(stripeItem.isTerminal, false);
        assert.equal(stripeItem.alertType, 'ghost');
        assert.equal(stripeItem.isAlert, true);
        assert.ok(stripeItem.durationDays >= 18);
        assert.ok(stripeItem.milestones.length >= 1);
        assert.equal(stripeItem.milestones[0].type, 'applied');

        // Test Job 3 (Vercel, applied 6 days ago -> followup alert)
        const vercelItem = processJobGanttItem(sampleJobs[2], fixedNowMs);
        assert.ok(vercelItem);
        assert.equal(vercelItem.alertType, 'followup');
        assert.equal(vercelItem.isAlert, true);

        // Test Job 4 (Linear, applied 1 day ago -> healthy)
        const linearItem = processJobGanttItem(sampleJobs[3], fixedNowMs);
        assert.ok(linearItem);
        assert.equal(linearItem.alertType, 'healthy');
        assert.equal(linearItem.isAlert, false);

        // Test Job 6 (OpenAI, accepted -> terminal)
        const openAiItem = processJobGanttItem(sampleJobs[5], fixedNowMs);
        assert.ok(openAiItem);
        assert.equal(openAiItem.isActive, false);
        assert.equal(openAiItem.isTerminal, true);
        assert.equal(openAiItem.alertType, 'healthy');
        assert.equal(openAiItem.durationDays, 25);
        assert.ok(openAiItem.milestones.some(m => m.type === 'offer'));
        assert.ok(openAiItem.milestones.some(m => m.type === 'resolved'));
    });

    test('calculateGanttInsights computes pipeline velocity, averages, alerts, and recommendations', () => {
        const processed = sampleJobs
            .map(j => processJobGanttItem(j, fixedNowMs))
            .filter(Boolean);

        const insights = calculateGanttInsights(processed, fixedNowMs);

        // Total active: Google (interviewing), Stripe (applied), Vercel (applied), Linear (applied), Anthropic (offer) = 5
        // Total resolved: OpenAI (accepted), Meta (rejected) = 2
        assert.equal(insights.totalTracked, 7);
        assert.equal(insights.activeCount, 5);
        assert.equal(insights.resolvedCount, 2);

        // Alerts
        assert.equal(insights.ghostAlertCount, 1); // Stripe >=10d
        assert.equal(insights.followupCount, 1);   // Vercel 5-9d
        assert.equal(insights.alertsList.length, 2);

        // Cycle times
        assert.ok(insights.avgActiveCycleDays > 0);
        assert.ok(insights.avgResolvedCycleDays > 0);

        // Stage averages
        assert.ok(insights.stageAverages.applied > 0);
        assert.ok(insights.stageDistribution.length >= 4);

        // Fastest & longest roles
        assert.ok(insights.fastestRole);
        assert.ok(insights.longestInFlightRole);
        assert.equal(insights.longestInFlightRole.company, 'Anthropic'); // 29 days

        // Actionable recommendations generated
        assert.ok(insights.actionableRecommendations.length > 0);
        assert.ok(insights.actionableRecommendations.some(r => r.id === 'ghost-roles'));
    });

    test('calculateGanttInsights handles empty array gracefully', () => {
        const insights = calculateGanttInsights([], fixedNowMs);
        assert.equal(insights.totalTracked, 0);
        assert.equal(insights.activeCount, 0);
        assert.equal(insights.resolvedCount, 0);
        assert.equal(insights.avgActiveCycleDays, 0);
        assert.equal(insights.alertsList.length, 0);
        assert.equal(insights.actionableRecommendations.length, 1);
        assert.equal(insights.actionableRecommendations[0].title, 'Start Tracking Applications');
    });

    test('buildGanttChartData filters, sorts, and computes coordinate percentages', () => {
        const result = buildGanttChartData(sampleJobs, {
            range: 'all',
            statusFilter: 'all',
            sortBy: 'newest',
            nowMs: fixedNowMs
        });

        assert.equal(result.hasData, true);
        assert.equal(result.totalVisible, 7);
        assert.ok(result.columns.length > 0);
        assert.ok(result.todayPercent >= 0 && result.todayPercent <= 100);

        // Check coordinate positioning
        const item = result.items[0];
        assert.ok(typeof item.leftPct === 'number');
        assert.ok(typeof item.widthPct === 'number');
        assert.ok(item.leftPct >= 0 && item.leftPct <= 100);
        assert.ok(item.widthPct > 0);
        assert.ok(Array.isArray(item.positionedMilestones));

        // Test status filtering: 'active'
        const activeOnly = buildGanttChartData(sampleJobs, {
            statusFilter: 'active',
            nowMs: fixedNowMs
        });
        assert.equal(activeOnly.items.length, 5);
        assert.ok(activeOnly.items.every(i => i.isActive));

        // Test status filtering: 'interviews'
        const interviewsOnly = buildGanttChartData(sampleJobs, {
            statusFilter: 'interviews',
            nowMs: fixedNowMs
        });
        // Google (interviewing), Anthropic (offer)
        assert.equal(interviewsOnly.items.length, 2);

        // Test status filtering: 'alerts'
        const alertsOnly = buildGanttChartData(sampleJobs, {
            statusFilter: 'alerts',
            nowMs: fixedNowMs
        });
        assert.equal(alertsOnly.items.length, 2); // Stripe (ghost) + Vercel (followup)

        // Test search query
        const searchResult = buildGanttChartData(sampleJobs, {
            searchQuery: 'anthropic',
            nowMs: fixedNowMs
        });
        assert.equal(searchResult.items.length, 1);
        assert.equal(searchResult.items[0].company, 'Anthropic');

        // Test sorting by company
        const sortedCompany = buildGanttChartData(sampleJobs, {
            sortBy: 'company',
            nowMs: fixedNowMs
        });
        assert.equal(sortedCompany.items[0].company, 'Anthropic');
        assert.equal(sortedCompany.items[sortedCompany.items.length - 1].company, 'Vercel');

        // Test 14d range filtering
        const recentOnly = buildGanttChartData(sampleJobs, {
            range: '14d',
            nowMs: fixedNowMs
        });
        assert.ok(recentOnly.items.length > 0);
    });

    test('formatGanttInsightsMarkdown creates readable formatted text', () => {
        const processed = sampleJobs
            .map(j => processJobGanttItem(j, fixedNowMs))
            .filter(Boolean);
        const insights = calculateGanttInsights(processed, fixedNowMs);

        const markdown = formatGanttInsightsMarkdown(insights);
        assert.ok(markdown.includes('Gantt Pipeline Velocity & Timeline Insights'));
        assert.ok(markdown.includes('Active In-Flight Pipeline'));
        assert.ok(markdown.includes('Resolved Applications'));
        assert.ok(markdown.includes('Actionable Recommendations'));

        // Empty case
        const emptyMarkdown = formatGanttInsightsMarkdown({ totalTracked: 0 });
        assert.ok(emptyMarkdown.includes('No active applications'));
    });
});
