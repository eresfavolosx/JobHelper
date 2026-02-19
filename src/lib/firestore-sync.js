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

    console.log("Firestore instance:", db);

    if (!jobs || jobs.length === 0) {
        console.log("No jobs to sync");
    }

    const batch = writeBatch(db);

    // 1. Sync Profile (only if profile has data)
    if (profile && Object.keys(profile).length > 0) {
        const profileRef = doc(db, "users", userId, "data", "profile");
        // Filter out undefined values and contextDocuments (can be too large)
        const cleanProfile = {};
        for (const key of Object.keys(profile)) {
            if (profile[key] !== undefined && key !== 'contextDocuments') {
                cleanProfile[key] = profile[key];
            }
        }
        batch.set(profileRef, cleanProfile, { merge: true });
        console.log("Profile staged for sync");
    }

    // 2. Sync Jobs
    // We'll store jobs in a subcollection: users/{uid}/jobs/{jobId}
    if (jobs && jobs.length > 0) {
        jobs.forEach(job => {
            if (job.id) {
                const jobRef = doc(db, "users", userId, "jobs", job.id);
                // Clean job data - remove any undefined values
                const cleanJob = {};
                for (const key of Object.keys(job)) {
                    if (job[key] !== undefined) {
                        cleanJob[key] = job[key];
                    }
                }
                batch.set(jobRef, cleanJob, { merge: true });
            }
        });
        console.log("Jobs staged for sync:", jobs.length);
    }

    await batch.commit();
    console.log("Sync complete!");
    return { success: true, jobCount: jobs?.length || 0 };
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
