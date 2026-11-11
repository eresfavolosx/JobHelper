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
        triggerType: options.triggerType || 'initial', // 'initial' | 'offer_accepted' | 'activity_spike' | 'job_loss' | 'manual_toggle' | 'manual'
        notes: options.notes || null,
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
 * Defaults to 'active' so all views display the active search cycle by default.
 * Handles legacy jobs without cycleId using timestamps and fallbacks.
 */
export function filterJobsByCycle(jobs = [], cycles = [], selectedCycleId = 'active') {
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
    const durationDays = isNaN(startMs) ? 0 : Math.max(1, Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)));

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

/**
 * Normalizes a date or YYYY-MM-DD string to the UTC day start ISO string (00:00:00.000Z).
 */
export function normalizeToDayStartIso(dateInput) {
    if (!dateInput) return new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
        return `${dateInput.trim()}T00:00:00.000Z`;
    }
    const d = safeDate(dateInput);
    if (isNaN(d.getTime())) {
        return new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
    }
    return d.toISOString().slice(0, 10) + 'T00:00:00.000Z';
}

function formatShortMonthDayYear(isoStr) {
    const d = safeDate(isoStr);
    if (isNaN(d.getTime())) return 'Recent Date';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Automatically detects activity spikes following dormant periods (or dramatic volume surges)
 * that likely represent the start of a new job search period/cycle.
 *
 * Detects:
 * 1. Dormancy + Resumption: >= minGapDays (default 21d) with zero applications followed by new applications.
 * 2. Volume Surge: quiet 14-day baseline (<= 1 app) followed by >= 4 apps in a 7-day burst.
 *
 * Excludes candidate dates within +-7 days of an existing cycle's startedAt.
 */
export function detectSearchActivitySpikes(jobs = [], existingCycles = [], options = {}) {
    const minGapDays = Number(options.minGapDays) || 21;
    const windowDays = Number(options.windowDays) || 14;
    const minBurstJobs = Number(options.minBurstJobs) || 2;
    const boundaryDedupeDays = Number(options.boundaryDedupeDays) || 7;

    const validJobs = Array.isArray(jobs)
        ? jobs.filter(j => j && j.status !== 'deleted')
        : [];
    if (validJobs.length < 2) return [];

    const datedJobs = validJobs
        .map(job => {
            const raw = job.appliedAt || job.dateAdded || job.createdAt;
            const ms = safeDate(raw).getTime();
            return { job, ms };
        })
        .filter(item => !isNaN(item.ms))
        .sort((a, b) => a.ms - b.ms);

    if (datedJobs.length < 2) return [];

    const cycles = Array.isArray(existingCycles) ? existingCycles : [];
    const cycleStartsMs = cycles
        .map(c => safeDate(c?.startedAt).getTime())
        .filter(ms => !isNaN(ms));

    const isNearExistingBoundary = (candidateMs) => {
        // Ignore if close to Cycle 1 initial earliest job start OR any explicit cycle boundary
        return cycleStartsMs.some(cs => Math.abs(candidateMs - cs) <= boundaryDedupeDays * 86400000);
    };

    const spikes = [];
    const seenDays = new Set();

    // Pass 1: Dormancy gap >= minGapDays followed by resumption
    for (let i = 1; i < datedJobs.length; i++) {
        const prev = datedJobs[i - 1];
        const curr = datedJobs[i];
        const gapDays = Math.round((curr.ms - prev.ms) / 86400000);

        if (gapDays >= minGapDays) {
            const dayStartIso = normalizeToDayStartIso(new Date(curr.ms).toISOString());
            const dayStartMs = new Date(dayStartIso).getTime();
            const dayStr = dayStartIso.slice(0, 10);

            if (seenDays.has(dayStr)) continue;
            seenDays.add(dayStr);

            if (isNearExistingBoundary(dayStartMs)) continue;

            const jobsBeforeCount = datedJobs.filter(d => d.ms < dayStartMs).length;
            const jobsAfter = datedJobs.filter(d => d.ms >= dayStartMs);
            const burstCount = datedJobs.filter(
                d => d.ms >= dayStartMs && d.ms <= dayStartMs + windowDays * 86400000
            ).length;

            if (jobsBeforeCount >= 1 && (burstCount >= minBurstJobs || gapDays >= 30)) {
                const dayLabel = formatShortMonthDayYear(dayStartIso);
                spikes.push({
                    id: `spike_${dayStr}`,
                    suggestedStartDate: dayStartIso,
                    dayStr,
                    dayLabel,
                    gapDays,
                    jobsBeforeCount,
                    jobsAfterCount: jobsAfter.length,
                    burstCount,
                    confidence: (gapDays >= 28 || burstCount >= 4) ? 'high' : 'medium',
                    firstJob: {
                        id: curr.job.id,
                        company: curr.job.company || 'Unknown',
                        role: curr.job.role || curr.job.title || 'Role'
                    },
                    reason: `${gapDays}-day quiet stretch followed by ${jobsAfter.length} application${jobsAfter.length === 1 ? '' : 's'} starting ${dayLabel}`
                });
            }
        }
    }

    // Pass 2: Dramatic volume surge (quiet 14-day baseline <= 1 app -> >= 4 apps in 7 days)
    if (spikes.length === 0 && datedJobs.length >= 5) {
        for (let i = 1; i < datedJobs.length; i++) {
            const curr = datedJobs[i];
            const dayStartIso = normalizeToDayStartIso(new Date(curr.ms).toISOString());
            const dayStartMs = new Date(dayStartIso).getTime();
            const dayStr = dayStartIso.slice(0, 10);

            if (seenDays.has(dayStr) || isNearExistingBoundary(dayStartMs)) continue;

            const prior14d = datedJobs.filter(
                d => d.ms >= dayStartMs - 14 * 86400000 && d.ms < dayStartMs
            ).length;
            const jobsBeforeCount = datedJobs.filter(d => d.ms < dayStartMs).length;
            const next7d = datedJobs.filter(
                d => d.ms >= dayStartMs && d.ms <= dayStartMs + 7 * 86400000
            ).length;
            const jobsAfterCount = datedJobs.filter(d => d.ms >= dayStartMs).length;

            if (jobsBeforeCount >= 1 && prior14d <= 1 && next7d >= 4) {
                seenDays.add(dayStr);
                const prev = datedJobs[i - 1];
                const gapDays = Math.max(0, Math.round((dayStartMs - prev.ms) / 86400000));
                const dayLabel = formatShortMonthDayYear(dayStartIso);
                spikes.push({
                    id: `spike_${dayStr}`,
                    suggestedStartDate: dayStartIso,
                    dayStr,
                    dayLabel,
                    gapDays,
                    jobsBeforeCount,
                    jobsAfterCount,
                    burstCount: next7d,
                    confidence: next7d >= 5 ? 'high' : 'medium',
                    firstJob: {
                        id: curr.job.id,
                        company: curr.job.company || 'Unknown',
                        role: curr.job.role || curr.job.title || 'Role'
                    },
                    reason: `Activity surged to ${next7d} applications in 7 days starting ${dayLabel} (up from ${prior14d} in prior 14d)`
                });
            }
        }
    }

    // Return most recent spike first
    return spikes.sort((a, b) => new Date(b.suggestedStartDate).getTime() - new Date(a.suggestedStartDate).getTime());
}

/**
 * Splits a cycle at a specified splitDate (e.g. '2026-10-01'), closing the earlier cycle right before
 * the split and creating/activating a new cycle starting at splitDate. Reassigns jobs by date cleanly.
 */
export function splitCycleAtDate(cycles = [], jobs = [], targetCycleId = null, splitDateInput, options = {}) {
    const resolvedCycles = resolveCyclesFromJobs(jobs, cycles);
    const activeCycle = getActiveCycle(resolvedCycles);
    const splitIso = normalizeToDayStartIso(splitDateInput);
    const splitMs = new Date(splitIso).getTime();
    const nowIso = options.now || new Date().toISOString();

    const targetCycle = (targetCycleId && resolvedCycles.find(c => c.id === targetCycleId)) || activeCycle || resolvedCycles[resolvedCycles.length - 1];
    if (!targetCycle) {
        return { updatedCycles: resolvedCycles, updatedJobs: jobs, changedJobIds: [], priorCycle: null, newCycle: null };
    }

    const validJobs = Array.isArray(jobs) ? jobs : [];
    const hasPreSplitJobsInTarget = validJobs.some(job => {
        if (!job || job.status === 'deleted') return false;
        const belongsToTarget = !job.cycleId || job.cycleId === targetCycle.id;
        if (!belongsToTarget) return false;
        const jobMs = safeDate(job.appliedAt || job.dateAdded || job.createdAt).getTime();
        return !isNaN(jobMs) && jobMs < splitMs;
    });

    const shortLabel = formatShortMonthDayYear(splitIso);
    const defaultSplitName = options.name || `Current Search (${shortLabel})`;

    // If targetCycle has no jobs strictly before splitMs, update its start date cleanly
    // instead of creating an empty historical stub cycle.
    if (!hasPreSplitJobsInTarget && !options.forceCreateCycle) {
        const updatedTarget = {
            ...targetCycle,
            name: options.name || (!targetCycle.name || /^Search Cycle \d+$/i.test(targetCycle.name) ? defaultSplitName : targetCycle.name),
            startedAt: splitIso,
            status: 'active',
            endedAt: null,
            triggerType: options.triggerType || targetCycle.triggerType || 'activity_spike',
            notes: options.notes || `Search cycle started ${shortLabel}`,
            updatedAt: nowIso
        };
        const updatedCycles = resolvedCycles.map(c => (c.id === targetCycle.id ? updatedTarget : c));
        const changedJobIds = [];
        const updatedJobs = validJobs.map(job => {
            if (!job || job.status === 'deleted') return job;
            if (!job.cycleId) {
                const jobMs = safeDate(job.appliedAt || job.dateAdded || job.createdAt).getTime();
                if (!isNaN(jobMs) && jobMs >= splitMs) {
                    changedJobIds.push(job.id);
                    return { ...job, cycleId: updatedTarget.id, cycleNumber: updatedTarget.cycleNumber };
                }
            }
            return job;
        });
        return {
            updatedCycles,
            updatedJobs,
            changedJobIds,
            priorCycle: null,
            newCycle: updatedTarget
        };
    }

    const priorEndedIso = new Date(splitMs - 1).toISOString();
    const priorStartMs = safeDate(targetCycle.startedAt).getTime();
    let adjustedPriorStart = targetCycle.startedAt;
    if (isNaN(priorStartMs) || priorStartMs >= splitMs) {
        // Ensure prior cycle starts at or before its earliest job
        const earliestPriorMs = validJobs
            .filter(j => j && j.status !== 'deleted')
            .map(j => safeDate(j.appliedAt || j.dateAdded || j.createdAt).getTime())
            .filter(ms => !isNaN(ms) && ms < splitMs)
            .sort((a, b) => a - b)[0];
        adjustedPriorStart = earliestPriorMs
            ? new Date(earliestPriorMs).toISOString()
            : new Date(splitMs - 86400000).toISOString();
    }

    const priorCycle = {
        ...targetCycle,
        startedAt: adjustedPriorStart,
        endedAt: priorEndedIso,
        status: 'completed',
        updatedAt: nowIso
    };

    const maxNum = Math.max(...resolvedCycles.map(c => Number(c?.cycleNumber) || 1), 0);
    const nextNum = maxNum + 1;
    const newCycle = createCycle(nextNum, {
        id: options.newCycleId,
        name: defaultSplitName,
        status: 'active',
        startedAt: splitIso,
        endedAt: null,
        triggerType: options.triggerType || 'activity_spike',
        notes: options.notes || `Search cycle split starting ${shortLabel}`,
        now: nowIso
    });

    const updatedCycles = resolvedCycles.map(c => {
        if (c.id === targetCycle.id) return priorCycle;
        if (c.status === 'active') {
            return { ...c, status: 'completed', endedAt: c.endedAt || priorEndedIso, updatedAt: nowIso };
        }
        return c;
    });
    updatedCycles.push(newCycle);

    const changedJobIds = [];
    const updatedJobs = (Array.isArray(jobs) ? jobs : []).map(job => {
        if (!job || job.status === 'deleted') return job;
        // Reassign jobs belonging to targetCycle OR unassigned legacy jobs
        const belongsToTarget = !job.cycleId || job.cycleId === targetCycle.id;
        if (!belongsToTarget) return job;

        const jobMs = safeDate(job.appliedAt || job.dateAdded || job.createdAt).getTime();
        if (isNaN(jobMs)) return job;

        if (jobMs >= splitMs) {
            if (job.cycleId !== newCycle.id || job.cycleNumber !== newCycle.cycleNumber) {
                changedJobIds.push(job.id);
                return { ...job, cycleId: newCycle.id, cycleNumber: newCycle.cycleNumber };
            }
        } else {
            if (job.cycleId !== priorCycle.id || job.cycleNumber !== priorCycle.cycleNumber) {
                changedJobIds.push(job.id);
                return { ...job, cycleId: priorCycle.id, cycleNumber: priorCycle.cycleNumber };
            }
        }
        return job;
    });

    return {
        updatedCycles,
        updatedJobs,
        changedJobIds,
        priorCycle,
        newCycle
    };
}

/**
 * Updates metadata and date bounds for an existing cycle directly.
 */
export function updateCyclePeriod(cycles = [], cycleId, updates = {}) {
    if (!Array.isArray(cycles) || !cycleId) return cycles;
    const nowIso = new Date().toISOString();

    return cycles.map(c => {
        if (!c || c.id !== cycleId) return c;
        const nextStartedAt = updates.startedAt ? normalizeToDayStartIso(updates.startedAt) : c.startedAt;
        let nextEndedAt = updates.endedAt !== undefined
            ? (updates.endedAt ? normalizeToDayStartIso(updates.endedAt).replace('T00:00:00.000Z', 'T23:59:59.999Z') : null)
            : c.endedAt;

        if (nextEndedAt && nextStartedAt && new Date(nextEndedAt).getTime() < new Date(nextStartedAt).getTime()) {
            nextEndedAt = new Date(new Date(nextStartedAt).getTime() + 86399999).toISOString();
        }

        return {
            ...c,
            name: updates.name !== undefined ? String(updates.name).trim() || c.name : c.name,
            startedAt: nextStartedAt,
            endedAt: nextEndedAt,
            status: updates.status !== undefined ? updates.status : c.status,
            notes: updates.notes !== undefined ? updates.notes : c.notes,
            triggerType: updates.triggerType !== undefined ? updates.triggerType : c.triggerType,
            updatedAt: nowIso
        };
    });
}

/**
 * Creates a career transition log entry (job loss, search activation, pause, or spike split).
 */
export function createTransitionEvent(event = {}) {
    const nowIso = new Date().toISOString();
    return {
        id: event.id || `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: event.type || 'new_search', // 'job_loss' | 'new_search' | 'search_paused' | 'activity_spike' | 'offer_accepted'
        date: event.date ? normalizeToDayStartIso(event.date) : nowIso,
        company: event.company ? String(event.company).trim() : null,
        role: event.role ? String(event.role).trim() : null,
        note: event.note ? String(event.note).trim() : '',
        cycleId: event.cycleId || null,
        cycleNumber: event.cycleNumber || null,
        createdAt: event.createdAt || nowIso
    };
}

/**
 * Reconciles a legacy active cycle that spans well before October 2, 2026 when an active
 * search began/resumed on October 2, 2026 and hasn't been anchored near October 2 yet.
 */
export function reconcileOctoberSpikeIfNeeded(jobs = [], cycles = [], options = {}) {
    const oct2Iso = options.splitDate || '2026-10-02T00:00:00.000Z';
    const oct2Ms = new Date(oct2Iso).getTime();
    const boundaryThresholdMs = oct2Ms - 7 * 86400000;

    const validJobs = Array.isArray(jobs) ? jobs.filter(j => j && j.status !== 'deleted') : [];
    const resolvedCycles = resolveCyclesFromJobs(validJobs, cycles);
    if (resolvedCycles.length === 0) return { applied: false };

    const activeCycle = getActiveCycle(resolvedCycles);
    if (!activeCycle) return { applied: false };

    const activeStartMs = safeDate(activeCycle.startedAt).getTime();
    if (isNaN(activeStartMs)) return { applied: false };

    // If a v1 auto-reconcile previously anchored at 2026-10-01 but no active jobs are on Oct 1,
    // refine start date cleanly to October 2, 2026.
    if (
        activeCycle.triggerType === 'activity_spike' &&
        typeof activeCycle.startedAt === 'string' &&
        activeCycle.startedAt.startsWith('2026-10-01')
    ) {
        const hasOct1Job = validJobs.some(j => {
            if (j.cycleId && j.cycleId !== activeCycle.id) return false;
            const ms = safeDate(j.appliedAt || j.dateAdded || j.createdAt).getTime();
            return !isNaN(ms) && ms >= new Date('2026-10-01T00:00:00.000Z').getTime() && ms < oct2Ms;
        });
        if (!hasOct1Job) {
            const updatedCycles = updateCyclePeriod(resolvedCycles, activeCycle.id, {
                startedAt: oct2Iso,
                notes: 'Search period started October 2, 2026 following application activity spike.'
            });
            const updatedActive = updatedCycles.find(c => c.id === activeCycle.id);
            return {
                applied: true,
                updatedCycles,
                updatedJobs: jobs,
                changedJobIds: [],
                priorCycle: null,
                newCycle: updatedActive
            };
        }
    }

    // Skip if activeCycle already starts near or after October 2, 2026
    if (activeStartMs >= boundaryThresholdMs) {
        return { applied: false };
    }

    // Do not duplicate if another explicit cycle already starts within +-7 days of Oct 2, 2026
    const hasOctBoundary = resolvedCycles.some(c => {
        if (!c || c.id === activeCycle.id) return false;
        const sMs = safeDate(c.startedAt).getTime();
        return !isNaN(sMs) && Math.abs(sMs - oct2Ms) <= 7 * 86400000;
    });
    if (hasOctBoundary) return { applied: false };

    const jobsInActiveScope = validJobs.filter(j => !j.cycleId || j.cycleId === activeCycle.id);
    const hasOctPlus = jobsInActiveScope.some(j => {
        const ms = safeDate(j.appliedAt || j.dateAdded || j.createdAt).getTime();
        return !isNaN(ms) && ms >= oct2Ms;
    }) || validJobs.some(j => {
        const ms = safeDate(j.appliedAt || j.dateAdded || j.createdAt).getTime();
        return !isNaN(ms) && ms >= oct2Ms;
    });

    if (!hasOctPlus) {
        return { applied: false };
    }

    const splitResult = splitCycleAtDate(resolvedCycles, jobs, activeCycle.id, oct2Iso, {
        name: options.name || 'Current Search (Oct 2026)',
        triggerType: 'activity_spike',
        notes: 'Search period started October 2, 2026 following application activity spike.'
    });

    return {
        applied: true,
        ...splitResult
    };
}
