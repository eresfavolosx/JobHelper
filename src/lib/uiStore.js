import { create } from 'zustand';

// Separate store for UI state (Modals, Panels) to avoid cluttering the data store
export const useUIStore = create((set) => ({
    isJobModalOpen: false,
    editingJob: null, // If set, we are editing this job

    openNewJobModal: () => set({ isJobModalOpen: true, editingJob: null }),
    openEditJobModal: (job) => set({ isJobModalOpen: true, editingJob: job }),
    closeJobModal: () => set({ isJobModalOpen: false, editingJob: null }),
}));
