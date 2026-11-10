/**
 * Job Search Cycles / Cohorts Engine
 *
 * Manages career search cycles:
 * - Tracking search cycles from start date to offer acceptance
 * - Closing a cycle upon offer acceptance and automatically starting a new cycle
 * - Filtering applications, dashboards, Kanban, Sankey, Gantt, and trends by cycle
 * - Graceful cycle reopening if an offer status is reverted
 */

import { safeDate } from './utils.js';

/**
 * Generates a unique cycle ID
 */
export function generateCycleId(prefix = 'cycle') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `${prefix}_${timestamp}_${random}`;
}

/**
 * Creates a cycle object structure
 */
export function createCycle(cycleNumber = 1, options = {}) {
    const nowIso = options.now || new Date().toISOString();
    return {
        id: options.id || `cycle_${cycleNumber}_${Date.now().toString(36)}`,
        cycleNumber: Number(cycleNumber) || 1,
        name: options.name || `Search Cycle ${cycleNumber}`,
        status: options.status || 'active', // 'active' | 'completed' | 'archived'
        startedAt: options.startedAt || nowIso,
        endedAt: options.endedAt || null,
        acceptedJobId: options.acceptedJobId || null,
        acceptedCompany: options.acceptedCompany || null,
        acceptedRole: options.acceptedRole || null,
        targetRole: options.targetRole || null,
        createdAt: options.createdAt || nowIso,
        updatedAt: options.updatedAt || nowIso
    };
}

/**
 * Finds the currently active cycle among cycles list
 */
export function getActiveCycle(cycles) {
    if (!Array.isArray(cycles) || cycles.length === 0) {
        return null;
    }
    const active = cycles.find(c => c && c.status === 'active');
    if (active) return active;
    // Fallback: return the cycle with highest cycleNumber
    return [...cycles].sort((a, b) => (b?.cycleNumber || 0) - (a?.cycleNumber || 0))[0];
}

/**
 * Resolves or initializes cycles list given current jobs and existing cycles.
 * Backwards-compatible: if existingCycles is empty, inspects historical jobs
 * and initializes Cycle 1 (completed if an offer was accepted, or active).
 */
export function resolveCyclesFromJobs(jobs = [], existingCycles = []) {
    if (Array.isArray(existingCycles) && existingCycles.length > 0) {
        // Ensure there is at least one active cycle
        const hasActive = existingCycles.some(c => c && c.status === 'active');
        if (!hasActive) {
            const maxNumber = Math.max(...existingCycles.map(c => Number(c?.cycleNumber) || 1), 0);
            const newActive = createCycle(maxNumber + 1);
            return [...existingCycles, newActive];
        }
        return existingCycles;
    }

    // Auto-reconstruct cycles from existing jobs history
    const validJobs = Array.isArray(jobs) ? jobs.filter(j => j && j.status !== 'deleted') : [];
    const acceptedJobs = validJobs
        .filter(j => j.status === 'accepted')
        .sort((a, b) => {
            const dateA = safeDate(a.updatedAt || a.appliedAt || a.dateAdded || a.createdAt).getTime();
            const dateB = safeDate(b.updatedAt || b.appliedAt || b.dateAdded || b.createdAt).getTime();
            return dateA - dateB;
        });

    if (acceptedJobs.length === 0) {
        // No accepted jobs: single active Cycle 1
        const earliestJobDate = validJobs.reduce((earliest, j) => {
            const d = safeDate(j.appliedAt || j.dateAdded || j.createdAt).toISOString();
            return d < earliest ? d : earliest;
        }, new Date().toISOString());

        return [createCycle(1, { startedAt: earliestJobDate })];
    }

    // There are accepted jobs in history!
    const resultCycles = [];
    let cycleNumber = 1;
    let prevCycleEnd = null;

    for (const accJob of acceptedJobs) {
        const acceptedDate = safeDate(accJob.updatedAt || accJob.appliedAt || accJob.createdAt).toISOString();
        const cycle = createCycle(cycleNumber, {
            id: `cycle_${cycleNumber}_init`,
            status: 'completed',
            startedAt: prevCycleEnd || safeDate(accJob.appliedAt || accJob.createdAt).toISOString(),
            endedAt: acceptedDate,
            acceptedJobId: accJob.id,
            acceptedCompany: accJob.company,
            acceptedRole: accJob.role || accJob.title
        });
        resultCycles.push(cycle);
        prevCycleEnd = acceptedDate;
        cycleNumber++;
    }

    // And add a new active cycle following the last accepted offer
    const activeCycle = createCycle(cycleNumber, {
        id: `cycle_${cycleNumber}_active`,
        status: 'active',
        startedAt: prevCycleEnd || new Date().toISOString()
    });
    resultCycles.push(activeCycle);

    return resultCycles;
}

/**
 * Handles closing the active cycle when an offer is accepted, and opens a new active cycle.
 * Returns { updatedCycles, closedCycle, newActiveCycle }
 */
export function closeCycleWithAcceptedOffer(cycles = [], acceptedJob, options = {}) {
    if (!acceptedJob || !acceptedJob.id) {
        return { updatedCycles: cycles, closedCycle: null, newActiveCycle: null };
    }

    const nowIso = options.now || new Date().toISOString();
    const currentCycles = resolveCyclesFromJobs([], cycles);
    const activeCycle = getActiveCycle(currentCycles);

    const closedCycle = {
        ...activeCycle,
        status: 'completed',
        endedAt: nowIso,
        acceptedJobId: acceptedJob.id,
        acceptedCompany: acceptedJob.company || 'Accepted Company',
        acceptedRole: acceptedJob.role || acceptedJob.title || 'Accepted Role',
        updatedAt: nowIso
    };

    const nextCycleNumber = (closedCycle.cycleNumber || currentCycles.length) + 1;
    const newActiveCycle = createCycle(nextCycleNumber, {
        now: nowIso,
        startedAt: nowIso,
        status: 'active',
        name: options.nextCycleName || `Search Cycle ${nextCycleNumber}`
    });

    const updatedCycles = currentCycles.map(c => (c.id === closedCycle.id ? closedCycle : c));
    updatedCycles.push(newActiveCycle);

    return {
        updatedCycles,
        closedCycle,
        newActiveCycle
    };
}

/**
 * Reopens a completed cycle if an offer was accepted by mistake and later reverted.
 * Cleans up empty newly started cycle if it had no jobs.
 */
export function reopenCycleForRevertedOffer(cycles = [], revertedJobId, jobs = []) {
    if (!revertedJobId || !Array.isArray(cycles) || cycles.length === 0) {
        return cycles;
    }

    const targetCycle = cycles.find(c => c && c.acceptedJobId === revertedJobId);
    if (!targetCycle) return cycles;

    const reopenedCycle = {
        ...targetCycle,
        status: 'active',
        endedAt: null,
        acceptedJobId: null,
        acceptedCompany: null,
        acceptedRole: null,
        updatedAt: new Date().toISOString()
    };

    // Find any subsequent empty cycles created after this one and clean them up
    const cyclesToKeep = [];

    for (const c of cycles) {
        if (c.id === targetCycle.id) {
            cyclesToKeep.push(reopenedCycle);
        } else if (c.cycleNumber > targetCycle.cycleNumber) {
            // Check if this subsequent cycle has any jobs
            const hasJobs = jobs.some(j => j.cycleId === c.id);
            if (hasJobs) {
                cyclesToKeep.push(c);
            }
            // If it had 0 jobs, clean it up!
        } else {
            cyclesToKeep.push(c);
        }
    }

    return cyclesToKeep;
}

/**
 * Filters a list of jobs based on the selected cycle ID ('all', 'active', or cycle.id).
 * Handles legacy jobs without cycleId using timestamps and fallbacks.
 */
export function filterJobsByCycle(jobs = [], cycles = [], selectedCycleId = 'all') {
    if (!Array.isArray(jobs)) return [];
    const validJobs = jobs.filter(j => j && j.status !== 'deleted');

    if (!selectedCycleId || selectedCycleId === 'all') {
        return validJobs;
    }

    const resolvedCycles = Array.isArray(cycles) && cycles.length > 0
        ? cycles
        : resolveCyclesFromJobs(validJobs, []);

    let targetCycleId = selectedCycleId;
    if (selectedCycleId === 'active') {
        const act = getActiveCycle(resolvedCycles);
        if (!act) return validJobs;
        targetCycleId = act.id;
    }

    const targetCycle = resolvedCycles.find(c => c.id === targetCycleId);
    if (!targetCycle) return validJobs;

    const cycleStartMs = safeDate(targetCycle.startedAt).getTime();
    const cycleEndMs = targetCycle.endedAt ? safeDate(targetCycle.endedAt).getTime() : Infinity;

    return validJobs.filter(job => {
        // Direct cycleId match
        if (job.cycleId) {
            return job.cycleId === targetCycleId;
        }

        // Job is the explicitly accepted job for this cycle
        if (targetCycle.acceptedJobId && job.id === targetCycle.acceptedJobId) {
            return true;
        }

        // Timestamp window fallback for legacy unassigned jobs
        const jobDateMs = safeDate(job.appliedAt || job.dateAdded || job.createdAt).getTime();
        if (!isNaN(jobDateMs)) {
            // If cycle 1 and job was created before cycle 1 ended
            if (targetCycle.cycleNumber === 1 && jobDateMs <= cycleEndMs) {
                return true;
            }
            // Within cycle window
            if (jobDateMs >= cycleStartMs && jobDateMs <= cycleEndMs) {
                return true;
            }
        }

        // If only 1 cycle exists in system, all unassigned jobs belong to it
        if (resolvedCycles.length === 1 && targetCycle.cycleNumber === 1) {
            return true;
        }

        return false;
    });
}

/**
 * Calculates metrics and health summary for a cycle
 */
export function calculateCycleStats(cycle, jobs = []) {
    const cycleJobs = Array.isArray(jobs) ? jobs : [];
    let applied = 0;
    let screening = 0;
    let interviewing = 0;
    let offers = 0;
    let accepted = 0;
    let rejected = 0;
    let wishlist = 0;

    for (const job of cycleJobs) {
        const status = job.status || 'wishlist';
        if (status === 'wishlist') wishlist++;
        else applied++;

        if (status === 'screening') screening++;
        if (status === 'interviewing') interviewing++;
        if (status === 'offer') offers++;
        if (status === 'accepted') {
            offers++;
            accepted++;
        }
        if (status === 'rejected') rejected++;
    }

    const startMs = safeDate(cycle?.startedAt).getTime();
    const endMs = cycle?.endedAt ? safeDate(cycle.endedAt).getTime() : Date.now();
    const durationDays = isNaN(startMs) ? 0 : Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

    const interviewRate = applied > 0 ? Math.round(((screening + interviewing + offers) / applied) * 1000) / 10 : 0;
    const offerRate = applied > 0 ? Math.round((offers / applied) * 1000) / 10 : 0;

    return {
        totalJobs: cycleJobs.length,
        wishlist,
        applied,
        screening,
        interviewing,
        offers,
        accepted,
        rejected,
        durationDays,
        interviewRate,
        offerRate,
        isCompleted: cycle?.status === 'completed',
        acceptedCompany: cycle?.acceptedCompany || null,
        acceptedRole: cycle?.acceptedRole || null
    };
}
