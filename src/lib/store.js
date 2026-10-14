import { cleanObject } from './utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db, auth } from './firebase';
import { canAddJob, isOwner, isProUser, FREE_TIER_MAX_JOBS } from './subscription';

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

                if (currentUserId && currentUserId !== userId) {
                    // Different user - clear all data
                    console.log("User changed, clearing local data");
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
                            googleMapsApiKey: '',
                            subscriptionStatus: 'free', // 'free', 'premium', 'trial'
                            trialStartDate: null,
                            trialEndDate: null
                        },
                        currentUserId: userId
                    });
                } else {
                    // First login - just set the user ID and upload any local jobs/profile to Firestore
                    console.log("First login, setting user ID and migrating local data");
                    const localJobs = get().jobs;
                    const localProfile = get().profile;
                    
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        // Migrate Jobs
                        if (localJobs && localJobs.length > 0) {
                            localJobs.forEach(job => {
                                const jobRef = doc(db, "users", userId, "jobs", job.id);
                                const cleanJob = cleanObject(job);
                                setDoc(jobRef, cleanJob, { merge: true }).catch(e => console.error("Failed to migrate local job:", e));
                            });
                        }
                        // Migrate Profile
                        if (localProfile) {
                            const profileRef = doc(db, "users", userId, "data", "profile");
                            const cleanProfile = cleanObject(localProfile, 'contextDocuments');
                            if (Object.keys(cleanProfile).length > 0) {
                                setDoc(profileRef, cleanProfile, { merge: true }).catch(e => console.error("Failed to migrate local profile:", e));
                            }
                        }
                    });
                    
                    set({ currentUserId: userId });
                }
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
                        googleMapsApiKey: '',
                        subscriptionStatus: 'free',
                        trialStartDate: null,
                        trialEndDate: null
                    }
                });
            },

            addJob: (job) => {
                // Enforce Firebase cost protection for free tier (max 25 active jobs)
                const currentActiveJobs = get().jobs.filter(j => j?.status !== 'deleted');
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

                const newJob = {
                    status: 'wishlist',
                    ...job,
                    id: generateId(),
                    createdAt: new Date().toISOString()
                };
                set((state) => ({ jobs: [...state.jobs, newJob] }));
                // Persist to Firestore
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        const jobRef = doc(db, "users", userId, "jobs", newJob.id);
                        const cleanJob = cleanObject(newJob);
                        setDoc(jobRef, cleanJob, { merge: true }).catch(e => console.error("[Store] Failed to save new job:", e));
                    });
                }
                return newJob;
            },
            updateJob: (id, updates) => {
                set((state) => ({
                    jobs: state.jobs.map((job) => (job?.id === id ? { ...job, ...updates } : job))
                }));
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ updateDoc, doc }) => {
                        const jobRef = doc(db, "users", userId, "jobs", id);
                        const cleanUpdates = cleanObject(updates);
                        updateDoc(jobRef, cleanUpdates).catch(e => console.error("[Store] Failed to update job:", e));
                    });
                }
            },
            deleteJob: (id) => {
                const job = get().jobs.find(j => j?.id === id);
                const updates = { status: 'deleted', deletedAt: new Date().toISOString(), previousStatus: job?.status || 'wishlist' };
                set((state) => ({
                    jobs: state.jobs.map((j) =>
                        j.id === id ? { ...j, ...updates } : j
                    )
                }));
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ updateDoc, doc }) => {
                        updateDoc(doc(db, "users", userId, "jobs", id), updates)
                            .catch(e => console.error("[Store] Failed to soft-delete job:", e));
                    });
                }
            },
            restoreJob: (id) => {
                const job = get().jobs.find(j => j?.id === id);
                const updates = { status: job?.previousStatus || 'wishlist', deletedAt: null, previousStatus: null };
                set((state) => ({
                    jobs: state.jobs.map((j) =>
                        j.id === id ? { ...j, ...updates } : j
                    )
                }));
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ updateDoc, doc, deleteField }) => {
                        updateDoc(doc(db, "users", userId, "jobs", id), {
                            status: updates.status,
                            deletedAt: deleteField(),
                            previousStatus: deleteField()
                        }).catch(e => console.error("[Store] Failed to restore job:", e));
                    });
                }
            },
            permanentDeleteJob: (id) => {
                set((state) => ({
                    jobs: state.jobs.filter((job) => job?.id !== id)
                }));
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ deleteDoc, doc }) => {
                        deleteDoc(doc(db, "users", userId, "jobs", id))
                            .catch(e => console.error("[Store] Failed to permanently delete job:", e));
                    });
                }
            },
            moveJob: (id, newStatus) => {
                set((state) => ({
                    jobs: state.jobs.map((job) => (job?.id === id ? { ...job, status: newStatus } : job))
                }));
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ updateDoc, doc }) => {
                        updateDoc(doc(db, "users", userId, "jobs", id), { status: newStatus })
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
            updateProfile: (newProfile) => {
                set((state) => ({
                    profile: { ...state.profile, ...newProfile }
                }));
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        const profileRef = doc(db, "users", userId, "data", "profile");
                        const cleanProfile = cleanObject(newProfile, 'contextDocuments');
                        if (Object.keys(cleanProfile).length > 0) {
                            setDoc(profileRef, cleanProfile, { merge: true })
                                .catch(e => console.error("[Store] Failed to update profile:", e));
                        }
                    });
                }
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
                            set(state => ({ profile: { ...state.profile, ...docSnap.data() } }));
                        } else {
                            console.log("[Store] No profile data in Firestore yet - initializing trial");
                            const now = new Date();
                            const endDate = new Date();
                            endDate.setDate(now.getDate() + 14);
                            const initialProfile = {
                                trialStartDate: now.toISOString(),
                                trialEndDate: endDate.toISOString(),
                                subscriptionStatus: 'trial'
                            };
                            set(state => ({ profile: { ...state.profile, ...initialProfile } }));
                            import('firebase/firestore').then(({ setDoc }) => {
                                setDoc(profileRef, initialProfile, { merge: true }).catch(e => console.error("Failed to init trial:", e));
                            });
                        }
                    },
                    (error) => {
                        console.error("[Store] Profile snapshot error:", error);
                    }
                );

                // 2. Jobs Listener
                const jobsRef = collection(db, "users", userId, "jobs");
                const jobsUnsub = onSnapshot(jobsRef,
                    (snapshot) => {
                        const firestoreJobs = [];
                        snapshot.forEach(docSnap => firestoreJobs.push({ id: docSnap.id, ...docSnap.data() }));
                        set(state => {
                            // Preserve local jobs that are not yet in Firestore
                            // This prevents local jobs from being wiped out if the snapshot is momentarily empty or delayed
                            const localOnlyJobs = state.jobs.filter(localJob => 
                                !firestoreJobs.some(fsJob => fsJob.id === localJob.id)
                            );
                            
                            // If we have local jobs that aren't in the cloud, upload them!
                            // This happens if the user created a job before Firebase Auth finished initializing
                            if (localOnlyJobs.length > 0 && userId) {
                                console.log("[Store] Uploading", localOnlyJobs.length, "local jobs to cloud");
                                import('firebase/firestore').then(({ setDoc, doc }) => {
                                    localOnlyJobs.forEach(job => {
                                        const jobRef = doc(db, "users", userId, "jobs", job.id);
                                        setDoc(jobRef, cleanObject(job), { merge: true }).catch(e => console.error("Sync up failed:", e));
                                    });
                                });
                            }
                            
                            return { jobs: [...firestoreJobs, ...localOnlyJobs] };
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
