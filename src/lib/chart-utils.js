/**
 * Utilities for the Application History & Goal Progression Chart.
 * Computes time-series aggregations across daily, weekly, and monthly granularities,
 * automatically aligning the x-axis with the user's active application goal cadence.
 */

import {
    format,
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    eachWeekOfInterval,
    eachMonthOfInterval,
    subDays,
    subWeeks,
    subMonths
} from 'date-fns';
import { safeDate } from './utils.js';

/**
 * Maps a goal cadence to its optimal x-axis granularity.
 *
 * @param {object} goal - Application goal object { cadence, target, ... }
 * @param {number} dataSpanDays - Number of days spanning tracked data
 * @returns {'daily' | 'weekly' | 'monthly'}
 */
export function getGoalCadenceGranularity(goal, dataSpanDays = 7) {
    const cadence = (goal?.cadence || 'weekly').toLowerCase();

    if (cadence === 'daily') return 'daily';
    if (cadence === 'weekly') return 'weekly';
    if (cadence === 'monthly') return 'monthly';

    // Cadence is 'total' (all-time pipeline target)
    if (dataSpanDays > 90) return 'monthly';
    if (dataSpanDays > 21) return 'weekly';
    return 'daily';
}

/**
 * Resolves the effective x-axis granularity taking into account manual mode and goal cadence.
 *
 * @param {'auto' | 'daily' | 'weekly' | 'monthly'} mode - Current switcher selection
 * @param {object} goal - Active application goal object
 * @param {number} dataSpanDays - Days span of tracked applications
 * @returns {'daily' | 'weekly' | 'monthly'}
 */
export function resolveGranularity(mode, goal, dataSpanDays = 7) {
    if (mode && mode !== 'auto') {
        return mode;
    }
    return getGoalCadenceGranularity(goal, dataSpanDays);
}

/**
 * Returns human-readable label for a granularity level.
 */
export function getGranularityLabel(granularity) {
    switch (granularity) {
        case 'daily': return 'Daily';
        case 'weekly': return 'Weekly';
        case 'monthly': return 'Monthly';
        default: return 'Weekly';
    }
}

/**
 * Supported time horizon ranges for the chart filter.
 */
export const CHART_TIME_RANGES = [
    { id: '7d', label: '7D', title: 'Last 7 Days' },
    { id: '14d', label: '14D', title: 'Last 14 Days' },
    { id: '30d', label: '30D', title: 'Last 30 Days' },
    { id: '90d', label: '90D', title: 'Last 90 Days' },
    { id: 'all', label: 'All', title: 'All Time (Full History)' }
];

/**
 * Calculates time-series chart data points for the application history chart.
 * Single O(N + M) pass for high performance on large application pipelines.
 *
 * @param {Array} jobs - List of tracked job applications
 * @param {'daily' | 'weekly' | 'monthly'} granularity - Granularity of x-axis
 * @param {object} [options] - Optional overrides:
 *   - range: '7d' | '14d' | '30d' | '90d' | 'all' (default: 'all')
 *   - now: Date override for deterministic testing
 *   - getDate: (job) => Date|string|null accessor for the job's timestamp
 *     (default: job.dateAdded || job.createdAt)
 * @returns {Array<{ date: string, count: number, newJobs: number, periodLabel: string }>}
 */
export function calculateChartData(jobs, granularity = 'daily', options = {}) {
    if (!jobs || jobs.length === 0) return [];

    const now = options.now instanceof Date ? options.now : new Date();
    const range = options.range || 'all';
    const getDate = typeof options.getDate === 'function'
        ? options.getDate
        : (job => job.dateAdded || job.createdAt);

    // 1. Sort timestamps O(N log N) once
    const sortedTimestamps = jobs
        .map(job => {
            const raw = getDate(job);
            return raw ? safeDate(raw).getTime() : NaN;
        })
        .filter(t => !isNaN(t))
        .sort((a, b) => a - b);

    if (sortedTimestamps.length === 0) return [];

    const firstJobTimestamp = sortedTimestamps[0];

    // Determine starting date based on selected time range
    let startDate;
    if (range === '7d') {
        startDate = subDays(now, 6);
    } else if (range === '14d') {
        startDate = subDays(now, 13);
    } else if (range === '30d') {
        startDate = subDays(now, 29);
    } else if (range === '90d') {
        startDate = subDays(now, 89);
    } else {
        // 'all': from first job's date up to now, with reasonable aesthetic minimum intervals
        if (granularity === 'daily') {
            const minStartDate = subDays(now, 6); // At least 7 days
            const startMillis = Math.min(minStartDate.getTime(), firstJobTimestamp);
            startDate = new Date(startMillis);
        } else if (granularity === 'weekly') {
            const minStartDate = subWeeks(now, 3); // At least 4 weeks
            const startMillis = Math.min(minStartDate.getTime(), firstJobTimestamp);
            startDate = new Date(startMillis);
        } else {
            const minStartDate = subMonths(now, 2); // At least 3 months
            const startMillis = Math.min(minStartDate.getTime(), firstJobTimestamp);
            startDate = new Date(startMillis);
        }
    }

    // 2. Build time intervals based on granularity
    let intervals = [];

    if (granularity === 'daily') {
        const days = eachDayOfInterval({
            start: startOfDay(startDate),
            end: startOfDay(now)
        });

        intervals = days.map(day => ({
            start: startOfDay(day).getTime(),
            end: endOfDay(day).getTime(),
            label: format(day, 'MMM d'),
            periodLabel: format(day, 'EEEE, MMM d, yyyy')
        }));
    } else if (granularity === 'weekly') {
        const weeks = eachWeekOfInterval(
            {
                start: startOfWeek(startDate, { weekStartsOn: 1 }),
                end: endOfWeek(now, { weekStartsOn: 1 })
            },
            { weekStartsOn: 1 }
        );

        intervals = weeks.map(weekStart => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
            return {
                start: startOfWeek(weekStart, { weekStartsOn: 1 }).getTime(),
                end: weekEnd.getTime(),
                label: format(weekStart, 'MMM d'),
                periodLabel: `Week of ${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
            };
        });
    } else if (granularity === 'monthly') {
        const months = eachMonthOfInterval({
            start: startOfMonth(startDate),
            end: endOfMonth(now)
        });

        intervals = months.map(monthStart => {
            const monthEnd = endOfMonth(monthStart);
            return {
                start: startOfMonth(monthStart).getTime(),
                end: monthEnd.getTime(),
                label: format(monthStart, 'MMM yyyy'),
                periodLabel: format(monthStart, 'MMMM yyyy')
            };
        });
    }

    if (intervals.length === 0) return [];

    // 3. Single-pass cumulative and per-period accumulation (O(N + M))
    let jobIndex = 0;
    let cumulativeCount = 0;

    // Fast-forward any jobs that were submitted prior to the range window so cumulative count is exact
    const firstIntervalStart = intervals[0].start;
    while (
        jobIndex < sortedTimestamps.length &&
        sortedTimestamps[jobIndex] < firstIntervalStart
    ) {
        cumulativeCount++;
        jobIndex++;
    }

    return intervals.map(interval => {
        let newJobsInPeriod = 0;

        while (
            jobIndex < sortedTimestamps.length &&
            sortedTimestamps[jobIndex] <= interval.end
        ) {
            cumulativeCount++;
            if (sortedTimestamps[jobIndex] >= interval.start) {
                newJobsInPeriod++;
            }
            jobIndex++;
        }

        return {
            date: interval.label,
            count: cumulativeCount,
            newJobs: newJobsInPeriod,
            periodLabel: interval.periodLabel
        };
    });
}
