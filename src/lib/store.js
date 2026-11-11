import { cleanObject } from './utils.js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { canAddJob, isOwner, isProUser, FREE_TIER_MAX_JOBS } from './subscription.js';
import { resolveAppliedAtForStatusChange, findMiscountedApplications } from './goal-tracker.js';
import {
    resolveCyclesFromJobs,
    closeCycleWithAcceptedOffer,
    reopenCycleForRevertedOffer,
    getActiveCycle,
    createCycle,
    splitCycleAtDate as splitCycleAtDateUtil,
    updateCyclePeriod as updateCyclePeriodUtil,
    createTransitionEvent,
    reconcileOctoberSpikeIfNeeded,
    normalizeToDayStartIso
} from './cycle-utils.js';

const APPLIED_AT_CLEANUP_KEY = 'novujobs_appliedAt_cleanup_v1';
const OCT2_RECONCILE_KEY = 'novujobs_oct2_cycle_reconciled_v2';
const appliedAtCleanupInFlight = new Set();
const oct2ReconcileInFlight = new Set();

/**
 * Runs the one-time appliedAt repair for a user (once per device; safe to re-run because
 * repaired jobs no longer match and only stamps written before this build are touched).
 */
function runAppliedAtCleanupOnce(userId, cloudJobs, applyLocal) {
    if (typeof window === 'undefined' || !userId) return;
    const flagKey = `${APPLIED_AT_CLEANUP_KEY}_${userId}`;
    if (appliedAtCleanupInFlight.has(flagKey)) return;
    try {
        if (localStorage.getItem(flagKey)) return;
    } catch {
        return;
    }
    appliedAtCleanupInFlight.add(flagKey);

    const cutoff = process.env.NEXT_PUBLIC_BUILD_TIME || undefined;
    const repairs = findMiscountedApplications(cloudJobs, cutoff);

    const markDone = () => {
        try { localStorage.setItem(flagKey, new Date().toISOString()); } catch { /* ignore */ }
        appliedAtCleanupInFlight.delete(flagKey);
    };

    if (repairs.length === 0) {
        markDone();
        return;
    }

    console.log(`[Store] Repairing ${repairs.length} job(s) miscounted towards the application goal`);
    applyLocal(repairs);
    import('firebase/firestore').then(({ setDoc, doc }) => {
        Promise.all(repairs.map(({ id, appliedAt }) =>
            setDoc(doc(db, "users", userId, "jobs", id), { appliedAt }, { merge: true })
        ))
            .then(markDone)
            .catch(e => {
                appliedAtCleanupInFlight.delete(flagKey);
                console.error("[Store] appliedAt cleanup failed (will retry next load):", e);
            });
    });
}

function saveCyclesToFirestore(userId, cycles, extra = {}) {
    if (typeof window === 'undefined' || !userId || !Array.isArray(cycles)) return;
    import('firebase/firestore').then(({ setDoc, doc }) => {
        const cyclesRef = doc(db, "users", userId, "data", "cycles");
        const payload = cleanObject({
            list: cycles,
            updatedAt: new Date().toISOString(),
            ...extra
        });
        setDoc(cyclesRef, payload, { merge: true })
            .catch(e => console.error("[Store] Failed to save cycles:", e));
    }).catch(e => console.error("[Store] Import failed for saveCyclesToFirestore:", e));
}

function saveJobCycleAssignmentsToFirestore(userId, jobs, changedJobIds) {
    if (typeof window === 'undefined' || !userId || !Array.isArray(changedJobIds) || changedJobIds.length === 0) return;
    const byId = new Map((jobs || []).map(j => [j?.id, j]));
    import('firebase/firestore').then(({ setDoc, doc }) => {
        changedJobIds.forEach(jobId => {
            const job = byId.get(jobId);
            if (!job) return;
            const jobRef = doc(db, "users", userId, "jobs", jobId);
            setDoc(jobRef, {
                cycleId: job.cycleId || null,
                cycleNumber: Number.isInteger(job.cycleNumber) ? job.cycleNumber : Number(job.cycleNumber) || 1
            }, { merge: true }).catch(e => console.error("[Store] Failed to reassign job cycle:", e));
        });
    }).catch(e => console.error("[Store] Import failed for saveJobCycleAssignmentsToFirestore:", e));
}

const ALLOWED_PROFILE_KEYS = new Set([
    'fullName', 'targetRole', 'location', 'keywords', 'isRemote',
    'experienceLevel', 'country', 'modality', 'minimumSalary',
    'contextDocuments', 'resumeAnalysis', 'geminiApiKey',
    'claudeApiKey', 'openaiApiKey', 'customAiApiKey', 'customAiBaseUrl', 'customAiModel', 'activeAiProvider',
    'googleMapsApiKey', 'subscriptionStatus', 'trialStartDate', 'trialEndDate',
    'applicationGoal', 'updatedAt'
]);

const ALLOWED_GOAL_KEYS = new Set([
    'target', 'cadence', 'targetRole', 'hoursPerWeek',
    'reminderEnabled', 'enabled', 'startDate', 'updatedAt'
]);

const ALLOWED_JOB_KEYS = new Set([
    'id', 'role', 'title', 'company', 'location', 'salary',
    'url', 'link', 'description', 'notes', 'commuteTime',
    'relevanceScore', 'matchReason', 'status', 'createdAt',
    'updatedAt', 'appliedAt', 'dateAdded', 'deletedAt', 'archivedAt',
    'previousStatus', 'source', 'pubDate', 'tags',
    'resumeUrl', 'resumeName', 'cycleId', 'cycleNumber',
    'followUps', 'lastFollowUpAt', 'lastInteraction'
]);

const PROFILE_STRING_LIMITS = {
    fullName: 100,
    targetRole: 100,
    location: 200,
    keywords: 1000,
    experienceLevel: 250,
    country: 100,
    modality: 250,
    minimumSalary: 50,
    geminiApiKey: 200,
    claudeApiKey: 200,
    openaiApiKey: 200,
    customAiApiKey: 200,
    customAiBaseUrl: 250,
    customAiModel: 100,
    activeAiProvider: 50,
    googleMapsApiKey: 200
};

const JOB_STRING_LIMITS = {
    role: 200,
    title: 200,
    company: 200,
    location: 200,
    salary: 100,
    url: 2048,
    link: 2048,
    description: 50000,
    notes: 10000,
    commuteTime: 200,
    matchReason: 2000,
    source: 100,
    pubDate: 100,
    resumeUrl: 2048,
    resumeName: 200,
    cycleId: 100
};

const VALID_JOB_STATUSES = new Set([
    'wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'archived', 'deleted'
]);

const VALID_PREVIOUS_STATUSES = new Set([
    'wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected', 'archived'
]);

export function sanitizeProfileForFirestore(rawProfile) {
    if (!rawProfile || typeof rawProfile !== 'object') return {};
    const cleaned = {};
    const currentIsOwner = isOwner(auth?.currentUser);
    const envGemini = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_GEMINI_API_KEY || '').trim() : '';
    const envMaps = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim() : '';

    for (const key of Object.keys(rawProfile)) {
        if (!ALLOWED_PROFILE_KEYS.has(key) || key === 'contextDocuments') continue;
        const val = rawProfile[key];
        if (val === undefined) continue;
        if (!currentIsOwner && key === 'geminiApiKey' && envGemini && String(val).trim() === envGemini) {
            cleaned[key] = '';
            continue;
        }
        if (!currentIsOwner && key === 'googleMapsApiKey' && envMaps && String(val).trim() === envMaps) {
            cleaned[key] = '';
            continue;
        }
        if (key === 'minimumSalary') {
            cleaned[key] = val === null ? '' : String(val).slice(0, 50);
        } else if (key === 'applicationGoal' && val && typeof val === 'object') {
            const goalClean = {};
            for (const gKey of Object.keys(val)) {
                if (ALLOWED_GOAL_KEYS.has(gKey) && val[gKey] !== undefined) {
                    goalClean[gKey] = val[gKey];
                }
            }
            goalClean.target = Math.max(1, Math.min(1000, parseInt(goalClean.target, 10) || 10));
            goalClean.cadence = ['daily', 'weekly', 'monthly', 'total'].includes(goalClean.cadence)
                ? goalClean.cadence
                : 'weekly';
            if (typeof goalClean.targetRole === 'string') {
                goalClean.targetRole = goalClean.targetRole.slice(0, 100);
            }
            if (goalClean.hoursPerWeek !== undefined) {
                goalClean.hoursPerWeek = Math.max(0, Math.min(168, Number(goalClean.hoursPerWeek) || 5));
            }
            cleaned[key] = goalClean;
        } else if (typeof val === 'string' && PROFILE_STRING_LIMITS[key]) {
            cleaned[key] = val.slice(0, PROFILE_STRING_LIMITS[key]);
        } else {
            cleaned[key] = val;
        }
    }
    return cleaned;
}

export function sanitizeJobForFirestore(rawJob) {
    if (!rawJob || typeof rawJob !== 'object') return {};
    const cleaned = {};
    for (const key of Object.keys(rawJob)) {
        if (!ALLOWED_JOB_KEYS.has(key)) continue;
        const val = rawJob[key];
        if (val === undefined) continue;
        if (key === 'status') {
            cleaned[key] = VALID_JOB_STATUSES.has(val) ? val : 'wishlist';
        } else if (key === 'previousStatus') {
            if (val === null) {
                cleaned[key] = null;
            } else if (VALID_PREVIOUS_STATUSES.has(val)) {
                cleaned[key] = val;
            }
        } else if (typeof val === 'string' && JOB_STRING_LIMITS[key]) {
            cleaned[key] = val.slice(0, JOB_STRING_LIMITS[key]);
        } else {
            cleaned[key] = val;
        }
    }
    return cleaned;
}

export const useAppStore = create(
    persist(
        (set, get) => ({
            jobs: [],
            cycles: [],
            selectedCycleId: 'active',
            jobSearchMode: true,
            transitionLog: [],
            oct2Reconciled: false,
            offerCelebrationModal: null,
            currentUserId: null, // Track which user's data this is

            // Cycle Management Actions
            setSelectedCycleId: (cycleId) => set({ selectedCycleId: cycleId }),
            closeOfferCelebrationModal: () => set({ offerCelebrationModal: null }),
            setCycles: (cycles) => set({ cycles: Array.isArray(cycles) ? cycles : [] }),
            startNewCycle: (name, options = {}) => {
                const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                const maxNum = Math.max(...currentCycles.map(c => Number(c?.cycleNumber) || 1), 0);
                const nextNum = maxNum + 1;
                const nowIso = new Date().toISOString();
                const startedAtIso = options.startedAt ? normalizeToDayStartIso(options.startedAt) : nowIso;
                const startedMs = new Date(startedAtIso).getTime();
                const endedPrevIso = !isNaN(startedMs) && startedAtIso !== nowIso
                    ? new Date(startedMs - 1).toISOString()
                    : nowIso;

                const newCycle = createCycle(nextNum, {
                    name: name || `Search Cycle ${nextNum}`,
                    status: 'active',
                    startedAt: startedAtIso,
                    triggerType: options.triggerType || 'manual',
                    notes: options.notes || null
                });
                const updatedCycles = [
                    ...currentCycles.map(c => c.status === 'active' ? { ...c, status: 'completed', endedAt: endedPrevIso, updatedAt: nowIso } : c),
                    newCycle
                ];
                const transitionLog = Array.isArray(get().transitionLog) ? get().transitionLog : [];
                const nextLog = options.skipLog
                    ? transitionLog
                    : [
                        createTransitionEvent({
                            type: options.triggerType || 'new_search',
                            date: startedAtIso,
                            note: options.notes || `Opened ${newCycle.name}`,
                            cycleId: newCycle.id,
                            cycleNumber: newCycle.cycleNumber
                        }),
                        ...transitionLog
                    ];

                set({
                    cycles: updatedCycles,
                    selectedCycleId: newCycle.id,
                    jobSearchMode: true,
                    transitionLog: nextLog
                });
                const userId = get().currentUserId || auth?.currentUser?.uid;
                saveCyclesToFirestore(userId, updatedCycles, {
                    jobSearchMode: true,
                    transitionLog: nextLog
                });
                return newCycle;
            },
            reopenCycle: (cycleId) => {
                const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                const updatedCycles = currentCycles.map(c => {
                    if (c.id === cycleId) {
                        return {
                            ...c,
                            status: 'active',
                            endedAt: null,
                            updatedAt: new Date().toISOString()
                        };
                    }
                    return c;
                });
                set({ cycles: updatedCycles, selectedCycleId: cycleId, jobSearchMode: true });
                const userId = get().currentUserId || auth?.currentUser?.uid;
                saveCyclesToFirestore(userId, updatedCycles, { jobSearchMode: true });
            },
            splitCycleAtDate: (splitDate, options = {}) => {
                const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                const result = splitCycleAtDateUtil(
                    currentCycles,
                    get().jobs,
                    options.targetCycleId || null,
                    splitDate,
                    options
                );
                if (!result.newCycle) return null;

                const transitionLog = Array.isArray(get().transitionLog) ? get().transitionLog : [];
                const nextLog = options.skipLog
                    ? transitionLog
                    : [
                        createTransitionEvent({
                            type: options.triggerType || 'activity_spike',
                            date: result.newCycle.startedAt,
                            note: options.notes || `Started ${result.newCycle.name}`,
                            cycleId: result.newCycle.id,
                            cycleNumber: result.newCycle.cycleNumber
                        }),
                        ...transitionLog
                    ];

                set({
                    cycles: result.updatedCycles,
                    jobs: result.updatedJobs,
                    selectedCycleId: result.newCycle.id,
                    jobSearchMode: true,
                    transitionLog: nextLog
                });
                const userId = get().currentUserId || auth?.currentUser?.uid;
                saveCyclesToFirestore(userId, result.updatedCycles, {
                    jobSearchMode: true,
                    transitionLog: nextLog
                });
                saveJobCycleAssignmentsToFirestore(userId, result.updatedJobs, result.changedJobIds);
                return result;
            },
            updateCyclePeriod: (cycleId, updates = {}) => {
                const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                const updatedCycles = updateCyclePeriodUtil(currentCycles, cycleId, updates);
                set({ cycles: updatedCycles });
                const userId = get().currentUserId || auth?.currentUser?.uid;
                saveCyclesToFirestore(userId, updatedCycles);
                return updatedCycles.find(c => c.id === cycleId) || null;
            },
            setJobSearchMode: (enabled, options = {}) => {
                const isActive = Boolean(enabled);
                const currentLog = Array.isArray(get().transitionLog) ? get().transitionLog : [];
                const dateIso = options.date ? normalizeToDayStartIso(options.date) : new Date().toISOString();

                if (isActive && options.openNewCycle) {
                    return get().startNewCycle(options.cycleName, {
                        startedAt: dateIso,
                        triggerType: options.triggerType || 'manual_toggle',
                        notes: options.note || 'Manually activated Job Search Mode & opened new cycle'
                    });
                }

                const evt = createTransitionEvent({
                    type: isActive ? 'new_search' : 'search_paused',
                    date: dateIso,
                    note: options.note || (isActive ? 'Activated Job Search Mode' : 'Paused Job Search Mode (Standby / Employed)')
                });
                const nextLog = options.skipLog ? currentLog : [evt, ...currentLog];
                const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);

                set({ jobSearchMode: isActive, transitionLog: nextLog });
                const userId = get().currentUserId || auth?.currentUser?.uid;
                saveCyclesToFirestore(userId, currentCycles, {
                    jobSearchMode: isActive,
                    transitionLog: nextLog
                });
                return evt;
            },
            logJobLossAndStartSearch: ({ date, company, role, note, cycleName } = {}) => {
                const effectiveIso = date ? normalizeToDayStartIso(date) : normalizeToDayStartIso(new Date().toISOString());
                const effectiveMs = new Date(effectiveIso).getTime();
                const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                const currentJobs = get().jobs || [];
                const shortLabel = effectiveIso.slice(0, 10);
                const resolvedName = (cycleName && String(cycleName).trim()) || `New Search (${shortLabel})`;
                const resolvedNote = (note && String(note).trim()) || (company ? `Role ended at ${company} — activated active search cycle` : 'Logged role transition — activated Job Search Mode');

                // Split or open new cycle at effective date so jobs from effective date onward track in new cycle
                const hasJobsFromEffectiveDate = currentJobs.some(j => {
                    if (!j || j.status === 'deleted') return false;
                    const ms = new Date(j.appliedAt || j.dateAdded || j.createdAt || 0).getTime();
                    return !isNaN(ms) && ms >= effectiveMs;
                });

                let nextCycles;
                let nextJobs = currentJobs;
                let changedJobIds = [];
                let newCycle;

                if (hasJobsFromEffectiveDate) {
                    const splitRes = splitCycleAtDateUtil(currentCycles, currentJobs, null, effectiveIso, {
                        name: resolvedName,
                        triggerType: 'job_loss',
                        notes: resolvedNote
                    });
                    nextCycles = splitRes.updatedCycles;
                    nextJobs = splitRes.updatedJobs;
                    changedJobIds = splitRes.changedJobIds;
                    newCycle = splitRes.newCycle;
                } else {
                    const maxNum = Math.max(...currentCycles.map(c => Number(c?.cycleNumber) || 1), 0);
                    const nextNum = maxNum + 1;
                    newCycle = createCycle(nextNum, {
                        name: resolvedName,
                        status: 'active',
                        startedAt: effectiveIso,
                        triggerType: 'job_loss',
                        notes: resolvedNote
                    });
                    const prevEndIso = new Date(effectiveMs - 1).toISOString();
                    nextCycles = [
                        ...currentCycles.map(c => c.status === 'active' ? { ...c, status: 'completed', endedAt: prevEndIso, updatedAt: new Date().toISOString() } : c),
                        newCycle
                    ];
                }

                const evt = createTransitionEvent({
                    type: 'job_loss',
                    date: effectiveIso,
                    company: company || null,
                    role: role || null,
                    note: resolvedNote,
                    cycleId: newCycle?.id || null,
                    cycleNumber: newCycle?.cycleNumber || null
                });
                const currentLog = Array.isArray(get().transitionLog) ? get().transitionLog : [];
                const nextLog = [evt, ...currentLog];

                set({
                    cycles: nextCycles,
                    jobs: nextJobs,
                    selectedCycleId: newCycle?.id || 'active',
                    jobSearchMode: true,
                    transitionLog: nextLog
                });

                const userId = get().currentUserId || auth?.currentUser?.uid;
                saveCyclesToFirestore(userId, nextCycles, {
                    jobSearchMode: true,
                    transitionLog: nextLog
                });
                if (changedJobIds.length > 0) {
                    saveJobCycleAssignmentsToFirestore(userId, nextJobs, changedJobIds);
                }

                return { newCycle, event: evt };
            },
            deleteTransitionEvent: (eventId) => {
                if (!eventId) return;
                const currentLog = Array.isArray(get().transitionLog) ? get().transitionLog : [];
                const nextLog = currentLog.filter(e => e && e.id !== eventId);
                set({ transitionLog: nextLog });
                const userId = get().currentUserId || auth?.currentUser?.uid;
                const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                saveCyclesToFirestore(userId, currentCycles, { transitionLog: nextLog });
            },

            // Set the current user ID and clear data if user changed
            setCurrentUser: (userId) => {
                const currentUserId = get().currentUserId;
                // Do nothing if same user
                if (currentUserId === userId) {
                    console.log("Same user, skipping state update");
                    return;
                }

                // Different user or fresh login after logout - always start with clean state for this userId
                // so previous browser session data never leaks across accounts
                console.log("User changed or initialized, resetting local cache for user:", userId);
                set({
                    jobs: [],
                    cycles: [],
                    selectedCycleId: 'active',
                    jobSearchMode: true,
                    transitionLog: [],
                    oct2Reconciled: false,
                    offerCelebrationModal: null,
                    profile: {
                        fullName: '',
                        targetRole: '',
                        location: 'Puerto Rico',
                        keywords: '',
                        isRemote: false,
                        experienceLevel: 'Mid-Senior',
                        country: '',
                        modality: 'Remote',
                        minimumSalary: '',
                        contextDocuments: [],
                        geminiApiKey: '',
                        claudeApiKey: '',
                        openaiApiKey: '',
                        customAiApiKey: '',
                        customAiBaseUrl: '',
                        customAiModel: '',
                        activeAiProvider: 'gemini',
                        googleMapsApiKey: '',
                        subscriptionStatus: 'free', // 'free', 'premium', 'trial'
                        trialStartDate: null,
                        trialEndDate: null
                    },
                    currentUserId: userId
                });
            },

            // Clear all user data on logout
            clearUserData: () => {
                console.log("Clearing user data on logout");
                set({
                    jobs: [],
                    cycles: [],
                    selectedCycleId: 'active',
                    jobSearchMode: true,
                    transitionLog: [],
                    oct2Reconciled: false,
                    offerCelebrationModal: null,
                    currentUserId: null,
                    profile: {
                        fullName: '',
                        targetRole: '',
                        location: 'Puerto Rico',
                        keywords: '',
                        isRemote: false,
                        experienceLevel: 'Mid-Senior',
                        country: '',
                        modality: 'Remote',
                        minimumSalary: '',
                        contextDocuments: [],
                        geminiApiKey: '',
                        claudeApiKey: '',
                        openaiApiKey: '',
                        customAiApiKey: '',
                        customAiBaseUrl: '',
                        customAiModel: '',
                        activeAiProvider: 'gemini',
                        googleMapsApiKey: '',
                        subscriptionStatus: 'free',
                        trialStartDate: null,
                        trialEndDate: null
                    }
                });
            },

            addJob: (job) => {
                // Enforce Firebase cost protection for free tier (max 25 active jobs)
                const currentActiveJobs = get().jobs.filter(j => j?.status !== 'deleted' && j?.status !== 'archived');
                const currentUser = auth?.currentUser;
                const profile = get().profile;
                const check = canAddJob(currentUser, profile, currentActiveJobs.length);

                if (!check.allowed) {
                    const error = new Error(
                        `Free tier limit reached (${FREE_TIER_MAX_JOBS} active jobs). Upgrade to NovuJobs Pro ($9.99/mo) for unlimited tracking.`
                    );
                    error.code = 'LIMIT_REACHED';
                    throw error;
                }

                // Safe UUID generation fallback for non-secure contexts (HTTP network testing)
                const generateId = () => {
                    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                        return crypto.randomUUID();
                    }
                    return Date.now().toString(36) + Math.random().toString(36).substring(2);
                };

                const nowIso = new Date().toISOString();
                const initialStatus = job?.status || 'applied';

                const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                const activeCycle = getActiveCycle(currentCycles);
                const targetCycleId = job?.cycleId || activeCycle?.id || 'cycle_1';
                const targetCycleNumber = job?.cycleNumber || activeCycle?.cycleNumber || 1;

                const newJob = {
                    status: initialStatus,
                    ...job,
                    id: generateId(),
                    createdAt: nowIso,
                    cycleId: targetCycleId,
                    cycleNumber: targetCycleNumber,
                    ...(initialStatus !== 'wishlist' && initialStatus !== 'deleted' && initialStatus !== 'archived' && !job?.appliedAt
                        ? { appliedAt: nowIso }
                        : {})
                };

                const userId = get().currentUserId || auth?.currentUser?.uid;

                if (initialStatus === 'accepted') {
                    const { updatedCycles, closedCycle, newActiveCycle } = closeCycleWithAcceptedOffer(currentCycles, newJob);
                    newJob.cycleId = closedCycle.id;
                    newJob.cycleNumber = closedCycle.cycleNumber;
                    set((state) => ({
                        jobs: [...state.jobs, newJob],
                        cycles: updatedCycles,
                        offerCelebrationModal: {
                            isOpen: true,
                            cycle: closedCycle,
                            nextCycle: newActiveCycle,
                            acceptedJob: newJob
                        }
                    }));
                    saveCyclesToFirestore(userId, updatedCycles);
                } else {
                    set((state) => ({
                        jobs: [...state.jobs, newJob],
                        cycles: currentCycles
                    }));
                    if (!get().cycles || get().cycles.length === 0) {
                        saveCyclesToFirestore(userId, currentCycles);
                    }
                }

                // Persist to Firestore
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        const jobRef = doc(db, "users", userId, "jobs", newJob.id);
                        const cleanJob = sanitizeJobForFirestore(cleanObject(newJob));
                        setDoc(jobRef, cleanJob, { merge: true }).catch(e => console.error("[Store] Failed to save new job:", e));
                    });
                }
                return newJob;
            },
            updateJob: (id, updates) => {
                const existingJob = get().jobs.find(j => j?.id === id);
                const nowIso = new Date().toISOString();
                const resolvedAppliedAt = updates?.status && !updates.appliedAt
                    ? resolveAppliedAtForStatusChange(existingJob, updates.status, nowIso)
                    : undefined;
                const statusChanged = Boolean(
                    updates?.status &&
                    existingJob?.status &&
                    updates.status !== existingJob.status &&
                    VALID_PREVIOUS_STATUSES.has(existingJob.status)
                );

                const isBecomingAccepted = updates?.status === 'accepted' && existingJob?.status !== 'accepted';
                const isLeavingAccepted = existingJob?.status === 'accepted' && updates?.status && updates.status !== 'accepted';

                const enrichedUpdates = {
                    ...updates,
                    ...(statusChanged && updates.previousStatus === undefined
                        ? { previousStatus: existingJob.status }
                        : {}),
                    ...(resolvedAppliedAt ? { appliedAt: resolvedAppliedAt, updatedAt: nowIso } : {})
                };

                const userId = get().currentUserId || auth?.currentUser?.uid;

                if (isBecomingAccepted) {
                    const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                    const candidateJob = { ...existingJob, ...enrichedUpdates };
                    const { updatedCycles, closedCycle, newActiveCycle } = closeCycleWithAcceptedOffer(currentCycles, candidateJob);
                    enrichedUpdates.cycleId = closedCycle.id;
                    enrichedUpdates.cycleNumber = closedCycle.cycleNumber;
                    set({
                        cycles: updatedCycles,
                        offerCelebrationModal: {
                            isOpen: true,
                            cycle: closedCycle,
                            nextCycle: newActiveCycle,
                            acceptedJob: { ...candidateJob, cycleId: closedCycle.id, cycleNumber: closedCycle.cycleNumber }
                        }
                    });
                    saveCyclesToFirestore(userId, updatedCycles);
                } else if (isLeavingAccepted) {
                    const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                    const reopenedCycles = reopenCycleForRevertedOffer(currentCycles, id, get().jobs);
                    set({ cycles: reopenedCycles });
                    saveCyclesToFirestore(userId, reopenedCycles);
                }

                set((state) => ({
                    jobs: state.jobs.map((job) => (job?.id === id ? { ...job, ...enrichedUpdates } : job))
                }));
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        const jobRef = doc(db, "users", userId, "jobs", id);
                        const cleanUpdates = sanitizeJobForFirestore(cleanObject(enrichedUpdates));
                        setDoc(jobRef, cleanUpdates, { merge: true }).catch(e => console.error("[Store] Failed to update job:", e));
                    });
                }
            },
            logJobFollowUp: (id, followUpData = {}) => {
                const existingJob = get().jobs.find(j => j?.id === id);
                if (!existingJob) return null;
                const nowIso = new Date().toISOString();
                const followUpEntry = {
                    id: followUpData.id || `fu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    date: followUpData.date || nowIso,
                    channel: followUpData.channel || followUpData.method || 'email',
                    note: followUpData.note || followUpData.notes || 'Follow-up outreach sent',
                    createdAt: nowIso
                };
                const followUps = Array.isArray(existingJob.followUps)
                    ? [followUpEntry, ...existingJob.followUps]
                    : [followUpEntry];

                followUps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const latestFollowUpAt = followUps[0].date;

                const updates = {
                    followUps,
                    lastFollowUpAt: latestFollowUpAt,
                    lastInteraction: latestFollowUpAt,
                    updatedAt: nowIso
                };

                get().updateJob(id, updates);
                return followUpEntry;
            },
            deleteJobFollowUp: (jobId, followUpId) => {
                const existingJob = get().jobs.find(j => j?.id === jobId);
                if (!existingJob) return;
                const followUps = (existingJob.followUps || []).filter(f => f.id !== followUpId);
                const nowIso = new Date().toISOString();
                const latestFollowUpAt = followUps.length > 0 ? followUps[0].date : null;
                const updates = {
                    followUps,
                    lastFollowUpAt: latestFollowUpAt,
                    lastInteraction: latestFollowUpAt || existingJob.appliedAt || existingJob.createdAt || nowIso,
                    updatedAt: nowIso
                };
                get().updateJob(jobId, updates);
            },
            archiveJob: (id) => {
                const job = get().jobs.find(j => j?.id === id);
                const previousStatus = (job?.status && job.status !== 'archived' && job.status !== 'deleted')
                    ? job.status
                    : (job?.previousStatus || 'wishlist');
                const nowIso = new Date().toISOString();
                const updates = {
                    status: 'archived',
                    archivedAt: nowIso,
                    updatedAt: nowIso,
                    previousStatus
                };
                set((state) => ({
                    jobs: state.jobs.map((j) =>
                        j.id === id ? { ...j, ...updates } : j
                    )
                }));
                const userId = get().currentUserId || auth?.currentUser?.uid;
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        setDoc(doc(db, "users", userId, "jobs", id), updates, { merge: true })
                            .catch(e => console.error("[Store] Failed to archive job:", e));
                    });
                }
            },
            deleteJob: (id) => {
                const job = get().jobs.find(j => j?.id === id);
                const previousStatus = (job?.status && job.status !== 'deleted')
                    ? job.status
                    : (job?.previousStatus || 'wishlist');
                const updates = { status: 'deleted', deletedAt: new Date().toISOString(), previousStatus };
                set((state) => ({
                    jobs: state.jobs.map((j) =>
                        j.id === id ? { ...j, ...updates } : j
                    )
                }));
                const userId = get().currentUserId || auth?.currentUser?.uid;
                if (userId) {
                    import('firebase/firestore').then(({ updateDoc, doc }) => {
                        updateDoc(doc(db, "users", userId, "jobs", id), updates)
                            .catch(e => console.error("[Store] Failed to soft-delete job:", e));
                    });
                }
            },
            restoreJob: (id) => {
                const job = get().jobs.find(j => j?.id === id);
                const targetStatus = (job?.previousStatus && job.previousStatus !== 'deleted' && job.previousStatus !== 'archived')
                    ? job.previousStatus
                    : 'wishlist';
                const updates = {
                    status: targetStatus,
                    deletedAt: null,
                    archivedAt: null,
                    previousStatus: null,
                    updatedAt: new Date().toISOString()
                };
                set((state) => ({
                    jobs: state.jobs.map((j) =>
                        j.id === id ? { ...j, ...updates } : j
                    )
                }));
                const userId = get().currentUserId || auth?.currentUser?.uid;
                if (userId) {
                    import('firebase/firestore').then(({ updateDoc, doc, deleteField }) => {
                        updateDoc(doc(db, "users", userId, "jobs", id), {
                            status: updates.status,
                            updatedAt: updates.updatedAt,
                            deletedAt: deleteField(),
                            archivedAt: deleteField(),
                            previousStatus: deleteField()
                        }).catch(e => console.error("[Store] Failed to restore job:", e));
                    });
                }
            },
            permanentDeleteJob: (id) => {
                set((state) => ({
                    jobs: state.jobs.filter((job) => job?.id !== id)
                }));
                const userId = get().currentUserId || auth?.currentUser?.uid;
                if (userId) {
                    import('firebase/firestore').then(({ deleteDoc, doc }) => {
                        deleteDoc(doc(db, "users", userId, "jobs", id))
                            .catch(e => console.error("[Store] Failed to permanently delete job:", e));
                    });
                }
            },
            moveJob: (id, newStatus) => {
                if (newStatus === 'archived') {
                    get().archiveJob(id);
                    return;
                }
                if (newStatus === 'deleted') {
                    get().deleteJob(id);
                    return;
                }
                const existingJob = get().jobs.find(j => j?.id === id);
                const nowIso = new Date().toISOString();
                const resolvedAppliedAt = resolveAppliedAtForStatusChange(existingJob, newStatus, nowIso);
                const shouldRecordPrevStatus = Boolean(
                    existingJob?.status &&
                    existingJob.status !== newStatus &&
                    existingJob.status !== 'archived' &&
                    existingJob.status !== 'deleted' &&
                    VALID_PREVIOUS_STATUSES.has(existingJob.status)
                );

                const isBecomingAccepted = newStatus === 'accepted' && existingJob?.status !== 'accepted';
                const isLeavingAccepted = existingJob?.status === 'accepted' && newStatus !== 'accepted';

                const updates = {
                    status: newStatus,
                    updatedAt: nowIso,
                    ...(resolvedAppliedAt ? { appliedAt: resolvedAppliedAt } : {}),
                    ...(shouldRecordPrevStatus
                        ? { previousStatus: existingJob.status }
                        : (existingJob?.status === 'archived' || existingJob?.status === 'deleted'
                            ? { archivedAt: null, deletedAt: null, previousStatus: null }
                            : {}))
                };

                const userId = get().currentUserId || auth?.currentUser?.uid;

                if (isBecomingAccepted) {
                    const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                    const candidateJob = { ...existingJob, ...updates };
                    const { updatedCycles, closedCycle, newActiveCycle } = closeCycleWithAcceptedOffer(currentCycles, candidateJob);
                    updates.cycleId = closedCycle.id;
                    updates.cycleNumber = closedCycle.cycleNumber;
                    set({
                        cycles: updatedCycles,
                        offerCelebrationModal: {
                            isOpen: true,
                            cycle: closedCycle,
                            nextCycle: newActiveCycle,
                            acceptedJob: { ...candidateJob, cycleId: closedCycle.id, cycleNumber: closedCycle.cycleNumber }
                        }
                    });
                    saveCyclesToFirestore(userId, updatedCycles);
                } else if (isLeavingAccepted) {
                    const currentCycles = resolveCyclesFromJobs(get().jobs, get().cycles);
                    const reopenedCycles = reopenCycleForRevertedOffer(currentCycles, id, get().jobs);
                    set({ cycles: reopenedCycles });
                    saveCyclesToFirestore(userId, reopenedCycles);
                }

                set((state) => ({
                    jobs: state.jobs.map((job) => (job?.id === id ? { ...job, ...updates } : job))
                }));
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        setDoc(doc(db, "users", userId, "jobs", id), sanitizeJobForFirestore(cleanObject(updates)), { merge: true })
                            .catch(e => console.error("[Store] Failed to move job:", e));
                    });
                }
            },

            // Profile State
            profile: {
                fullName: '',
                targetRole: '',
                location: 'Puerto Rico',
                keywords: '',
                isRemote: false,
                experienceLevel: 'Mid-Senior',
                country: '',
                modality: 'Remote',
                minimumSalary: '',
                contextDocuments: [], // { name, content, type }
                resumeAnalysis: null, // { skills, summary, targetRoles, etc }
                geminiApiKey: '', // User provided API key (overrides env var)
                claudeApiKey: '', // User provided Anthropic Claude API key
                openaiApiKey: '', // User provided OpenAI API key
                customAiApiKey: '', // User provided custom API key (e.g. DeepSeek, Groq, OpenRouter)
                customAiBaseUrl: '', // e.g. https://api.deepseek.com/v1 or https://api.groq.com/openai/v1
                customAiModel: '', // e.g. deepseek-chat or llama-3.3-70b-versatile
                activeAiProvider: 'gemini', // 'gemini' | 'claude' | 'openai' | 'custom'
                googleMapsApiKey: '', // Google Maps API Key for commute & location intelligence
                subscriptionStatus: 'free',
                trialStartDate: null,
                trialEndDate: null
            },
            isPremium: () => {
                const currentUser = auth?.currentUser;
                const profile = get().profile;
                return isOwner(currentUser) || isProUser(currentUser, profile);
            },
            updateProfile: async (newProfile) => {
                const nowIso = new Date().toISOString();
                const payloadWithTimestamp = {
                    ...newProfile,
                    updatedAt: nowIso
                };
                set((state) => ({
                    profile: { ...state.profile, ...payloadWithTimestamp }
                }));
                const userId = get().currentUserId || auth?.currentUser?.uid;
                if (userId) {
                    try {
                        const { setDoc, doc } = await import('firebase/firestore');
                        const profileRef = doc(db, "users", userId, "data", "profile");
                        const fullCurrentProfile = get().profile;
                        const cleanProfile = sanitizeProfileForFirestore({
                            ...fullCurrentProfile,
                            ...payloadWithTimestamp
                        });
                        if (Object.keys(cleanProfile).length > 0) {
                            await setDoc(profileRef, cleanProfile, { merge: true });
                        }
                        return { success: true, synced: true };
                    } catch (e) {
                        console.error("[Store] Failed to update profile:", e);
                        return { success: true, synced: false, error: e?.message };
                    }
                }
                return { success: true, synced: false };
            },
            addContextDocument: (docData) => set((state) => ({
                profile: {
                    ...state.profile,
                    contextDocuments: [...(state.profile.contextDocuments || []), docData]
                }
            })),
            removeContextDocument: (index) => set((state) => ({
                profile: {
                    ...state.profile,
                    contextDocuments: state.profile.contextDocuments.filter((_, i) => i !== index)
                }
            })),

            // Firestore Sync
            subscribeToFirestore: (userId) => {
                if (!userId) {
                    console.warn("[Store] No userId provided to subscribeToFirestore");
                    return () => { };
                }

                console.log("[Store] Subscribing to Firestore for user:", userId);

                // 1. Profile Listener
                const profileRef = doc(db, "users", userId, "data", "profile");
                const profileUnsub = onSnapshot(profileRef,
                    (docSnap) => {
                        if (docSnap.exists()) {
                            console.log("[Store] Profile data received from Firestore");
                            const remoteData = docSnap.data() || {};
                            const localProfile = get().profile || {};

                            const remoteTime = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;
                            const localTime = localProfile.updatedAt ? new Date(localProfile.updatedAt).getTime() : 0;

                            // Preserve local non-empty user fields if local state is newer or if remote was missing fields
                            const mergedProfile = { ...localProfile, ...remoteData };
                            let needsCloudCatchup = false;

                            const userEditableFields = [
                                'fullName', 'targetRole', 'location', 'keywords',
                                'experienceLevel', 'country', 'modality', 'minimumSalary',
                                'geminiApiKey', 'claudeApiKey', 'openaiApiKey',
                                'customAiApiKey', 'customAiBaseUrl', 'customAiModel', 'activeAiProvider',
                                'googleMapsApiKey', 'applicationGoal', 'resumeAnalysis'
                            ];

                            if (localTime > remoteTime) {
                                for (const field of userEditableFields) {
                                    if (localProfile[field] !== undefined && localProfile[field] !== '') {
                                        mergedProfile[field] = localProfile[field];
                                    }
                                }
                                mergedProfile.updatedAt = localProfile.updatedAt;
                                needsCloudCatchup = true;
                            } else {
                                // Even if timestamps aren't set yet, don't let empty/missing remote fields wipe populated local fields
                                for (const field of userEditableFields) {
                                    const localVal = localProfile[field];
                                    const remoteVal = remoteData[field];
                                    const hasLocalVal = localVal !== undefined && localVal !== null && localVal !== '';
                                    const isRemoteEmpty = remoteVal === undefined || remoteVal === null || remoteVal === '';
                                    if (hasLocalVal && isRemoteEmpty) {
                                        mergedProfile[field] = localVal;
                                        needsCloudCatchup = true;
                                    }
                                }
                            }

                            set({ profile: mergedProfile });

                            if (needsCloudCatchup) {
                                import('firebase/firestore').then(({ setDoc }) => {
                                    const cleanMerged = sanitizeProfileForFirestore(mergedProfile);
                                    if (Object.keys(cleanMerged).length > 0) {
                                        setDoc(profileRef, cleanMerged, { merge: true }).catch(e =>
                                            console.error("[Store] Failed to sync local profile fields to Firestore:", e)
                                        );
                                    }
                                });
                            }
                        } else {
                            console.log("[Store] No profile data in Firestore yet - initializing trial");
                            const now = new Date();
                            const endDate = new Date();
                            endDate.setDate(now.getDate() + 14);
                            const localProfile = get().profile || {};
                            const initialProfile = {
                                ...localProfile,
                                trialStartDate: localProfile.trialStartDate || now.toISOString(),
                                trialEndDate: localProfile.trialEndDate || endDate.toISOString(),
                                subscriptionStatus: localProfile.subscriptionStatus && localProfile.subscriptionStatus !== 'free'
                                    ? localProfile.subscriptionStatus
                                    : 'trial',
                                updatedAt: now.toISOString()
                            };
                            set({ profile: initialProfile });
                            import('firebase/firestore').then(({ setDoc }) => {
                                const cleanInitial = sanitizeProfileForFirestore(initialProfile);
                                setDoc(profileRef, cleanInitial, { merge: true }).catch(e => console.error("Failed to init trial:", e));
                            });
                        }
                    },
                    (error) => {
                        console.error("[Store] Profile snapshot error:", error);
                    }
                );

                let hasLoadedJobsSnapshot = false;
                let hasLoadedCyclesSnapshot = false;

                const maybeRunOct2CycleReconciliation = () => {
                    if (typeof window === 'undefined' || !userId) return;
                    if (!hasLoadedJobsSnapshot || !hasLoadedCyclesSnapshot) return;
                    if (!isOwner(auth?.currentUser)) return;
                    if (get().oct2Reconciled) return;
                    const flagKey = `${OCT2_RECONCILE_KEY}_${userId}`;
                    if (oct2ReconcileInFlight.has(flagKey)) return;
                    try {
                        if (localStorage.getItem(flagKey)) return;
                    } catch {
                        return;
                    }
                    const currentJobs = get().jobs || [];
                    const currentCycles = resolveCyclesFromJobs(currentJobs, get().cycles || []);
                    if (currentJobs.length === 0 || currentCycles.length === 0) return;

                    oct2ReconcileInFlight.add(flagKey);
                    const rec = reconcileOctoberSpikeIfNeeded(currentJobs, currentCycles);
                    try { localStorage.setItem(flagKey, new Date().toISOString()); } catch { /* ignore */ }
                    oct2ReconcileInFlight.delete(flagKey);

                    if (rec.applied) {
                        const existingLog = Array.isArray(get().transitionLog) ? get().transitionLog : [];
                        const octEvt = createTransitionEvent({
                            type: 'activity_spike',
                            date: '2026-10-02T00:00:00.000Z',
                            note: 'Current search period started October 2, 2026 following application activity spike.',
                            cycleId: rec.newCycle.id,
                            cycleNumber: rec.newCycle.cycleNumber
                        });
                        const nextLog = [octEvt, ...existingLog];
                        set({
                            cycles: rec.updatedCycles,
                            jobs: rec.updatedJobs,
                            selectedCycleId: 'active',
                            oct2Reconciled: true,
                            transitionLog: nextLog
                        });
                        saveCyclesToFirestore(userId, rec.updatedCycles, {
                            oct2Reconciled: true,
                            transitionLog: nextLog
                        });
                        saveJobCycleAssignmentsToFirestore(userId, rec.updatedJobs, rec.changedJobIds);
                    } else {
                        set({ oct2Reconciled: true });
                        saveCyclesToFirestore(userId, currentCycles, { oct2Reconciled: true });
                    }
                };

                // 2. Jobs Listener
                const syncedCloudJobIds = new Set();
                const jobsRef = collection(db, "users", userId, "jobs");
                const jobsUnsub = onSnapshot(jobsRef,
                    (snapshot) => {
                        const firestoreJobs = [];
                        const currentSnapshotIds = new Set();
                        snapshot.forEach(docSnap => {
                            firestoreJobs.push({ id: docSnap.id, ...docSnap.data() });
                            currentSnapshotIds.add(docSnap.id);
                        });
                        set(state => {
                            // Preserve local jobs that have never been synced to Firestore yet
                            // while allowing remotely deleted jobs (previously in syncedCloudJobIds) to be removed cleanly
                            const localOnlyJobs = state.jobs.filter(localJob =>
                                localJob?.id &&
                                !currentSnapshotIds.has(localJob.id) &&
                                !syncedCloudJobIds.has(localJob.id)
                            );

                            currentSnapshotIds.forEach(id => syncedCloudJobIds.add(id));

                            // If we have genuinely new local jobs that aren't in the cloud yet, upload them sanitized
                            if (localOnlyJobs.length > 0 && userId) {
                                console.log("[Store] Uploading", localOnlyJobs.length, "local jobs to cloud");
                                import('firebase/firestore').then(({ setDoc, doc }) => {
                                    localOnlyJobs.forEach(job => {
                                        const jobRef = doc(db, "users", userId, "jobs", job.id);
                                        const cleanJob = sanitizeJobForFirestore(cleanObject(job));
                                        setDoc(jobRef, cleanJob, { merge: true }).catch(e => console.error("Sync up failed:", e));
                                    });
                                });
                            }

                            return { jobs: [...firestoreJobs, ...localOnlyJobs] };
                        });

                        // One-time cleanup of applications miscounted by status changes (old appliedAt bug)
                        runAppliedAtCleanupOnce(userId, firestoreJobs, (repairs) => {
                            const byId = new Map(repairs.map(r => [r.id, r.appliedAt]));
                            set(state => ({
                                jobs: state.jobs.map(j => (j?.id && byId.has(j.id) ? { ...j, appliedAt: byId.get(j.id) } : j))
                            }));
                        });
                        hasLoadedJobsSnapshot = true;
                        maybeRunOct2CycleReconciliation();
                    },
                    (error) => {
                        console.error("[Store] Jobs snapshot error:", error);
                    }
                );

                // 3. Search Cycles Listener
                const cyclesRef = doc(db, "users", userId, "data", "cycles");
                const cyclesUnsub = onSnapshot(cyclesRef,
                    (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data() || {};
                            const remoteList = Array.isArray(data.list) ? data.list : [];
                            const resolved = resolveCyclesFromJobs(get().jobs, remoteList);
                            const updates = { cycles: resolved };
                            if (typeof data.jobSearchMode === 'boolean') updates.jobSearchMode = data.jobSearchMode;
                            if (Array.isArray(data.transitionLog)) updates.transitionLog = data.transitionLog;
                            if (typeof data.oct2Reconciled === 'boolean') updates.oct2Reconciled = data.oct2Reconciled;
                            set(updates);
                        } else {
                            const initialCycles = resolveCyclesFromJobs(get().jobs, get().cycles || []);
                            set({ cycles: initialCycles });
                            saveCyclesToFirestore(userId, initialCycles);
                        }
                        hasLoadedCyclesSnapshot = true;
                        maybeRunOct2CycleReconciliation();
                    },
                    (error) => {
                        console.error("[Store] Cycles snapshot error:", error);
                    }
                );

                return () => {
                    profileUnsub();
                    jobsUnsub();
                    cyclesUnsub();
                };
            },

        }),
        {
            name: 'job-tracker-storage',
            partialize: (state) => ({
                jobs: state.jobs,
                cycles: state.cycles,
                selectedCycleId: state.selectedCycleId,
                jobSearchMode: state.jobSearchMode,
                transitionLog: state.transitionLog,
                oct2Reconciled: state.oct2Reconciled,
                profile: state.profile,
                currentUserId: state.currentUserId  // Also persist user ID
            })
        }
    )
);

// Enable full cross-tab synchronization for Zustand state
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === 'job-tracker-storage') {
            useAppStore.persist.rehydrate();
        }
    });
}
