import { cleanObject } from './utils';
import { sanitizeProfileForFirestore, sanitizeJobForFirestore } from './store';
import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Pushes all local jobs and profile to Firestore for the given user.
 * This is a one-way sync (Local -> Cloud) intended for migration.
 */
export async function syncLocalDataToFirestore(userId, jobs, profile) {
    if (!userId) throw new Error("User ID is required for sync");

    console.log("Starting sync for user:", userId);
    console.log("Jobs to sync:", jobs?.length || 0);
    console.log("Profile:", profile);

    // Get Firestore instance directly
    console.log("Firestore instance:", db);

    if (!jobs || jobs.length === 0) {
        console.log("No jobs to sync");
    }

    const validJobs = Array.isArray(jobs) ? jobs.filter(j => j && j.id) : [];
    const CHUNK_SIZE = 450;

    // 1. Sync Profile + first chunk of jobs
    const firstBatch = writeBatch(db);
    let firstBatchCount = 0;

    if (profile && Object.keys(profile).length > 0) {
        const profileRef = doc(db, "users", userId, "data", "profile");
        const cleanProfile = sanitizeProfileForFirestore(profile);
        if (Object.keys(cleanProfile).length > 0) {
            firstBatch.set(profileRef, cleanProfile, { merge: true });
            firstBatchCount++;
        }
    }

    const firstChunk = validJobs.slice(0, CHUNK_SIZE);
    firstChunk.forEach(job => {
        const jobRef = doc(db, "users", userId, "jobs", job.id);
        const cleanJob = sanitizeJobForFirestore(cleanObject(job));
        firstBatch.set(jobRef, cleanJob, { merge: true });
        firstBatchCount++;
    });

    if (firstBatchCount > 0) {
        await firstBatch.commit();
    }

    // 2. Commit any remaining job chunks (>450 jobs)
    for (let i = CHUNK_SIZE; i < validJobs.length; i += CHUNK_SIZE) {
        const chunkBatch = writeBatch(db);
        const slice = validJobs.slice(i, i + CHUNK_SIZE);
        slice.forEach(job => {
            const jobRef = doc(db, "users", userId, "jobs", job.id);
            const cleanJob = sanitizeJobForFirestore(cleanObject(job));
            chunkBatch.set(jobRef, cleanJob, { merge: true });
        });
        await chunkBatch.commit();
    }

    console.log("Sync complete!");
    return { success: true, jobCount: validJobs.length };
}

/**
 * Deletes all user data from Firestore (for account deletion - GDPR compliance)
 */
export async function deleteAllUserData(userId) {
    if (!userId) throw new Error("User ID is required for deletion");

    const { collection, getDocs, deleteDoc } = await import("firebase/firestore");

    // Delete all jobs
    const jobsRef = collection(db, "users", userId, "jobs");
    const jobsSnapshot = await getDocs(jobsRef);
    const deletePromises = jobsSnapshot.docs.map(d => deleteDoc(d.ref));

    // Delete profile
    const profileRef = doc(db, "users", userId, "data", "profile");
    deletePromises.push(deleteDoc(profileRef));

    await Promise.all(deletePromises);
    console.log("All user data deleted for:", userId);
    return { success: true };
}
