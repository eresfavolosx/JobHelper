import { doc, writeBatch, getFirestore } from "firebase/firestore";
import { getApps, getApp, initializeApp } from "firebase/app";

// Firebase config - must match firebase.js
const firebaseConfig = {
    apiKey: "AIzaSyDnV-3ybAPTApZC2zCFysE6eo38Y05C3LY",
    authDomain: "jobhelper-c3cd7.firebaseapp.com",
    projectId: "jobhelper-c3cd7",
    storageBucket: "jobhelper-c3cd7.firebasestorage.app",
    messagingSenderId: "435778146376",
    appId: "1:435778146376:web:1571ed01d7c1e1d23a487d",
    measurementId: "G-MN93GZLYQL"
};

// Get or initialize Firebase app
function getFirebaseApp() {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

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
    const app = getFirebaseApp();
    const db = getFirestore(app);

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
