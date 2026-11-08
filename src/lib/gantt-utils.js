/**
 * Application Gantt Chart & Pipeline Velocity Insights Engine
 *
 * Computes:
 * 1. Timeline durations, start/end dates, milestone markers, and stage spans per job
 * 2. Visual grid coordinates, time scales, and "Today" marker positioning
 * 3. Deep pipeline velocity analytics: cycle times, stage bottlenecks, ghost/follow-up radars
 * 4. Actionable diagnostic recommendations and 1-click clipboard Markdown export
 */

import { subDays } from 'date-fns';
import { safeDate } from './utils.js';

export const GANTT_STAGE_META = {
    wishlist: {
        id: 'wishlist',
        label: 'Wishlist',
        shortLabel: 'Wishlist',
        color: '#9DA7AE',
        bg: 'rgba(157, 167, 174, 0.2)',
        border: '#9DA7AE',
        isTerminal: false
    },
    applied: {
        id: 'applied',
        label: 'Applied',
        shortLabel: 'Applied',
        color: '#6B7E67',
        bg: 'rgba(107, 126, 103, 0.24)',
        border: '#6B7E67',
        isTerminal: false
    },
    screening: {
        id: 'screening',
        label: 'Initial Screening',
        shortLabel: 'Screening',
        color: '#0ea5e9',
        bg: 'rgba(14, 165, 233, 0.24)',
        border: '#0ea5e9',
        isTerminal: false
    },
    interviewing: {
        id: 'interviewing',
        label: 'Interviewing',
        shortLabel: 'Interviewing',
        color: '#D4A373',
        bg: 'rgba(212, 163, 115, 0.26)',
        border: '#D4A373',
        isTerminal: false
    },
    offer: {
        id: 'offer',
        label: 'Offer Received',
        shortLabel: 'Offer',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.26)',
        border: '#10b981',
        isTerminal: false
    },
    accepted: {
        id: 'accepted',
        label: 'Offer Accepted',
        shortLabel: 'Accepted',
        color: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.26)',
        border: '#22c55e',
        isTerminal: true
    },
    rejected: {
        id: 'rejected',
        label: 'Rejected',
        shortLabel: 'Rejected',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.22)',
        border: '#ef4444',
        isTerminal: true
    },
    archived: {
        id: 'archived',
        label: 'Archived',
        shortLabel: 'Archived',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.22)',
        border: '#94a3b8',
        isTerminal: true
    }
};

export const GANTT_TIME_RANGES = [
    { id: 'all', label: 'All Time', days: null },
    { id: '90d', label: '90D', days: 90 },
    { id: '30d', label: '30D', days: 30 },
    { id: '14d', label: '14D', days: 14 }
];

export const GANTT_STATUS_FILTERS = [
    { id: 'all', label: 'All Roles' },
    { id: 'active', label: 'Active Pipeline' },
    { id: 'interviews', label: 'Interviews & Offers' },
    { id: 'alerts', label: 'Follow-Up Needed' },
    { id: 'resolved', label: 'Resolved (Closed)' }
];

export const GANTT_SORT_OPTIONS = [
    { id: 'newest', label: 'Applied: Newest First' },
    { id: 'oldest', label: 'Applied: Oldest First' },
    { id: 'duration-desc', label: 'Duration: Longest Active' },
    { id: 'duration-asc', label: 'Duration: Shortest' },
    { id: 'urgency', label: 'Urgency: Alerts First' },
    { id: 'company', label: 'Company: Alphabetical' }
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalizes any timestamp, date object, or ISO string to a safe timestamp number.
 */
export function getSafeTimestamp(val, fallback = Date.now()) {
    if (!val) return fallback;
    if (typeof val === 'number' && !isNaN(val)) return val;
    const d = safeDate(val);
    const time = d.getTime();
    return isNaN(time) ? fallback : time;
}

/**
 * Calculates days difference between two timestamps (minimum 1 day).
 */
export function diffDays(startMs, endMs) {
    if (!startMs || !endMs || endMs < startMs) return 1;
    return Math.max(1, Math.round((endMs - startMs) / ONE_DAY_MS));
}

/**
 * Formats a ratio as a percentage.
 */
export function toPct(num, den) {
    if (!den || den <= 0 || !num || num <= 0) return 0;
    return Math.round((num / den) * 1000) / 10;
}

/**
 * Models and sanitizes a single job's timeline span, stage progression, and follow-up alert status.
 */
export function processJobGanttItem(job, nowMs = Date.now()) {
    if (!job || job.status === 'deleted') return null;

    const status = GANTT_STAGE_META[job.status] ? job.status : 'wishlist';
    const meta = GANTT_STAGE_META[status];
    const previousStatus = job.previousStatus || null;
    const isTerminal = meta.isTerminal;
    const isActive = !isTerminal && status !== 'wishlist';

    // 1. Establish start date
    const rawStart = job.appliedAt || job.dateAdded || job.createdAt || job.pubDate;
    const startMs = getSafeTimestamp(rawStart, nowMs);

    // 2. Establish end date
    let endMs = nowMs;
    if (isTerminal) {
        const rawEnd = job.resolvedAt || job.acceptedDate || job.rejectedAt || job.closedAt || job.updatedAt || job.archivedAt || job.deletedAt;
        if (rawEnd) {
            const parsedEnd = getSafeTimestamp(rawEnd, startMs + ONE_DAY_MS);
            endMs = Math.max(startMs + ONE_DAY_MS, parsedEnd);
        } else {
            endMs = startMs + ONE_DAY_MS;
        }
    } else {
        endMs = Math.max(startMs + ONE_DAY_MS, nowMs);
    }

    const durationDays = diffDays(startMs, endMs);

    // 3. Stage duration & last activity
    let latestInterviewMs = 0;
    if (Array.isArray(job.interviews)) {
        for (const inv of job.interviews) {
            const invDate = inv?.date || inv?.dateTime || inv;
            const invMs = getSafeTimestamp(invDate, 0);
            if (invMs > latestInterviewMs) latestInterviewMs = invMs;
        }
    }
    const activityCandidates = [
        getSafeTimestamp(job.lastInteraction, 0),
        getSafeTimestamp(job.lastActivity, 0),
        getSafeTimestamp(job.offerDate, 0),
        getSafeTimestamp(job.updatedAt, 0),
        latestInterviewMs,
        getSafeTimestamp(job.appliedAt, 0),
        startMs
    ];
    const lastActivityMs = Math.max(...activityCandidates.filter(t => t > 0));
    const daysSinceActivity = Math.max(0, Math.floor((nowMs - lastActivityMs) / ONE_DAY_MS));
    const daysSinceApplied = Math.max(0, Math.floor((nowMs - startMs) / ONE_DAY_MS));

    // 4. Alert & Follow-Up Diagnostic Classification
    let alertType = 'healthy';
    let isAlert = false;
    let alertDays = daysSinceActivity;
    let alertLabel = 'Active & Healthy';

    if (isActive) {
        if (daysSinceActivity >= 10) {
            alertType = 'ghost';
            isAlert = true;
            alertDays = daysSinceActivity;
            alertLabel = `Stalled / Ghost Alert (${alertDays}d)`;
        } else if (daysSinceActivity >= 5) {
            alertType = 'followup';
            isAlert = true;
            alertDays = daysSinceActivity;
            alertLabel = `Follow-Up Window (${alertDays}d)`;
        }
    }

    // 5. Milestone Markers
    const milestones = [];
    milestones.push({
        id: 'applied',
        type: 'applied',
        dateMs: startMs,
        label: 'Applied',
        color: '#6B7E67'
    });

    if (status === 'interviewing' || previousStatus === 'interviewing' || status === 'offer' || status === 'accepted') {
        const interviewMs = job.updatedAt && !isTerminal
            ? getSafeTimestamp(job.updatedAt, startMs)
            : startMs + Math.min(endMs - startMs, Math.floor((endMs - startMs) * 0.5));
        milestones.push({
            id: 'interview',
            type: 'interview',
            dateMs: interviewMs,
            label: 'Interview',
            color: '#D4A373'
        });
    }

    if (status === 'offer' || status === 'accepted' || previousStatus === 'offer') {
        const offerMs = status === 'offer' && job.updatedAt
            ? getSafeTimestamp(job.updatedAt, endMs)
            : endMs;
        milestones.push({
            id: 'offer',
            type: 'offer',
            dateMs: offerMs,
            label: 'Offer',
            color: '#10b981'
        });
    }

    if (isTerminal) {
        milestones.push({
            id: 'resolved',
            type: 'resolved',
            status,
            dateMs: endMs,
            label: meta.label,
            color: meta.color
        });
    }

    return {
        id: job.id,
        rawJob: job,
        company: job.company || 'Unknown Company',
        role: job.role || job.title || 'Untitled Role',
        status,
        previousStatus,
        stageLabel: meta.label,
        shortStageLabel: meta.shortLabel,
        stageColor: meta.color,
        stageBg: meta.bg,
        stageBorder: meta.border,
        isTerminal,
        isActive,
        startMs,
        endMs,
        durationDays,
        lastActivityMs,
        daysSinceActivity,
        daysSinceApplied,
        alertType,
        isAlert,
        alertDays,
        alertLabel,
        salary: job.salary || null,
        location: job.location || null,
        url: job.url || job.link || null,
        notes: job.notes || null,
        resumeName: job.resumeName || null,
        milestones
    };
}

/**
 * Computes deep pipeline velocity analytics, cycle durations, bottleneck diagnostics,
 * and high-impact strategic insights across all tracked applications.
 */
export function calculateGanttInsights(ganttItems) {
    if (!Array.isArray(ganttItems) || ganttItems.length === 0) {
        return {
            totalTracked: 0,
            activeCount: 0,
            resolvedCount: 0,
            wishlistCount: 0,
            ghostAlertCount: 0,
            followupCount: 0,
            healthyCount: 0,
            avgCycleDays: 0,
            avgActiveCycleDays: 0,
            avgResolvedCycleDays: 0,
            avgCallbackVelocityDays: 0,
            avgInterviewVelocityDays: 0,
            fastestRole: null,
            longestInFlightRole: null,
            stageAverages: {
                applied: 0,
                screening: 0,
                interviewing: 0,
                offer: 0
            },
            stageDistribution: [],
            alertsList: [],
            actionableRecommendations: [
                {
                    tone: 'info',
                    title: 'Start Tracking Applications',
                    description: 'Log jobs from LinkedIn, Indeed, or company career pages to unlock live timeline tracking and velocity benchmarks.'
                }
            ]
        };
    }

    let activeCount = 0;
    let resolvedCount = 0;
    let wishlistCount = 0;
    let ghostAlertCount = 0;
    let followupCount = 0;
    let healthyCount = 0;

    let totalDurationSum = 0;
    let activeDurationSum = 0;
    let resolvedDurationSum = 0;

    const callbackDurations = [];
    const interviewDurations = [];
    const stageDurations = {
        wishlist: [],
        applied: [],
        screening: [],
        interviewing: [],
        offer: [],
        accepted: [],
        rejected: [],
        archived: []
    };

    let fastestRole = null;
    let longestInFlightRole = null;
    const alertsList = [];

    for (const item of ganttItems) {
        totalDurationSum += item.durationDays;

        if (stageDurations[item.status]) {
            stageDurations[item.status].push(item.durationDays);
        }

        if (item.status === 'wishlist') {
            wishlistCount++;
            continue;
        }

        if (item.isActive) {
            activeCount++;
            activeDurationSum += item.durationDays;

            if (item.alertType === 'ghost') {
                ghostAlertCount++;
                alertsList.push(item);
            } else if (item.alertType === 'followup') {
                followupCount++;
                alertsList.push(item);
            } else {
                healthyCount++;
            }

            if (!longestInFlightRole || item.durationDays > longestInFlightRole.durationDays) {
                longestInFlightRole = item;
            }
        } else if (item.isTerminal) {
            resolvedCount++;
            resolvedDurationSum += item.durationDays;

            if (item.status === 'accepted' || item.status === 'offer') {
                if (!fastestRole || item.durationDays < fastestRole.durationDays) {
                    fastestRole = item;
                }
            }
        }

        // Measure callback velocity for roles that reached screening/interviewing/offer
        if (['screening', 'interviewing', 'offer', 'accepted'].includes(item.status) ||
            ['screening', 'interviewing', 'offer'].includes(item.previousStatus)) {
            callbackDurations.push(item.durationDays);
        }

        // Measure interview loop duration
        if (['interviewing', 'offer', 'accepted'].includes(item.status) ||
            item.previousStatus === 'interviewing') {
            interviewDurations.push(item.durationDays);
        }
    }

    const submittedCount = activeCount + resolvedCount;
    const avgCycleDays = submittedCount > 0 ? Math.round((totalDurationSum / submittedCount) * 10) / 10 : 0;
    const avgActiveCycleDays = activeCount > 0 ? Math.round((activeDurationSum / activeCount) * 10) / 10 : 0;
    const avgResolvedCycleDays = resolvedCount > 0 ? Math.round((resolvedDurationSum / resolvedCount) * 10) / 10 : 0;

    const avgCallbackVelocityDays = callbackDurations.length > 0
        ? Math.round((callbackDurations.reduce((a, b) => a + b, 0) / callbackDurations.length) * 10) / 10
        : 0;

    const avgInterviewVelocityDays = interviewDurations.length > 0
        ? Math.round((interviewDurations.reduce((a, b) => a + b, 0) / interviewDurations.length) * 10) / 10
        : 0;

    const mean = (arr) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

    const stageAverages = {
        applied: mean(stageDurations.applied),
        screening: mean(stageDurations.screening),
        interviewing: mean(stageDurations.interviewing),
        offer: mean(stageDurations.offer)
    };

    // Stage Distribution Bars
    const stageDistribution = [
        {
            stage: 'applied',
            label: 'Applied (Awaiting)',
            count: stageDurations.applied.length,
            avgDays: stageAverages.applied,
            color: GANTT_STAGE_META.applied.color
        },
        {
            stage: 'screening',
            label: 'Initial Screening',
            count: stageDurations.screening.length,
            avgDays: stageAverages.screening,
            color: GANTT_STAGE_META.screening.color
        },
        {
            stage: 'interviewing',
            label: 'Interviewing Loop',
            count: stageDurations.interviewing.length,
            avgDays: stageAverages.interviewing,
            color: GANTT_STAGE_META.interviewing.color
        },
        {
            stage: 'offer',
            label: 'Offer Stage',
            count: stageDurations.offer.length,
            avgDays: stageAverages.offer,
            color: GANTT_STAGE_META.offer.color
        }
    ];

    // Build Actionable Strategic Recommendations
    const actionableRecommendations = [];

    if (ghostAlertCount > 0) {
        actionableRecommendations.push({
            id: 'ghost-roles',
            tone: 'warning',
            title: `${ghostAlertCount} Stalled ${ghostAlertCount === 1 ? 'Role' : 'Roles'} (10+ Days No Activity)`,
            description: `Applications at ${alertsList.filter(a => a.alertType === 'ghost').slice(0, 2).map(a => a.company).join(', ')}${ghostAlertCount > 2 ? ' and others' : ''} have gone quiet for 10+ days. Send a polite recruiter check-in or archive them to keep your active pipeline clean.`
        });
    }

    if (followupCount > 0) {
        actionableRecommendations.push({
            id: 'followup-roles',
            tone: 'accent',
            title: `${followupCount} Optimal Follow-Up ${followupCount === 1 ? 'Window' : 'Windows'} (5–9 Days)`,
            description: `Now is the prime window to send a brief, value-add follow-up note to recruiter contacts at ${alertsList.filter(a => a.alertType === 'followup').slice(0, 2).map(a => a.company).join(', ')}.`
        });
    }

    if (avgInterviewVelocityDays > 0) {
        actionableRecommendations.push({
            id: 'interview-velocity',
            tone: 'success',
            title: `Active Interview Velocity: ~${avgInterviewVelocityDays} Days Cycle`,
            description: `Your interview loops average ${avgInterviewVelocityDays} days from initiation to conclusion. Maintain 3–5 active early-stage applications to ensure consistent momentum.`
        });
    } else if (submittedCount > 0 && activeCount > 0) {
        actionableRecommendations.push({
            id: 'pipeline-cadence',
            tone: 'info',
            title: `Pipeline Cadence: ${activeCount} Roles In-Flight`,
            description: `Average time in-flight is currently ${avgActiveCycleDays} days. Log application feedback as recruiters reply to automatically update pipeline velocity.`
        });
    }

    return {
        totalTracked: ganttItems.length,
        submittedCount,
        activeCount,
        resolvedCount,
        wishlistCount,
        ghostAlertCount,
        followupCount,
        healthyCount,
        avgCycleDays,
        avgActiveCycleDays,
        avgResolvedCycleDays,
        avgCallbackVelocityDays,
        avgInterviewVelocityDays,
        fastestRole,
        longestInFlightRole,
        stageAverages,
        stageDistribution,
        alertsList,
        actionableRecommendations
    };
}

/**
 * Builds the complete Gantt Chart layout, calculating time domains, horizontal column ticks,
 * today indicator position, and item coordinates.
 */
export function buildGanttChartData(jobs, options = {}) {
    const {
        range = 'all',
        statusFilter = 'all',
        searchQuery = '',
        sortBy = 'newest',
        nowMs = Date.now()
    } = options;

    if (!Array.isArray(jobs) || jobs.length === 0) {
        return {
            items: [],
            columns: [],
            insights: calculateGanttInsights([], nowMs),
            minTimeMs: nowMs - 14 * ONE_DAY_MS,
            maxTimeMs: nowMs,
            todayPercent: 100,
            hasData: false,
            totalVisible: 0
        };
    }

    // 1. Process all active items
    const allProcessed = jobs
        .map(j => processJobGanttItem(j, nowMs))
        .filter(Boolean);

    // 2. Apply range cutoff if specified
    const rangeObj = GANTT_TIME_RANGES.find(r => r.id === range);
    const rangeCutoffMs = rangeObj?.days ? subDays(new Date(nowMs), rangeObj.days).getTime() : null;

    let filtered = allProcessed;
    if (rangeCutoffMs !== null) {
        filtered = filtered.filter(item => item.endMs >= rangeCutoffMs || item.startMs >= rangeCutoffMs);
    }

    // 3. Apply status / category filter
    if (statusFilter === 'active') {
        filtered = filtered.filter(item => item.isActive);
    } else if (statusFilter === 'interviews') {
        filtered = filtered.filter(item => ['interviewing', 'offer'].includes(item.status) || item.previousStatus === 'interviewing');
    } else if (statusFilter === 'alerts') {
        filtered = filtered.filter(item => item.isAlert);
    } else if (statusFilter === 'resolved') {
        filtered = filtered.filter(item => item.isTerminal);
    }

    // 4. Apply text search query
    if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(item =>
            item.company.toLowerCase().includes(q) ||
            item.role.toLowerCase().includes(q) ||
            (item.location && item.location.toLowerCase().includes(q)) ||
            (item.notes && item.notes.toLowerCase().includes(q))
        );
    }

    // 5. Apply sorting
    filtered.sort((a, b) => {
        if (sortBy === 'newest') return b.startMs - a.startMs;
        if (sortBy === 'oldest') return a.startMs - b.startMs;
        if (sortBy === 'duration-desc') return b.durationDays - a.durationDays;
        if (sortBy === 'duration-asc') return a.durationDays - b.durationDays;
        if (sortBy === 'urgency') {
            const urgencyWeight = (item) => item.alertType === 'ghost' ? 3 : item.alertType === 'followup' ? 2 : 1;
            return urgencyWeight(b) - urgencyWeight(a) || b.durationDays - a.durationDays;
        }
        if (sortBy === 'company') return a.company.localeCompare(b.company);
        return b.startMs - a.startMs;
    });

    // 6. Compute global insights over the entire relevant dataset
    const insights = calculateGanttInsights(allProcessed, nowMs);

    if (filtered.length === 0) {
        return {
            items: [],
            columns: [],
            insights,
            minTimeMs: nowMs - 14 * ONE_DAY_MS,
            maxTimeMs: nowMs,
            todayPercent: 100,
            hasData: false,
            totalVisible: 0
        };
    }

    // 7. Establish timeline boundaries
    let minTimeMs = Math.min(...filtered.map(i => i.startMs));
    let maxTimeMs = Math.max(...filtered.map(i => i.endMs), nowMs);

    // Give a 3% padding on either side for readability
    const rawSpan = Math.max(ONE_DAY_MS * 7, maxTimeMs - minTimeMs);
    minTimeMs = minTimeMs - Math.floor(rawSpan * 0.02);
    maxTimeMs = maxTimeMs + Math.floor(rawSpan * 0.02);
    const totalSpanMs = maxTimeMs - minTimeMs;

    // 8. Generate date column ticks (adaptive to total span: Days, Weeks, or Months)
    const columns = [];
    const spanDays = Math.ceil(totalSpanMs / ONE_DAY_MS);
    let stepDays = 1;
    if (spanDays > 120) stepDays = 30; // Months
    else if (spanDays > 45) stepDays = 7; // Weeks
    else if (spanDays > 20) stepDays = 3;
    else stepDays = 1;

    const startD = new Date(minTimeMs);
    startD.setHours(0, 0, 0, 0);

    let curMs = startD.getTime();
    while (curMs <= maxTimeMs) {
        const leftPct = ((curMs - minTimeMs) / totalSpanMs) * 100;
        if (leftPct >= 0 && leftPct <= 100) {
            const dateObj = new Date(curMs);
            const label = spanDays > 120
                ? dateObj.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                : dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            columns.push({
                timeMs: curMs,
                leftPct,
                label
            });
        }
        curMs += stepDays * ONE_DAY_MS;
    }

    // "Today" position indicator
    const todayPercent = Math.min(100, Math.max(0, ((nowMs - minTimeMs) / totalSpanMs) * 100));

    // 9. Position horizontal Gantt bars and milestones for each row
    const items = filtered.map(item => {
        const leftPct = Math.min(99, Math.max(0, ((item.startMs - minTimeMs) / totalSpanMs) * 100));
        const rawRightPct = Math.min(100, Math.max(0, ((item.endMs - minTimeMs) / totalSpanMs) * 100));
        const widthPct = Math.max(1.8, rawRightPct - leftPct);

        const positionedMilestones = item.milestones.map(m => ({
            ...m,
            posPct: Math.min(100, Math.max(0, ((m.dateMs - minTimeMs) / totalSpanMs) * 100))
        }));

        return {
            ...item,
            leftPct,
            widthPct,
            positionedMilestones
        };
    });

    return {
        items,
        columns,
        insights,
        minTimeMs,
        maxTimeMs,
        totalSpanMs,
        todayPercent,
        hasData: items.length > 0,
        totalVisible: items.length
    };
}

/**
 * Generates clean, copyable Markdown of the user's Gantt timeline and velocity insights.
 */
export function formatGanttInsightsMarkdown(insights) {
    if (!insights || insights.totalTracked === 0) {
        return 'Gantt Pipeline Velocity Summary: No active applications recorded yet.';
    }

    const lines = [
        `⏱️ **Job Search Gantt Pipeline Velocity & Timeline Insights**`,
        `- **Active In-Flight Pipeline:** ${insights.activeCount} roles (${insights.avgActiveCycleDays} days average in-flight)`,
        `- **Resolved Applications:** ${insights.resolvedCount} completed (${insights.avgResolvedCycleDays} days average cycle)`,
        `- **Callback / Screening Velocity:** ~${insights.avgCallbackVelocityDays} days to first response`,
        `- **Follow-Up Radar:** ${insights.followupCount} in follow-up window (5–9d) · ${insights.ghostAlertCount} stalled/ghost alerts (10+d)`,
        `- **Fastest Progressing Role:** ${insights.fastestRole ? `${insights.fastestRole.company} (${insights.fastestRole.role}) in ${insights.fastestRole.durationDays}d` : 'None recorded yet'}`,
        `- **Longest In-Flight Role:** ${insights.longestInFlightRole ? `${insights.longestInFlightRole.company} (${insights.longestInFlightRole.role}) at ${insights.longestInFlightRole.durationDays}d` : 'None recorded yet'}`
    ];

    if (insights.actionableRecommendations?.length > 0) {
        lines.push(`\n**Actionable Recommendations:**`);
        insights.actionableRecommendations.forEach(rec => {
            lines.push(`- **${rec.title}**: ${rec.description}`);
        });
    }

    return lines.join('\n');
}
