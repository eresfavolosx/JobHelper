import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    INDUSTRY_BENCHMARK_PROFILES,
    normalizeJobSource,
    normalizeWorkArrangement,
    computeBenchmarkAnalytics,
    formatBenchmarkSummaryMarkdown
} from './benchmark-analytics.js';

describe('Market Trends & Industry Benchmark Analytics Engine', () => {
    describe('1. Benchmark Profile Definitions', () => {
        it('should have standard benchmark profiles defined with positive conversion metrics', () => {
            const profiles = Object.values(INDUSTRY_BENCHMARK_PROFILES);
            assert.ok(profiles.length >= 5);

            for (const p of profiles) {
                assert.ok(p.id);
                assert.ok(p.label);
                assert.ok(p.rates.screeningRate > 0);
                assert.ok(p.rates.screeningToInterviewRate > 0);
                assert.ok(p.rates.interviewToOfferRate > 0);
                assert.ok(p.rates.overallOfferRate > 0);
                assert.ok(p.rates.avgCycleDays > 0);
                assert.ok(p.rates.avgCallbackDays > 0);

                // Verify mathematical consistency: product of stage conversion rates matches net overall offer rate
                const computedNetRate = (p.rates.screeningRate / 100) *
                                        (p.rates.screeningToInterviewRate / 100) *
                                        (p.rates.interviewToOfferRate / 100) * 100;
                assert.ok(
                    Math.abs(computedNetRate - p.rates.overallOfferRate) <= 0.15,
                    `Profile ${p.id} overallOfferRate (${p.rates.overallOfferRate}%) does not match product of stages (${computedNetRate.toFixed(2)}%)`
                );
            }
        });
    });

    describe('2. Metadata Normalizers: Source & Arrangement', () => {
        it('should identify referral sources from source, link, or notes', () => {
            assert.equal(normalizeJobSource({ source: 'Employee Referral' }), 'Referral');
            assert.equal(normalizeJobSource({ notes: 'Referred by Dave at Stripe' }), 'Referral');
        });

        it('should identify major job boards and ATS portals', () => {
            assert.equal(normalizeJobSource({ link: 'https://linkedin.com/jobs/view/123' }), 'LinkedIn');
            assert.equal(normalizeJobSource({ link: 'https://boards.greenhouse.io/airbnb/jobs/456' }), 'Direct ATS');
            assert.equal(normalizeJobSource({ source: 'Indeed' }), 'Indeed');
            assert.equal(normalizeJobSource({ notes: 'Recruiter reached out on Twitter' }), 'Recruiter Inbound');
        });

        it('should correctly classify work arrangements (Remote vs Hybrid vs On-site)', () => {
            assert.equal(normalizeWorkArrangement({ location: 'Remote, US' }), 'Remote');
            assert.equal(normalizeWorkArrangement({ workplaceType: 'Virtual WFH' }), 'Remote');
            assert.equal(normalizeWorkArrangement({ location: 'New York (Hybrid 3d)' }), 'Hybrid');
            assert.equal(normalizeWorkArrangement({ location: 'San Francisco, CA' }), 'On-Site');
            assert.equal(normalizeWorkArrangement({}), 'Unspecified');
        });
    });

    describe('3. Funnel Calculation & Benchmark Comparison', () => {
        const sampleJobs = [
            // 4 applied, 2 reached screening, 1 reached interview, 1 offer
            { id: '1', company: 'TechCorp', status: 'offer', appliedAt: '2026-10-01', screeningDate: '2026-10-08', offerDate: '2026-10-25', source: 'LinkedIn', location: 'Remote' },
            { id: '2', company: 'DevCo', status: 'interviewing', appliedAt: '2026-10-05', screeningDate: '2026-10-12', source: 'Referral', location: 'Hybrid' },
            { id: '3', company: 'LegacyCorp', status: 'rejected', previousStatus: 'screening', appliedAt: '2026-10-02', source: 'Indeed', location: 'San Francisco' },
            { id: '4', company: 'GhostInc', status: 'applied', appliedAt: '2026-10-10', source: 'LinkedIn', location: 'Remote' },
            { id: '5', company: 'SavedOnly', status: 'wishlist', appliedAt: null, source: 'LinkedIn' }
        ];

        it('should compute exact candidate rates and benchmark deltas', () => {
            const analytics = computeBenchmarkAnalytics(sampleJobs, { benchmarkProfile: 'tech_general' });

            assert.equal(analytics.totalTracked, 5);
            assert.equal(analytics.totalApplied, 4); // Excludes wishlist
            assert.equal(analytics.screeningCount, 3); // 1, 2, 3
            assert.equal(analytics.interviewCount, 2); // 1, 2
            assert.equal(analytics.offerCount, 1);     // 1

            // 3 of 4 = 75% screening rate
            assert.equal(analytics.userRates.screeningRate, 75.0);
            // 2 of 3 = 66.7% screening to interview rate
            assert.equal(analytics.userRates.screeningToInterviewRate, 66.7);
            // 1 of 2 = 50.0% interview to offer rate
            assert.equal(analytics.userRates.interviewToOfferRate, 50.0);
            // 1 of 4 = 25.0% overall offer rate
            assert.equal(analytics.userRates.overallOfferRate, 25.0);

            // Compare vs General Tech Benchmark (Screening benchmark = 12.0%)
            assert.equal(analytics.benchmarkRates.screeningRate, 12.0);
            assert.equal(analytics.deltas.screeningRate, 63.0); // 75 - 12 = +63.0%
            assert.equal(analytics.tiers.screening, 'outperforming');
        });

        it('should compute channel/source ROI accurately', () => {
            const analytics = computeBenchmarkAnalytics(sampleJobs, { benchmarkProfile: 'tech_general' });
            assert.ok(analytics.sourceComparison.length >= 2);

            const referral = analytics.sourceComparison.find(s => s.source === 'Referral');
            assert.ok(referral);
            assert.equal(referral.applied, 1);
            assert.equal(referral.interviews, 1);
            assert.equal(referral.interviewRate, 100.0);
        });

        it('should handle empty or null job datasets gracefully', () => {
            const empty = computeBenchmarkAnalytics([]);
            assert.equal(empty.totalTracked, 0);
            assert.equal(empty.totalApplied, 0);
            assert.equal(empty.hasData, false);
            assert.equal(empty.userRates.screeningRate, 0);
            assert.ok(empty.recommendations.length > 0);

            const nullAnalytics = computeBenchmarkAnalytics(null);
            assert.equal(nullAnalytics.hasData, false);
        });
    });

    describe('4. Weekly Volume Trajectory Trends', () => {
        const weeklyJobs = [
            { id: '1', status: 'applied', appliedAt: '2026-10-05' }, // Week 1
            { id: '2', status: 'applied', appliedAt: '2026-10-06' }, // Week 1
            { id: '3', status: 'applied', appliedAt: '2026-10-12' }, // Week 2
            { id: '4', status: 'applied', appliedAt: '2026-10-19' }  // Week 3
        ];

        it('should group applications by week and calculate rolling average and WoW pace', () => {
            const analytics = computeBenchmarkAnalytics(weeklyJobs);
            assert.equal(analytics.weeklyTrends.length, 3);

            const week1 = analytics.weeklyTrends[0];
            assert.equal(week1.applied, 2);
            assert.equal(week1.rollingAvg, 2.0);

            const week2 = analytics.weeklyTrends[1];
            assert.equal(week2.applied, 1);
            // Week 2 WoW: (1 - 2) / 2 = -50%
            assert.equal(week2.wowGrowthPct, -50);
        });
    });

    describe('5. Markdown Summary Generation', () => {
        it('should format a clean Markdown summary table with benchmarks', () => {
            const sampleJobs = [
                { id: '1', company: 'Google', status: 'offer', appliedAt: '2026-10-01' }
            ];
            const analytics = computeBenchmarkAnalytics(sampleJobs);
            const markdown = formatBenchmarkSummaryMarkdown(analytics);

            assert.ok(markdown.includes('Career Pipeline & Industry Benchmark Analysis'));
            assert.ok(markdown.includes('Screening Callback'));
            assert.ok(markdown.includes('Overall Success Rate'));
            assert.ok(markdown.includes('NovuJobs'));
        });
    });
});
