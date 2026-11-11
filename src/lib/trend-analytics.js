import { startOfWeek, addWeeks, format, isValid } from 'date-fns';
import { safeDate } from './utils.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const TREND_WINDOW_OPTIONS = [
    { id: '7d', label: 'Last 7d vs prior 7d', shortLabel: '7d', days: 7 },
    { id: '14d', label: 'Last 14d vs prior 14d', shortLabel: '14d', days: 14 },
    { id: '30d', label: 'Last 30d vs prior 30d', shortLabel: '30d', days: 30 }
];

function round1(val) {
    return Math.round(val * 10) / 10;
}

function classifyJobOutcome(job) {
    const status = job?.status || 'applied';
    const isWishlist = status === 'wishlist';

    const reachedScreening = Boolean(
        status === 'screening' ||
        status === 'interviewing' ||
        status === 'offer' ||
        status === 'accepted' ||
        (job?.previousStatus && ['screening', 'interviewing', 'offer'].includes(job.previousStatus)) ||
        (Array.isArray(job?.interviews) && job.interviews.length > 0)
    );

    const reachedInterview = Boolean(
        status === 'interviewing' ||
        status === 'offer' ||
        status === 'accepted' ||
        (job?.previousStatus && ['interviewing', 'offer'].includes(job.previousStatus)) ||
        (Array.isArray(job?.interviews) && job.interviews.length > 0)
    );

    const reachedOffer = Boolean(
        status === 'offer' ||
        status === 'accepted' ||
        job?.offerDate
    );

    const isEarlyRejected = status === 'rejected' && !reachedScreening;

    return {
        isWishlist,
        reachedScreening,
        reachedInterview,
        reachedOffer,
        isEarlyRejected
    };
}

function getJobTimestampMs(job) {
    const raw = job?.appliedAt || job?.dateAdded || job?.createdAt;
    if (!raw) return NaN;
    const d = safeDate(raw);
    const ms = d.getTime();
    return isNaN(ms) ? NaN : ms;
}

function summarizeCohort(jobs = []) {
    let appliedCount = 0;
    let screeningCount = 0;
    let interviewCount = 0;
    let offerCount = 0;
    let earlyRejectedCount = 0;
    let callbackTotalDays = 0;
    let callbackSampleCount = 0;

    for (const job of jobs) {
        if (!job || job.status === 'deleted') continue;
        const outcome = classifyJobOutcome(job);
        if (outcome.isWishlist) continue;

        appliedCount++;
        if (outcome.reachedScreening) screeningCount++;
        if (outcome.reachedInterview) interviewCount++;
        if (outcome.reachedOffer) offerCount++;
        if (outcome.isEarlyRejected) earlyRejectedCount++;

        if (outcome.reachedScreening && (job.screeningDate || job.updatedAt)) {
            const startMs = getJobTimestampMs(job);
            const cbMs = safeDate(job.screeningDate || job.updatedAt).getTime();
            if (!isNaN(startMs) && !isNaN(cbMs) && cbMs >= startMs) {
                const days = Math.max(1, Math.round((cbMs - startMs) / ONE_DAY_MS));
                callbackTotalDays += days;
                callbackSampleCount++;
            }
        }
    }

    return {
        appliedCount,
        screeningCount,
        interviewCount,
        offerCount,
        earlyRejectedCount,
        callbackSampleCount,
        screeningRate: appliedCount > 0 ? round1((screeningCount / appliedCount) * 100) : null,
        interviewRate: appliedCount > 0 ? round1((interviewCount / appliedCount) * 100) : null,
        screenToInterviewRate: screeningCount > 0 ? round1((interviewCount / screeningCount) * 100) : null,
        earlyRejectionRate: appliedCount > 0 ? round1((earlyRejectedCount / appliedCount) * 100) : null,
        avgCallbackDays: callbackSampleCount > 0 ? round1(callbackTotalDays / callbackSampleCount) : null
    };
}

function formatMetricValue(value, unit) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    if (unit === '%') return `${value}%`;
    if (unit === 'd') return `${value}d`;
    return `${value}`;
}

function formatMetricDelta(delta, unit) {
    if (delta === null || delta === undefined || isNaN(delta)) return '—';
    const sign = delta > 0 ? '+' : '';
    if (unit === '%') return `${sign}${delta} pp`;
    if (unit === 'd') return `${sign}${delta}d`;
    return `${sign}${delta}`;
}

function evaluateMetricTrend({
    id,
    label,
    description,
    unit,
    higherIsBetter,
    recentValue,
    priorValue,
    recentSampleCount,
    priorSampleCount,
    minSamples = 2,
    steadyThreshold = 0.5,
    sparkline = []
}) {
    const hasEnoughData = (
        recentValue !== null &&
        priorValue !== null &&
        recentSampleCount >= minSamples &&
        priorSampleCount >= minSamples
    );

    const delta = (recentValue !== null && priorValue !== null)
        ? round1(recentValue - priorValue)
        : null;

    let status = 'insufficient';
    if (hasEnoughData && delta !== null) {
        if (Math.abs(delta) < steadyThreshold) {
            status = 'steady';
        } else {
            const improved = higherIsBetter ? delta > 0 : delta < 0;
            status = improved ? 'improving' : 'declining';
        }
    }

    const statusLabel = status === 'improving'
        ? 'Improving'
        : status === 'declining'
            ? 'Watch'
            : status === 'steady'
                ? 'Steady'
                : 'Building baseline';

    return {
        id,
        label,
        description,
        unit,
        higherIsBetter,
        recentValue,
        priorValue,
        recentFormatted: formatMetricValue(recentValue, unit),
        priorFormatted: formatMetricValue(priorValue, unit),
        delta,
        deltaFormatted: formatMetricDelta(delta, unit),
        recentSampleCount,
        priorSampleCount,
        status,
        statusLabel,
        sparkline
    };
}

function buildWeeklySeries(validSubmittedJobs = [], nowDate = new Date(), maxWeeks = 8) {
    if (validSubmittedJobs.length === 0) return [];

    const datedJobs = validSubmittedJobs
        .map(job => ({ job, ms: getJobTimestampMs(job) }))
        .filter(item => !isNaN(item.ms))
        .sort((a, b) => a.ms - b.ms);

    if (datedJobs.length === 0) return [];

    const lastWeekStart = startOfWeek(nowDate, { weekStartsOn: 1 });
    const earliestJobWeek = startOfWeek(new Date(datedJobs[0].ms), { weekStartsOn: 1 });
    const earliestAllowedWeek = addWeeks(lastWeekStart, -(maxWeeks - 1));
    const gridStartWeek = earliestJobWeek.getTime() > earliestAllowedWeek.getTime()
        ? earliestJobWeek
        : earliestAllowedWeek;

    const bucketMap = new Map();
    let cursor = gridStartWeek;
    while (cursor.getTime() <= lastWeekStart.getTime()) {
        if (isValid(cursor)) {
            const key = format(cursor, 'yyyy-MM-dd');
            bucketMap.set(key, {
                weekKey: key,
                weekLabel: format(cursor, 'MMM d'),
                jobs: []
            });
        }
        cursor = addWeeks(cursor, 1);
    }

    for (const item of datedJobs) {
        const ws = startOfWeek(new Date(item.ms), { weekStartsOn: 1 });
        const key = format(ws, 'yyyy-MM-dd');
        const bucket = bucketMap.get(key);
        if (bucket) {
            bucket.jobs.push(item.job);
        }
    }

    return Array.from(bucketMap.values()).map(bucket => {
        const summary = summarizeCohort(bucket.jobs);
        return {
            weekKey: bucket.weekKey,
            weekLabel: bucket.weekLabel,
            applied: summary.appliedCount,
            screening: summary.screeningCount,
            interviewing: summary.interviewCount,
            offers: summary.offerCount,
            earlyRejected: summary.earlyRejectedCount,
            screeningRate: summary.screeningRate ?? 0,
            interviewRate: summary.interviewRate ?? 0,
            screenToInterviewRate: summary.screenToInterviewRate ?? 0,
            earlyRejectionRate: summary.earlyRejectionRate ?? 0,
            avgCallbackDays: summary.avgCallbackDays
        };
    });
}

function buildMomentumSummary(metrics, windowOption) {
    const improving = metrics.filter(m => m.status === 'improving');
    const declining = metrics.filter(m => m.status === 'declining');
    const steady = metrics.filter(m => m.status === 'steady');
    const insufficient = metrics.filter(m => m.status === 'insufficient');

    let verdict = 'Building Baseline';
    let tone = 'neutral';
    if (improving.length > declining.length) {
        verdict = 'Improving Trend';
        tone = 'positive';
    } else if (declining.length > improving.length) {
        verdict = 'Needs Calibration';
        tone = 'warning';
    } else if (improving.length > 0 && improving.length === declining.length) {
        verdict = 'Mixed Signals';
        tone = 'neutral';
    } else if (steady.length > 0) {
        verdict = 'Holding Steady';
        tone = 'neutral';
    }

    const parts = [];
    if (improving.length > 0) {
        const top = improving[0];
        parts.push(`${top.label} improved (${top.recentFormatted} vs ${top.priorFormatted}, ${top.deltaFormatted})`);
    }
    if (declining.length > 0) {
        const watch = declining[0];
        parts.push(`${watch.label} dipped (${watch.recentFormatted} vs ${watch.priorFormatted}, ${watch.deltaFormatted})`);
    }

    const headline = parts.length > 0
        ? `Over the ${windowOption.label.toLowerCase()}: ${parts.join('; ')}.`
        : `Comparing your ${windowOption.label.toLowerCase()}. Keep logging applications and updates to unlock directional deltas across all metrics.`;

    return {
        verdict,
        tone,
        headline,
        counts: {
            improving: improving.length,
            declining: declining.length,
            steady: steady.length,
            insufficient: insufficient.length
        }
    };
}

/**
 * Computes multi-metric recent momentum vs the immediately preceding equal window,
 * alongside chronological weekly trend series for visual inspection.
 */
export function computeMetricsTrendAnalysis(jobs = [], options = {}) {
    const windowOption = TREND_WINDOW_OPTIONS.find(w => w.id === options.windowId) || TREND_WINDOW_OPTIONS[1];
    const nowDate = options.now ? safeDate(options.now) : new Date();
    const nowMs = nowDate.getTime();
    const recentStartMs = nowMs - windowOption.days * ONE_DAY_MS;
    const priorStartMs = nowMs - 2 * windowOption.days * ONE_DAY_MS;

    const submittedJobs = Array.isArray(jobs)
        ? jobs.filter(j => j && j.status !== 'deleted' && j.status !== 'wishlist')
        : [];

    const recentJobs = [];
    const priorJobs = [];

    for (const job of submittedJobs) {
        const ms = getJobTimestampMs(job);
        if (isNaN(ms) || ms > nowMs) continue;
        if (ms >= recentStartMs) {
            recentJobs.push(job);
        } else if (ms >= priorStartMs) {
            priorJobs.push(job);
        }
    }

    const recentStats = summarizeCohort(recentJobs);
    const priorStats = summarizeCohort(priorJobs);
    const weeklySeries = buildWeeklySeries(submittedJobs, nowDate, options.maxWeeks || 8);

    const metrics = [
        evaluateMetricTrend({
            id: 'application_volume',
            label: 'Application Volume',
            description: `Submitted apps in ${windowOption.shortLabel} window`,
            unit: 'apps',
            higherIsBetter: true,
            recentValue: recentStats.appliedCount,
            priorValue: priorStats.appliedCount,
            recentSampleCount: recentStats.appliedCount,
            priorSampleCount: priorStats.appliedCount,
            minSamples: 1,
            steadyThreshold: 1,
            sparkline: weeklySeries.map(w => w.applied)
        }),
        evaluateMetricTrend({
            id: 'screening_rate',
            label: 'Callback / Screen Rate',
            description: 'Apps reaching recruiter screen or beyond',
            unit: '%',
            higherIsBetter: true,
            recentValue: recentStats.screeningRate,
            priorValue: priorStats.screeningRate,
            recentSampleCount: recentStats.appliedCount,
            priorSampleCount: priorStats.appliedCount,
            minSamples: 3,
            steadyThreshold: 0.5,
            sparkline: weeklySeries.map(w => w.screeningRate)
        }),
        evaluateMetricTrend({
            id: 'interview_rate',
            label: 'Interview Conversion',
            description: 'Apps advancing to active interview loop',
            unit: '%',
            higherIsBetter: true,
            recentValue: recentStats.interviewRate,
            priorValue: priorStats.interviewRate,
            recentSampleCount: recentStats.appliedCount,
            priorSampleCount: priorStats.appliedCount,
            minSamples: 3,
            steadyThreshold: 0.5,
            sparkline: weeklySeries.map(w => w.interviewRate)
        }),
        evaluateMetricTrend({
            id: 'screen_to_interview_rate',
            label: 'Screen → Interview',
            description: 'Recruiter screens advancing to interviews',
            unit: '%',
            higherIsBetter: true,
            recentValue: recentStats.screenToInterviewRate,
            priorValue: priorStats.screenToInterviewRate,
            recentSampleCount: recentStats.screeningCount,
            priorSampleCount: priorStats.screeningCount,
            minSamples: 2,
            steadyThreshold: 1.0,
            sparkline: weeklySeries.map(w => w.screenToInterviewRate)
        }),
        evaluateMetricTrend({
            id: 'early_rejection_rate',
            label: 'Resume Rejection Rate',
            description: 'Rejected before initial screen (lower is better)',
            unit: '%',
            higherIsBetter: false,
            recentValue: recentStats.earlyRejectionRate,
            priorValue: priorStats.earlyRejectionRate,
            recentSampleCount: recentStats.appliedCount,
            priorSampleCount: priorStats.appliedCount,
            minSamples: 3,
            steadyThreshold: 0.5,
            sparkline: weeklySeries.map(w => w.earlyRejectionRate)
        }),
        evaluateMetricTrend({
            id: 'callback_speed',
            label: 'Avg Response Time',
            description: 'Days from applying to first response (faster is better)',
            unit: 'd',
            higherIsBetter: false,
            recentValue: recentStats.avgCallbackDays,
            priorValue: priorStats.avgCallbackDays,
            recentSampleCount: recentStats.callbackSampleCount,
            priorSampleCount: priorStats.callbackSampleCount,
            minSamples: 2,
            steadyThreshold: 0.5,
            sparkline: weeklySeries.map(w => w.avgCallbackDays ?? 0)
        })
    ];

    const summary = buildMomentumSummary(metrics, windowOption);

    return {
        window: windowOption,
        recentStats,
        priorStats,
        weeklySeries,
        metrics,
        summary
    };
}
