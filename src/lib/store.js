import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
                            contextDocuments: []
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
                        contextDocuments: []
                    }
                });
            },

            addJob: (job) => set((state) => ({
                jobs: [...state.jobs, {
                    status: 'wishlist', // default
                    ...job,
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString()
                }]
            })),
            updateJob: (id, updates) => set((state) => ({
                jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...updates } : job))
            })),
            deleteJob: (id) => set((state) => ({
                // Soft delete - move to deleted status instead of removing
                jobs: state.jobs.map((job) =>
                    job.id === id
                        ? { ...job, status: 'deleted', deletedAt: new Date().toISOString(), previousStatus: job.status }
                        : job
                )
            })),
            restoreJob: (id) => set((state) => ({
                // Restore from deleted - move back to previous status
                jobs: state.jobs.map((job) =>
                    job.id === id
                        ? { ...job, status: job.previousStatus || 'wishlist', deletedAt: null, previousStatus: null }
                        : job
                )
            })),
            permanentDeleteJob: (id) => set((state) => ({
                // Permanently remove job
                jobs: state.jobs.filter((job) => job.id !== id)
            })),
            moveJob: (id, newStatus) => set((state) => ({
                jobs: state.jobs.map((job) => (job.id === id ? { ...job, status: newStatus } : job))
            })),

            // Profile State
            profile: {
                fullName: '',
                targetRole: '',
                location: 'Puerto Rico',
                keywords: '',
                isRemote: false,
                experienceLevel: 'Mid-Senior',
                contextDocuments: [] // { name, content, type }
            },
            updateProfile: (newProfile) => set((state) => ({
                profile: { ...state.profile, ...newProfile }
            })),
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
