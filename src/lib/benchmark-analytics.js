/**
 * Market Trends & Industry Benchmark Analytics Engine
 *
 * Provides:
 * 1. Industry Standard Conversion Benchmarks across tech tiers (General Tech, Product/Design, Competitive/Entry, Referral/Network)
 * 2. Candidate Funnel vs. Benchmark Comparative Delta & Performance Tiering
 * 3. Weekly / Monthly Velocity & Trajectory Trends (WoW pace, rolling moving averages)
 * 4. Application Channel & Source ROI Analysis (LinkedIn vs Referral vs Company Direct, etc.)
 * 5. Work Arrangement Performance (Remote vs Hybrid vs On-site)
 * 6. Actionable Diagnostic Takeaways & 1-Click Clipboard Markdown Export
 */

import { subDays, startOfWeek, format } from 'date-fns';
import { safeDate } from './utils.js';

export const INDUSTRY_BENCHMARK_PROFILES = {
    tech_general: {
        id: 'tech_general',
        label: 'General Tech / Software Engineering',
        description: 'Mid-to-senior software engineers and tech professionals applying via company career sites and job boards.',
        rates: {
            screeningRate: 12.0,            // 12% of applications advance to initial recruiter screen (~1 in 8.3)
            screeningToInterviewRate: 42.0, // 42% of screened candidates reach the technical interview loop
            interviewToOfferRate: 24.0,     // 24% of interview finalists convert to a formal offer (~1 in 4)
            overallOfferRate: 1.2,          // 1.2% net application-to-offer rate (12% × 42% × 24% ≈ 1.2%, ~1 offer per 83 apps)
            avgCycleDays: 42,               // 42 days average start-to-finish hiring cycle
            avgCallbackDays: 9              // 9 business days average callback response time
        }
    },
    product_design: {
        id: 'product_design',
        label: 'Product, UX & Data Analytics',
        description: 'Product Managers, Product Designers, UX Researchers, and Data Analysts in technology.',
        rates: {
            screeningRate: 12.5,            // 12.5% of applications advance to initial recruiter screen (~1 in 8)
            screeningToInterviewRate: 40.0, // 40% of screened candidates pass portfolio/case review to loops
            interviewToOfferRate: 22.0,     // 22% of final loop presentations convert to an offer
            overallOfferRate: 1.1,          // 1.1% net application-to-offer rate (12.5% × 40% × 22% = 1.1%)
            avgCycleDays: 38,               // 38 days average hiring cycle
            avgCallbackDays: 8              // 8 business days average callback response time
        }
    },
    competitive_entry: {
        id: 'competitive_entry',
        label: 'Competitive / High-Volume Market',
        description: 'High-applicant-volume roles, entry-level/new grads, career switchers, or saturated applicant pools (250+ applicants/req).',
        rates: {
            screeningRate: 5.0,             // 5.0% of applications pass initial ATS resume screen (~1 in 20)
            screeningToInterviewRate: 32.0, // 32% of candidates pass automated coding/take-home tests to interview
            interviewToOfferRate: 18.0,     // 18% of interview finalists convert to an offer
            overallOfferRate: 0.3,          // 0.3% net application-to-offer rate (5% × 32% × 18% ≈ 0.3%, ~1 offer per 330 apps)
            avgCycleDays: 48,               // 48 days average hiring cycle
            avgCallbackDays: 14             // 14 business days average callback response time
        }
    },
    leadership_staff: {
        id: 'leadership_staff',
        label: 'Staff+, Principal & Tech Leadership',
        description: 'Staff/Principal Engineers, Engineering Managers, Directors, and senior technical leadership.',
        rates: {
            screeningRate: 20.0,            // 20% recruiter screening rate due to specialized senior profile match
            screeningToInterviewRate: 50.0, // 50% advance to full leadership & architectural panel
            interviewToOfferRate: 18.0,     // 18% convert (rigorous hiring committee calibration across finalists)
            overallOfferRate: 1.8,          // 1.8% net application-to-offer rate (20% × 50% × 18% = 1.8%)
            avgCycleDays: 56,               // 56 days (8 weeks) average executive hiring cycle
            avgCallbackDays: 10             // 10 business days average callback response time
        }
    },
    referral_network: {
        id: 'referral_network',
        label: 'Warm Network & Employee Referral',
        description: 'Candidates with employee referrals, recruiter headhunting, or executive professional connections.',
        rates: {
            screeningRate: 36.0,            // 36% of referred applications advance to recruiter screen (~1 in 2.8)
            screeningToInterviewRate: 62.0, // 62% of screened referrals advance to technical interviews
            interviewToOfferRate: 32.0,     // 32% of referral finalists convert to an offer (~1 in 3.1)
            overallOfferRate: 7.1,          // 7.1% net application-to-offer rate (36% × 62% × 32% ≈ 7.1%, ~1 offer per 14 referrals)
            avgCycleDays: 28,               // 28 days fast-tracked start-to-finish hiring cycle
            avgCallbackDays: 5              // 5 business days average callback response time
        }
    }
};

export const TRENDS_TIME_RANGES = [
    { id: 'all', label: 'All Time', days: null },
    { id: '90d', label: 'Last 90 Days', days: 90 },
    { id: '60d', label: 'Last 60 Days', days: 60 },
    { id: '30d', label: 'Last 30 Days', days: 30 }
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateSafe(val) {
    if (!val) return new Date();
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
        return safeDate(val.trim() + 'T12:00:00');
    }
    return safeDate(val);
}

/**
 * Normalizes source channels from job metadata or link domain.
 */
export function normalizeJobSource(job) {
    if (!job) return 'Other';
    const explicitSource = String(job.source || job.platform || '').trim().toLowerCase();
    const link = String(job.link || job.url || '').trim().toLowerCase();
    const notes = String(job.notes || '').toLowerCase();

    if (explicitSource.includes('referral') || notes.includes('referral') || notes.includes('referred')) {
        return 'Referral';
    }
    if (explicitSource.includes('linkedin') || link.includes('linkedin.com')) {
        return 'LinkedIn';
    }
    if (explicitSource.includes('indeed') || link.includes('indeed.com')) {
        return 'Indeed';
    }
    if (explicitSource.includes('greenhouse') || link.includes('greenhouse.io') || explicitSource.includes('lever') || link.includes('lever.co') || explicitSource.includes('workday') || link.includes('myworkdayjobs')) {
        return 'Direct ATS';
    }
    if (explicitSource.includes('wellfound') || explicitSource.includes('angel') || link.includes('wellfound.com') || link.includes('angel.co')) {
        return 'Wellfound';
    }
    if (explicitSource.includes('recruiter') || explicitSource.includes('inbound') || notes.includes('recruiter reached out')) {
        return 'Recruiter Inbound';
    }
    if (explicitSource.includes('remoteok') || explicitSource.includes('weworkremotely') || link.includes('remoteok.com') || link.includes('weworkremotely.com')) {
        return 'Remote Boards';
    }
    if (explicitSource.includes('company') || explicitSource.includes('careers') || explicitSource.includes('website')) {
        return 'Company Careers';
    }
    if (explicitSource) {
        return explicitSource.charAt(0).toUpperCase() + explicitSource.slice(1);
    }
    return 'Direct Search';
}

/**
 * Normalizes work arrangement (Remote, Hybrid, On-site).
 */
export function normalizeWorkArrangement(job) {
    if (!job) return 'Unspecified';
    const loc = String(job.location || '').toLowerCase();
    const type = String(job.workplaceType || job.type || '').toLowerCase();
    const text = `${loc} ${type}`;

    if (text.includes('remote') || text.includes('anywhere') || text.includes('virtual') || text.includes('work from home') || text.includes('wfh')) {
        return 'Remote';
    }
    if (text.includes('hybrid') || text.includes('flexible')) {
        return 'Hybrid';
    }
    if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office') || text.includes('office')) {
        return 'On-Site';
    }
    if (loc.length > 2) {
        return 'On-Site';
    }
    return 'Unspecified';
}

/**
 * Computes deep benchmark comparisons, historical velocity trends, and source analytics.
 */
export function computeBenchmarkAnalytics(jobs, options = {}) {
    const benchmarkProfileId = options.benchmarkProfile || 'tech_general';
    const benchmark = INDUSTRY_BENCHMARK_PROFILES[benchmarkProfileId] || INDUSTRY_BENCHMARK_PROFILES.tech_general;
    const rangeId = options.range || 'all';
    const now = options.now instanceof Date ? options.now : new Date();

    const rangeObj = TRENDS_TIME_RANGES.find(r => r.id === rangeId);
    const cutoffMs = rangeObj?.days ? subDays(now, rangeObj.days).getTime() : null;

    if (!Array.isArray(jobs) || jobs.length === 0) {
        return buildEmptyAnalytics(benchmark);
    }

    // 1. Filter jobs by time horizon
    const validJobs = jobs.filter(job => {
        if (!job || job.status === 'deleted') return false;
        if (cutoffMs !== null) {
            const rawDate = job.appliedAt || job.dateAdded || job.createdAt || job.updatedAt;
            if (rawDate) {
                const d = parseDateSafe(rawDate);
                if (!isNaN(d.getTime()) && d.getTime() < cutoffMs) return false;
            }
        }
        return true;
    });

    if (validJobs.length === 0) {
        return buildEmptyAnalytics(benchmark);
    }

    // 2. Aggregate Funnel Counts
    let totalTracked = validJobs.length;
    let totalApplied = 0;
    let screeningCount = 0;
    let interviewCount = 0;
    let offerCount = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;
    let activeInFlightCount = 0;

    let totalCallbackDays = 0;
    let callbackCount = 0;
    let totalCycleDays = 0;
    let cycleCount = 0;

    // Track by source & work arrangement
    const sourceBuckets = {};
    const arrangementBuckets = {};

    // Track weekly time-series volume
    const weeklyBuckets = {};

    for (const job of validJobs) {
        const status = job.status || 'applied';
        const isWishlist = status === 'wishlist';

        if (!isWishlist) {
            totalApplied++;
        }

        const reachedScreening = Boolean(
            status === 'screening' ||
            status === 'interviewing' ||
            status === 'offer' ||
            status === 'accepted' ||
            (job.previousStatus && ['screening', 'interviewing', 'offer'].includes(job.previousStatus)) ||
            (Array.isArray(job.interviews) && job.interviews.length > 0)
        );

        const reachedInterview = Boolean(
            status === 'interviewing' ||
            status === 'offer' ||
            status === 'accepted' ||
            (job.previousStatus && ['interviewing', 'offer'].includes(job.previousStatus)) ||
            (Array.isArray(job.interviews) && job.interviews.length > 0)
        );

        const reachedOffer = Boolean(
            status === 'offer' ||
            status === 'accepted' ||
            job.offerDate
        );

        if (reachedScreening) screeningCount++;
        if (reachedInterview) interviewCount++;
        if (reachedOffer) offerCount++;
        if (status === 'accepted') acceptedCount++;
        if (status === 'rejected') rejectedCount++;

        const isTerminal = status === 'accepted' || status === 'rejected' || status === 'archived';
        if (!isTerminal && !isWishlist) {
            activeInFlightCount++;
        }

        // Cycle duration calculation
        const startDate = job.appliedAt || job.dateAdded || job.createdAt;
        if (startDate) {
            const startMs = parseDateSafe(startDate).getTime();
            if (isTerminal) {
                const endDate = job.resolvedAt || job.rejectedAt || job.acceptedDate || job.updatedAt || now;
                const endMs = parseDateSafe(endDate).getTime();
                if (endMs >= startMs) {
                    const days = Math.max(1, Math.round((endMs - startMs) / ONE_DAY_MS));
                    totalCycleDays += days;
                    cycleCount++;
                }
            }

            // Callback time (applied to screening or first interview)
            if (reachedScreening && (job.screeningDate || job.updatedAt)) {
                const callbackDate = job.screeningDate || job.updatedAt;
                const cbMs = parseDateSafe(callbackDate).getTime();
                if (cbMs >= startMs) {
                    const cbDays = Math.max(1, Math.round((cbMs - startMs) / ONE_DAY_MS));
                    totalCallbackDays += cbDays;
                    callbackCount++;
                }
            }

            // Weekly Bucket grouping
            if (!isWishlist) {
                const weekStart = startOfWeek(parseDateSafe(startDate), { weekStartsOn: 1 });
                const weekKey = format(weekStart, 'yyyy-MM-dd');
                if (!weeklyBuckets[weekKey]) {
                    weeklyBuckets[weekKey] = {
                        weekKey,
                        weekLabel: format(weekStart, 'MMM d'),
                        applied: 0,
                        screened: 0,
                        interviewed: 0,
                        offered: 0
                    };
                }
                weeklyBuckets[weekKey].applied++;
                if (reachedScreening) weeklyBuckets[weekKey].screened++;
                if (reachedInterview) weeklyBuckets[weekKey].interviewed++;
                if (reachedOffer) weeklyBuckets[weekKey].offered++;
            }
        }

        // Source breakdown
        const sourceName = normalizeJobSource(job);
        if (!sourceBuckets[sourceName]) {
            sourceBuckets[sourceName] = { source: sourceName, applied: 0, interviews: 0, offers: 0 };
        }
        if (!isWishlist) sourceBuckets[sourceName].applied++;
        if (reachedInterview) sourceBuckets[sourceName].interviews++;
        if (reachedOffer) sourceBuckets[sourceName].offers++;

        // Arrangement breakdown
        const arrName = normalizeWorkArrangement(job);
        if (!arrangementBuckets[arrName]) {
            arrangementBuckets[arrName] = { arrangement: arrName, applied: 0, interviews: 0, offers: 0 };
        }
        if (!isWishlist) arrangementBuckets[arrName].applied++;
        if (reachedInterview) arrangementBuckets[arrName].interviews++;
        if (reachedOffer) arrangementBuckets[arrName].offers++;
    }

    // 3. Candidate Rates & Percentages
    const screeningRate = totalApplied > 0 ? Math.round((screeningCount / totalApplied) * 1000) / 10 : 0;
    const screeningToInterviewRate = screeningCount > 0 ? Math.round((interviewCount / screeningCount) * 1000) / 10 : 0;
    const interviewToOfferRate = interviewCount > 0 ? Math.round((offerCount / interviewCount) * 1000) / 10 : 0;
    const overallOfferRate = totalApplied > 0 ? Math.round((offerCount / totalApplied) * 1000) / 10 : 0;

    const avgCycleDays = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount) : 0;
    const avgCallbackDays = callbackCount > 0 ? Math.round(totalCallbackDays / callbackCount) : 0;

    // 4. Metric Deltas vs. Industry Benchmark
    const b = benchmark.rates;
    const deltas = {
        screeningRate: Math.round((screeningRate - b.screeningRate) * 10) / 10,
        screeningToInterviewRate: Math.round((screeningToInterviewRate - b.screeningToInterviewRate) * 10) / 10,
        interviewToOfferRate: Math.round((interviewToOfferRate - b.interviewToOfferRate) * 10) / 10,
        overallOfferRate: Math.round((overallOfferRate - b.overallOfferRate) * 10) / 10,
        avgCycleDays: avgCycleDays > 0 ? avgCycleDays - b.avgCycleDays : 0,
        avgCallbackDays: avgCallbackDays > 0 ? avgCallbackDays - b.avgCallbackDays : 0
    };

    // Helper: evaluate performance tier
    const getTier = (userRate, benchmarkRate) => {
        const diff = userRate - benchmarkRate;
        if (diff >= 3.0) return 'outperforming';
        if (diff >= -2.0) return 'on_track';
        return 'needs_attention';
    };

    const tiers = {
        screening: getTier(screeningRate, b.screeningRate),
        screeningToInterview: getTier(screeningToInterviewRate, b.screeningToInterviewRate),
        interviewToOffer: getTier(interviewToOfferRate, b.interviewToOfferRate),
        overallOffer: getTier(overallOfferRate, b.overallOfferRate)
    };

    // 5. Weekly Volume Trajectory (Sorted chronologically)
    const weeklyTrends = Object.values(weeklyBuckets)
        .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

    // Calculate Week-over-Week velocity & rolling 4-week average
    let rollingSum = 0;
    const weeklyTrendsEnhanced = weeklyTrends.map((w, idx) => {
        rollingSum += w.applied;
        const countBack = Math.min(idx + 1, 4);
        if (idx >= 4) {
            rollingSum -= weeklyTrends[idx - 4].applied;
        }
        const rollingAvg = Math.round((rollingSum / countBack) * 10) / 10;
        const prevWeek = idx > 0 ? weeklyTrends[idx - 1].applied : w.applied;
        const wowGrowthPct = prevWeek > 0
            ? Math.round(((w.applied - prevWeek) / prevWeek) * 100)
            : 0;

        return {
            ...w,
            rollingAvg,
            wowGrowthPct,
            conversionPct: w.applied > 0 ? Math.round((w.interviewed / w.applied) * 100) : 0
        };
    });

    // 6. Channel / Source ROI Table
    const sourceComparison = Object.values(sourceBuckets)
        .filter(s => s.applied > 0)
        .map(s => ({
            ...s,
            interviewRate: Math.round((s.interviews / s.applied) * 1000) / 10,
            offerRate: Math.round((s.offers / s.applied) * 1000) / 10
        }))
        .sort((a, b) => b.interviews - a.interviews || b.applied - a.applied);

    // 7. Work Arrangement Breakdown
    const arrangementComparison = Object.values(arrangementBuckets)
        .filter(a => a.applied > 0)
        .map(a => ({
            ...a,
            interviewRate: Math.round((a.interviews / a.applied) * 1000) / 10,
            pctOfTotal: Math.round((a.applied / totalApplied) * 100)
        }))
        .sort((a, b) => b.applied - a.applied);

    // 8. Strategic Benchmark Diagnoses & Recommendations
    const recommendations = generateBenchmarkRecommendations({
        totalApplied,
        screeningRate,
        screeningToInterviewRate,
        interviewToOfferRate,
        overallOfferRate,
        benchmark: b,
        tiers,
        sourceComparison
    });

    return {
        benchmark,
        totalTracked,
        totalApplied,
        screeningCount,
        interviewCount,
        offerCount,
        acceptedCount,
        rejectedCount,
        activeInFlightCount,
        avgCycleDays,
        avgCallbackDays,
        userRates: {
            screeningRate,
            screeningToInterviewRate,
            interviewToOfferRate,
            overallOfferRate
        },
        benchmarkRates: b,
        deltas,
        tiers,
        weeklyTrends: weeklyTrendsEnhanced,
        sourceComparison,
        arrangementComparison,
        recommendations,
        hasData: totalApplied > 0
    };
}

/**
 * Generates tailored strategic recommendations comparing actual vs. benchmark metrics.
 */
function generateBenchmarkRecommendations({
    totalApplied,
    screeningRate,
    screeningToInterviewRate,
    interviewToOfferRate,
    overallOfferRate,
    benchmark,
    tiers,
    sourceComparison
}) {
    const list = [];

    if (totalApplied < 5) {
        list.push({
            id: 'volume_sample',
            tone: 'info',
            title: 'Sample Size Calibrating',
            description: `You have logged ${totalApplied} ${totalApplied === 1 ? 'application' : 'applications'}. Industry benchmark models become statistically predictive after 15–20 applications.`
        });
        return list;
    }

    // 1. Screening Bottleneck Analysis
    if (tiers.screening === 'needs_attention') {
        const diff = Math.abs(Math.round((screeningRate - benchmark.screeningRate) * 10) / 10);
        list.push({
            id: 'ats_optimization',
            tone: 'warning',
            title: `Resume Screen Bottleneck (${screeningRate}% vs ${benchmark.screeningRate}% Benchmark)`,
            description: `Your initial screening response rate is lagging the industry average by -${diff}%. Action: Calibrate your resume keywords against ATS requirements and focus applications within the first 48 hours of job postings.`
        });
    } else if (tiers.screening === 'outperforming') {
        list.push({
            id: 'strong_resume',
            tone: 'success',
            title: `Top-Tier Screening Velocity (${screeningRate}% vs ${benchmark.screeningRate}% Benchmark)`,
            description: `Your application-to-screening conversion is beating the industry average by +${Math.round((screeningRate - benchmark.screeningRate) * 10) / 10}%. Your resume positioning and qualifications are resonating strongly with recruiters.`
        });
    }

    // 2. Screening-to-Interview Loop Transition
    if (tiers.screeningToInterview === 'needs_attention' && screeningRate > 0) {
        const diff = Math.abs(Math.round((screeningToInterviewRate - benchmark.screeningToInterviewRate) * 10) / 10);
        list.push({
            id: 'phone_screen_transition',
            tone: 'warning',
            title: `Screen-to-Interview Drop-off (${screeningToInterviewRate}% vs ${benchmark.screeningToInterviewRate}% Benchmark)`,
            description: `Recruiters are reaching out, but progression to technical rounds is lagging by -${diff}%. Action: Polish your 2-minute introductory narrative, verify clear compensation alignment early, and review technical core fundamentals.`
        });
    } else if (tiers.screeningToInterview === 'outperforming') {
        list.push({
            id: 'strong_phone_screens',
            tone: 'success',
            title: `High Recruiter Screen Conversion (${screeningToInterviewRate}%)`,
            description: `You are consistently converting initial phone screens into full interview loops, exceeding industry standard (${benchmark.screeningToInterviewRate}%).`
        });
    }

    // 3. Interview Loop Conversion Analysis
    if (tiers.interviewToOffer === 'needs_attention') {
        list.push({
            id: 'interview_coaching',
            tone: 'accent',
            title: `Closing Loop Optimization (${interviewToOfferRate}% Offer Conversion)`,
            description: `You are securing interviews, but the final offer conversion is below the ${benchmark.interviewToOfferRate}% target. Action: Use the AI Career Coach to practice system design, STAR behavioral responses, and compensation negotiation.`
        });
    } else if (tiers.interviewToOffer === 'outperforming') {
        list.push({
            id: 'closing_mastery',
            tone: 'success',
            title: `Elite Interview-to-Offer Conversion (${interviewToOfferRate}%)`,
            description: `Your final loop closing rate is substantially higher than standard tech benchmarks. You excel in live interview interactions.`
        });
    }

    // 4. Overall Offer Pipeline Performance
    if (tiers.overallOffer === 'outperforming') {
        list.push({
            id: 'elite_pipeline',
            tone: 'success',
            title: `Exceptional Overall Offer Rate (${overallOfferRate}% vs ${benchmark.overallOfferRate}% Market Average)`,
            description: `Your end-to-end pipeline conversion from application to final offer is well above market baseline. You have established a strong competitive advantage in candidate positioning and interview execution.`
        });
    }

    // 3. Channel ROI Strategy
    if (sourceComparison.length >= 2) {
        const topSource = sourceComparison[0];
        if (topSource && topSource.interviewRate > screeningRate) {
            list.push({
                id: 'channel_roi',
                tone: 'info',
                title: `Channel ROI: Double Down on ${topSource.source}`,
                description: `${topSource.source} is your highest-performing channel with a ${topSource.interviewRate}% interview rate. Prioritizing this channel will yield more loops with less effort.`
            });
        }
    }

    return list;
}

function buildEmptyAnalytics(benchmark) {
    return {
        benchmark,
        totalTracked: 0,
        totalApplied: 0,
        screeningCount: 0,
        interviewCount: 0,
        offerCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        activeInFlightCount: 0,
        avgCycleDays: 0,
        avgCallbackDays: 0,
        userRates: {
            screeningRate: 0,
            screeningToInterviewRate: 0,
            interviewToOfferRate: 0,
            overallOfferRate: 0
        },
        benchmarkRates: benchmark.rates,
        deltas: {
            screeningRate: -benchmark.rates.screeningRate,
            screeningToInterviewRate: -benchmark.rates.screeningToInterviewRate,
            interviewToOfferRate: -benchmark.rates.interviewToOfferRate,
            overallOfferRate: -benchmark.rates.overallOfferRate,
            avgCycleDays: 0,
            avgCallbackDays: 0
        },
        tiers: {
            screening: 'needs_attention',
            screeningToInterview: 'needs_attention',
            interviewToOffer: 'needs_attention',
            overallOffer: 'needs_attention'
        },
        weeklyTrends: [],
        sourceComparison: [],
        arrangementComparison: [],
        recommendations: [
            {
                id: 'start_tracking',
                tone: 'info',
                title: 'Start Tracking Applications',
                description: 'Log your applications to see how your callback, interview, and offer rates compare against industry standards.'
            }
        ],
        hasData: false
    };
}

/**
 * Formats a clean, executive Markdown summary of the candidate's metrics vs. benchmarks.
 */
export function formatBenchmarkSummaryMarkdown(analytics) {
    if (!analytics) return '';
    const { userRates, benchmarkRates, deltas, benchmark, totalApplied, offerCount, interviewCount } = analytics;

    return [
        `# Career Pipeline & Industry Benchmark Analysis`,
        `**Benchmark Profile**: ${benchmark.label}`,
        `**Total Applications Tracked**: ${totalApplied} · **Interviews**: ${interviewCount} · **Offers**: ${offerCount}`,
        ``,
        `## Funnel Conversion vs. Industry Standard`,
        `| Funnel Stage | Your Rate | Industry Benchmark | Delta |`,
        `| :--- | :--- | :--- | :--- |`,
        `| **Screening Callback** | ${userRates.screeningRate}% | ${benchmarkRates.screeningRate}% | ${deltas.screeningRate >= 0 ? '+' : ''}${deltas.screeningRate}% |`,
        `| **Screening → Interview** | ${userRates.screeningToInterviewRate}% | ${benchmarkRates.screeningToInterviewRate}% | ${deltas.screeningToInterviewRate >= 0 ? '+' : ''}${deltas.screeningToInterviewRate}% |`,
        `| **Interview → Offer** | ${userRates.interviewToOfferRate}% | ${benchmarkRates.interviewToOfferRate}% | ${deltas.interviewToOfferRate >= 0 ? '+' : ''}${deltas.interviewToOfferRate}% |`,
        `| **Overall Success Rate** | ${userRates.overallOfferRate}% | ${benchmarkRates.overallOfferRate}% | ${deltas.overallOfferRate >= 0 ? '+' : ''}${deltas.overallOfferRate}% |`,
        ``,
        `*Generated by NovuJobs Executive Career Analytics on ${new Date().toLocaleDateString()}*`
    ].join('\n');
}
