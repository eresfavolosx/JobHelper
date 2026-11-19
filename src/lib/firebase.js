import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const isTestEnv = typeof process !== 'undefined' && (
    process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT)
);

const hasRealConfig = Boolean(firebaseConfig.apiKey);

if (!hasRealConfig) {
    if (isTestEnv) {
        console.warn("Firebase configuration is missing. Check your environment variables.");
    } else if (typeof window !== 'undefined') {
        throw new Error("Firebase configuration is missing. Check your NEXT_PUBLIC_FIREBASE_* environment variables.");
    } else {
        console.warn("Firebase configuration is missing. Check your NEXT_PUBLIC_FIREBASE_* environment variables.");
    }
}

// Restrict dummy fallback config strictly to automated test runs
const effectiveConfig = hasRealConfig
    ? firebaseConfig
    : isTestEnv
        ? {
            apiKey: "AIzaSyDummyKeyForTestingPurposesOnly123456",
            authDomain: "jobhelper-c3cd7.firebaseapp.com",
            projectId: "jobhelper-c3cd7",
            storageBucket: "jobhelper-c3cd7.appspot.com",
            messagingSenderId: "1234567890",
            appId: "1:1234567890:web:abcdef1234567890"
        }
        : null;

// Initialize Firebase
const app = effectiveConfig ? (getApps().length ? getApp() : initializeApp(effectiveConfig)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function createGoogleProviderForAccount(emailHint = '') {
    const provider = new GoogleAuthProvider();
    const trimmedHint = typeof emailHint === 'string' ? emailHint.trim() : '';
    provider.setCustomParameters(
        trimmedHint
            ? { login_hint: trimmedHint, prompt: 'select_account' }
            : { prompt: 'select_account' }
    );
    return provider;
}

export { auth, db, googleProvider };
