import { cleanObject } from './utils.js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { canAddJob, isOwner, isProUser, FREE_TIER_MAX_JOBS } from './subscription.js';
import { resolveAppliedAtForStatusChange, findMiscountedApplications } from './goal-tracker.js';

const APPLIED_AT_CLEANUP_KEY = 'novujobs_appliedAt_cleanup_v1';
const appliedAtCleanupInFlight = new Set();

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
    'resumeUrl', 'resumeName'
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
    resumeName: 200
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
            currentUserId: null, // Track which user's data this is

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
                const newJob = {
                    status: initialStatus,
                    ...job,
                    id: generateId(),
                    createdAt: nowIso,
                    ...(initialStatus !== 'wishlist' && initialStatus !== 'deleted' && initialStatus !== 'archived' && !job?.appliedAt
                        ? { appliedAt: nowIso }
                        : {})
                };
                set((state) => ({ jobs: [...state.jobs, newJob] }));
                // Persist to Firestore
                const userId = get().currentUserId || auth?.currentUser?.uid;
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
                const enrichedUpdates = {
                    ...updates,
                    ...(statusChanged && updates.previousStatus === undefined
                        ? { previousStatus: existingJob.status }
                        : {}),
                    ...(resolvedAppliedAt ? { appliedAt: resolvedAppliedAt, updatedAt: nowIso } : {})
                };
                set((state) => ({
                    jobs: state.jobs.map((job) => (job?.id === id ? { ...job, ...enrichedUpdates } : job))
                }));
                const userId = get().currentUserId || auth?.currentUser?.uid;
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        const jobRef = doc(db, "users", userId, "jobs", id);
                        const cleanUpdates = sanitizeJobForFirestore(cleanObject(enrichedUpdates));
                        setDoc(jobRef, cleanUpdates, { merge: true }).catch(e => console.error("[Store] Failed to update job:", e));
                    });
                }
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
                set((state) => ({
                    jobs: state.jobs.map((job) => (job?.id === id ? { ...job, ...updates } : job))
                }));
                const userId = get().currentUserId || auth?.currentUser?.uid;
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
                                        syncedCloudJobIds.add(job.id);
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
                    },
                    (error) => {
                        console.error("[Store] Jobs snapshot error:", error);
                    }
                );

                return () => {
                    profileUnsub();
                    jobsUnsub();
                };
            },

        }),
        {
            name: 'job-tracker-storage',
            partialize: (state) => ({
                jobs: state.jobs,
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
