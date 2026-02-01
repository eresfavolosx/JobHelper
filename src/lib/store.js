import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
    persist(
        (set) => ({
            jobs: [],
            addJob: (job) => set((state) => ({
                jobs: [...state.jobs, {
                    status: 'wishlist', // default
                    ...job, // spread first to allow overrides? No, wait.
                    // If I put default first, then ...job will override it.
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString()
                }]
            })),
            updateJob: (id, updates) => set((state) => ({
                jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...updates } : job))
            })),
            deleteJob: (id) => set((state) => ({
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
            addContextDocument: (doc) => set((state) => ({
                profile: {
                    ...state.profile,
                    contextDocuments: [...(state.profile.contextDocuments || []), doc]
                }
            })),
            removeContextDocument: (index) => set((state) => ({
                profile: {
                    ...state.profile,
                    contextDocuments: state.profile.contextDocuments.filter((_, i) => i !== index)
                }
            })),

        }),
        {
            name: 'job-tracker-storage',
            partialize: (state) => ({ jobs: state.jobs, profile: state.profile }) // Persist both
        }
    )
);
