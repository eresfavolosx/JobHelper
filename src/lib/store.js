import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from './firebase';

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
                            contextDocuments: [],
                            geminiApiKey: ''
                        },
                        currentUserId: userId
                    });
                } else {
                    // First login - just set the user ID
                    console.log("First login, setting user ID");
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
                        contextDocuments: [],
                        geminiApiKey: ''
                    }
                });
            },

            addJob: (job) => {
                const newJob = {
                    status: 'wishlist',
                    ...job,
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString()
                };
                set((state) => ({ jobs: [...state.jobs, newJob] }));
                // Persist to Firestore
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        const jobRef = doc(db, "users", userId, "jobs", newJob.id);
                        const cleanJob = {};
                        for (const key of Object.keys(newJob)) {
                            if (newJob[key] !== undefined) cleanJob[key] = newJob[key];
                        }
                        setDoc(jobRef, cleanJob, { merge: true }).catch(e => console.error("[Store] Failed to save new job:", e));
                    });
                }
            },
            updateJob: (id, updates) => {
                set((state) => ({
                    jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...updates } : job))
                }));
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ updateDoc, doc }) => {
                        const jobRef = doc(db, "users", userId, "jobs", id);
                        const cleanUpdates = {};
                        for (const key of Object.keys(updates)) {
                            if (updates[key] !== undefined) cleanUpdates[key] = updates[key];
                        }
                        updateDoc(jobRef, cleanUpdates).catch(e => console.error("[Store] Failed to update job:", e));
                    });
                }
            },
            deleteJob: (id) => {
                const job = get().jobs.find(j => j.id === id);
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
                const job = get().jobs.find(j => j.id === id);
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
                    jobs: state.jobs.filter((job) => job.id !== id)
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
                    jobs: state.jobs.map((job) => (job.id === id ? { ...job, status: newStatus } : job))
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
                contextDocuments: [], // { name, content, type }
                resumeAnalysis: null, // { skills, summary, targetRoles, etc }
                geminiApiKey: '' // User provided API key (overrides env var)
            },
            updateProfile: (newProfile) => {
                set((state) => ({
                    profile: { ...state.profile, ...newProfile }
                }));
                const userId = get().currentUserId;
                if (userId) {
                    import('firebase/firestore').then(({ setDoc, doc }) => {
                        const profileRef = doc(db, "users", userId, "data", "profile");
                        const cleanProfile = {};
                        for (const key of Object.keys(newProfile)) {
                            if (newProfile[key] !== undefined && key !== 'contextDocuments') {
                                cleanProfile[key] = newProfile[key];
                            }
                        }
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
                            console.log("[Store] No profile data in Firestore yet");
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
                        const jobs = [];
                        snapshot.forEach(docSnap => jobs.push({ id: docSnap.id, ...docSnap.data() }));
                        console.log("[Store] Synced jobs from cloud:", jobs.length);
                        set({ jobs });
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
