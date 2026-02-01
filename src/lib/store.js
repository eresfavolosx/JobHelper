import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
    persist(
        (set) => ({
            jobs: [],
            addJob: (job) => set((state) => ({
                jobs: [...state.jobs, { ...job, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'wishlist' }]
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
        }),
        {
            name: 'job-tracker-storage',
        }
    )
);
