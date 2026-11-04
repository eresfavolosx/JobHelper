/**
 * Application Goal Tracker Engine for NovuJobs.
 * Calculates application counts against user-defined targets across cadences
 * (daily, weekly, monthly, milestone total) and computes pace indicators.
 */

export const CADENCE_OPTIONS = [
    { value: 'weekly', label: 'Weekly', defaultTarget: 10, helper: 'Applications per week (Mon - Sun)' },
    { value: 'monthly', label: 'Monthly', defaultTarget: 40, helper: 'Applications per calendar month' },
    { value: 'daily', label: 'Daily', defaultTarget: 3, helper: 'Applications per day' },
    { value: 'total', label: 'Milestone Total', defaultTarget: 100, helper: 'Total pipeline target' }
];

export const DEFAULT_GOAL = {
    target: 10,
    cadence: 'weekly',
    targetRole: '',
    hoursPerWeek: 5,
    reminderEnabled: true,
    enabled: true
};

/**
 * Resolves user's application goal from profile with fallback to DEFAULT_GOAL.
 */
export function getApplicationGoal(profile) {
    if (!profile || !profile.applicationGoal) {
        return { ...DEFAULT_GOAL };
    }
    return {
        ...DEFAULT_GOAL,
        ...profile.applicationGoal
    };
}

/**
 * Normalizes date string or timestamp to Date object.
 * Uses only the application/creation date. `updatedAt` is intentionally excluded because it
 * changes on every status change (e.g. applied -> screening), which must not count as a new application.
 */
export function parseJobDate(job) {
    if (!job) return null;
    const raw = job.appliedAt || job.createdAt || job.dateAdded;
    if (!raw) return null;
    if (typeof raw === 'object' && typeof raw.toDate === 'function') {
        const d = raw.toDate();
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

// Statuses that do not represent a submitted application
const NON_APPLIED_STATUSES = new Set(['wishlist', 'archived', 'deleted']);

/**
 * Resolves the `appliedAt` value to persist when a job's status changes.
 * Only a genuine wishlist -> pipeline transition counts as a new application (stamped "now").
 * Moving between pipeline stages (e.g. applied -> screening -> interviewing -> offer) must NEVER
 * re-date the application, otherwise status changes get counted towards the application goal.
 *
 * @param {object|undefined} existingJob - Job before the change
 * @param {string} newStatus - Target status
 * @param {string} nowIso - Current timestamp (ISO string)
 * @returns {string|undefined} appliedAt to write, or undefined to leave it untouched
 */
export function resolveAppliedAtForStatusChange(existingJob, newStatus, nowIso) {
    if (!newStatus || NON_APPLIED_STATUSES.has(newStatus)) return undefined;

    // Effective prior stage (archived/deleted jobs remember where they came from)
    const priorStatus = (existingJob?.status === 'archived' || existingJob?.status === 'deleted')
        ? (existingJob?.previousStatus || 'wishlist')
        : (existingJob?.status || 'wishlist');

    if (priorStatus === 'wishlist') {
        // Genuine new application submitted now
        return nowIso;
    }

    // Pipeline stage change: keep the original application date untouched
    if (existingJob?.appliedAt) return undefined;

    // Legacy job already in the pipeline but missing appliedAt: backfill with its original
    // creation date instead of "now" so it is not counted as a new application today
    return existingJob?.createdAt || existingJob?.dateAdded || undefined;
}

/**
 * Determines whether a job represents a submitted application that should count
 * towards goals and application history.
 * - wishlist / deleted jobs never count
 * - archived jobs only count if they were archived from a pipeline stage
 *   (archiving a wishlist bookmark is not an application)
 */
export function isSubmittedApplication(job) {
    if (!job) return false;
    const status = job.status || 'wishlist';
    if (status === 'wishlist' || status === 'deleted') return false;
    if (status === 'archived') {
        const prior = job.previousStatus || 'wishlist';
        return prior !== 'wishlist' && prior !== 'archived' && prior !== 'deleted';
    }
    return true;
}

function toMillis(raw) {
    if (!raw) return NaN;
    if (typeof raw === 'object' && typeof raw.toDate === 'function') return raw.toDate().getTime();
    return new Date(raw).getTime();
}

/**
 * One-time cleanup: finds jobs whose `appliedAt` was wrongly re-stamped by a status change
 * (e.g. applied -> rejected) under the old logic, which made them count towards the goal again.
 *
 * Signature of the old bug: the stage change wrote `appliedAt` and `updatedAt` with the exact
 * same timestamp while moving the job into a non-"applied" pipeline stage, even though the job
 * was created earlier. Such jobs are re-dated to their original creation date.
 *
 * Jobs currently in "applied" are left untouched because a genuine wishlist -> applied move
 * has the same signature and can't be told apart.
 *
 * @param {Array} jobs
 * @param {string|number|Date} [cutoff] - Only repair stamps written before this time
 *   (i.e. by previously deployed code). Defaults to no cutoff.
 * @returns {Array<{ id: string, appliedAt: string }>} repairs to apply
 */
export function findMiscountedApplications(jobs = [], cutoff) {
    const cutoffMs = cutoff ? toMillis(cutoff) : Infinity;
    const repairs = [];
    for (const job of jobs || []) {
        if (!job?.id || !isSubmittedApplication(job)) continue;
        if (job.status === 'applied' || job.status === 'archived') continue;

        const appliedMs = toMillis(job.appliedAt);
        const updatedMs = toMillis(job.updatedAt);
        if (isNaN(appliedMs) || isNaN(updatedMs) || appliedMs !== updatedMs) continue;
        if (!(appliedMs < cutoffMs)) continue;

        const origin = job.createdAt || job.dateAdded;
        const originMs = toMillis(origin);
        if (isNaN(originMs) || originMs >= appliedMs) continue;

        const originIso = typeof origin === 'string' ? origin : new Date(originMs).toISOString();
        repairs.push({ id: job.id, appliedAt: originIso });
    }
    return repairs;
}

// Single-entry memo cache: calculateGoalProgress is called by several components
// (nav bar, banner, widget, profile, modals) on every render with the same jobs array.
let goalProgressCache = { jobs: null, target: null, cadence: null, enabled: null, minuteKey: null, result: null };

/**
 * Checks if a date falls within the same day as `now` (using local day boundaries).
 */
export function isToday(d, now = new Date()) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    return d >= startOfDay && d <= endOfDay;
}

/**
 * Checks if a date falls within the current calendar week (Monday 00:00 to Sunday 23:59:59).
 */
export function isCurrentWeek(d, now = new Date()) {
    const current = new Date(now);
    const dayOfWeek = current.getDay(); // 0 is Sun, 1 is Mon...
    const distanceToMonday = (dayOfWeek + 6) % 7;
    
    const monday = new Date(current);
    monday.setDate(current.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return d.getTime() >= monday.getTime() && d.getTime() <= sunday.getTime();
}

/**
 * Checks if a date falls within the current calendar month.
 */
export function isCurrentMonth(d, now = new Date()) {
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth();
}

/**
 * Calculates days remaining in the current cadence cycle.
 */
export function getCycleDaysRemaining(cadence, now = new Date()) {
    if (cadence === 'daily') {
        const midnight = new Date(now);
        midnight.setHours(23, 59, 59, 999);
        const hours = Math.max(0, Math.ceil((midnight - now) / (1000 * 60 * 60)));
        return `${hours}h left today`;
    }

    if (cadence === 'weekly') {
        const dayOfWeek = now.getDay();
        const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        return daysLeft === 0 ? 'Last day of week' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left this week`;
    }

    if (cadence === 'monthly') {
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = Math.max(0, lastDay - now.getDate());
        return daysLeft === 0 ? 'Last day of month' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left this month`;
    }

    return 'Active milestone';
}

/**
 * Evaluates progress against user goal and returns both today's applied roles
 * and the roles contributing to the active goal cycle.
 */
export function calculateGoalProgress(jobs = [], goal = DEFAULT_GOAL, now = new Date()) {
    const target = Math.max(1, parseInt(goal?.target, 10) || DEFAULT_GOAL.target);
    const cadence = goal?.cadence || DEFAULT_GOAL.cadence;
    const enabled = goal?.enabled !== false;

    // Return memoized result when inputs are unchanged within the same minute
    // (zustand keeps the jobs array reference stable until jobs actually change)
    const minuteKey = Math.floor(now.getTime() / 60000);
    const cache = goalProgressCache;
    if (
        cache.result &&
        cache.jobs === jobs &&
        cache.target === target &&
        cache.cadence === cadence &&
        cache.enabled === enabled &&
        cache.minuteKey === minuteKey
    ) {
        return cache.result;
    }

    // Only submitted applications count (wishlist, deleted, and archived bookmarks do not)
    const validJobs = (jobs || []).filter(isSubmittedApplication);

    const cycleJobs = [];
    const todayJobs = [];

    validJobs.forEach(job => {
        const d = parseJobDate(job);
        if (!d) return;

        const appliedToday = isToday(d, now);
        const enrichedJob = {
            ...job,
            parsedDate: d.toISOString(),
            isAppliedToday: appliedToday
        };

        if (appliedToday) {
            todayJobs.push(enrichedJob);
        }

        if (cadence === 'daily' && appliedToday) {
            cycleJobs.push(enrichedJob);
        } else if (cadence === 'weekly' && isCurrentWeek(d, now)) {
            cycleJobs.push(enrichedJob);
        } else if (cadence === 'monthly' && isCurrentMonth(d, now)) {
            cycleJobs.push(enrichedJob);
        } else if (cadence === 'total') {
            cycleJobs.push(enrichedJob);
        }
    });

    // Sort newest first so the user sees their most recent applications at the top
    const sortByNewest = (a, b) => new Date(b.parsedDate).getTime() - new Date(a.parsedDate).getTime();
    cycleJobs.sort(sortByNewest);
    todayJobs.sort(sortByNewest);

    const count = cycleJobs.length;
    const todayCount = todayJobs.length;
    const percentage = Math.min(100, Math.round((count / target) * 100));
    const remaining = Math.max(0, target - count);
    const cycleTimeRemaining = getCycleDaysRemaining(cadence, now);

    // Calculate pace
    let pace = 'on_track';
    let paceMessage = 'Great pacing! You are right on track.';

    if (count >= target) {
        pace = 'completed';
        paceMessage = `Goal Crushed! You reached your ${target} application target. 🚀`;
    } else {
        if (cadence === 'weekly') {
            const dayOfWeek = now.getDay();
            const elapsedDays = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 to 7
            const expectedCount = Math.floor((target / 7) * elapsedDays);
            if (count < expectedCount) {
                pace = 'behind';
                paceMessage = `Need ${remaining} more application${remaining > 1 ? 's' : ''} to meet your weekly goal.`;
            } else {
                paceMessage = `On track! ${remaining} more needed before Sunday.`;
            }
        } else if (cadence === 'monthly') {
            const dayOfMonth = now.getDate();
            const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const expectedCount = Math.floor((target / totalDays) * dayOfMonth);
            if (count < expectedCount) {
                pace = 'behind';
                paceMessage = `Pacing slightly behind. Aim for ${Math.ceil(remaining / Math.max(1, totalDays - dayOfMonth))} per day.`;
            } else {
                paceMessage = `Strong monthly momentum! ${remaining} to go.`;
            }
        } else if (cadence === 'daily') {
            paceMessage = remaining === 0 ? 'Daily goal reached!' : `${remaining} more application${remaining > 1 ? 's' : ''} needed today.`;
        } else {
            paceMessage = `${remaining} more application${remaining > 1 ? 's' : ''} to reach your ${target} milestone.`;
        }
    }

    const result = {
        count,
        todayCount,
        target,
        cadence,
        percentage,
        remaining,
        pace,
        paceMessage,
        cycleTimeRemaining,
        cycleJobs,
        todayJobs,
        enabled
    };

    goalProgressCache = { jobs, target, cadence, enabled, minuteKey, result };
    return result;
}
