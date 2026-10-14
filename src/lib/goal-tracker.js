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
 */
function parseJobDate(job) {
    const raw = job.appliedAt || job.createdAt || job.dateAdded || job.updatedAt;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

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
 * Evaluates progress against user goal.
 */
export function calculateGoalProgress(jobs = [], goal = DEFAULT_GOAL, now = new Date()) {
    const target = Math.max(1, parseInt(goal?.target, 10) || DEFAULT_GOAL.target);
    const cadence = goal?.cadence || DEFAULT_GOAL.cadence;

    // Filter valid submitted applications (wishlist or deleted do not count towards applied targets)
    const validJobs = (jobs || []).filter(j => 
        j && j.status !== 'deleted' && j.status !== 'wishlist'
    );

    let count = 0;
    validJobs.forEach(job => {
        const d = parseJobDate(job);
        if (!d) return;

        if (cadence === 'daily' && isToday(d, now)) {
            count++;
        } else if (cadence === 'weekly' && isCurrentWeek(d, now)) {
            count++;
        } else if (cadence === 'monthly' && isCurrentMonth(d, now)) {
            count++;
        } else if (cadence === 'total') {
            count++;
        }
    });

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

    return {
        count,
        target,
        cadence,
        percentage,
        remaining,
        pace,
        paceMessage,
        cycleTimeRemaining,
        enabled: goal?.enabled !== false
    };
}
