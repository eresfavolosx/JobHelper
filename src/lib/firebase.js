
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDnV-3ybAPTApZC2zCFysE6eo38Y05C3LY",
    authDomain: "jobhelper-c3cd7.firebaseapp.com",
    projectId: "jobhelper-c3cd7",
    storageBucket: "jobhelper-c3cd7.firebasestorage.app",
    messagingSenderId: "435778146376",
    appId: "1:435778146376:web:1571ed01d7c1e1d23a487d",
    measurementId: "G-MN93GZLYQL"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { auth, db, googleProvider, firebaseConfig };
