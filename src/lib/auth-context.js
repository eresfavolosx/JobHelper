"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { useRouter } from "next/navigation";

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const unsubscribeStoreRef = useRef(null);
    const currentUserIdRef = useRef(null);

    useEffect(() => {
        console.log("[AuthContext] Initializing...");

        // Safety timeout in case Firebase hangs
        const safetyTimeout = setTimeout(() => {
            console.warn("[AuthContext] Auth check timed out - forcing loading false");
            setLoading(prev => {
                if (prev) return false;
                return prev;
            });
        }, 4000);

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            console.log("[AuthContext] Auth state changed:", firebaseUser ? "Logged In" : "Logged Out");
            clearTimeout(safetyTimeout);

            if (firebaseUser) {
                // Only re-subscribe if user actually changed (using refs to be safe)
                if (currentUserIdRef.current !== firebaseUser.uid) {
                    console.log("[AuthContext] User changed to:", firebaseUser.uid);
                    currentUserIdRef.current = firebaseUser.uid;

                    // Unsubscribe from previous user if any
                    if (unsubscribeStoreRef.current) {
                        unsubscribeStoreRef.current();
                        unsubscribeStoreRef.current = null;
                    }

                    // Subscribe store to firestore for THIS user
                    import('./store').then(module => {
                        const store = module.useAppStore.getState();

                        // Set current user (this clears data if user changed)
                        store.setCurrentUser(firebaseUser.uid);

                        // Subscribe to this user's Firestore data
                        unsubscribeStoreRef.current = store.subscribeToFirestore(firebaseUser.uid);

                        // ⚡ Trial Initialization: If new user or no trial date, start a 14-day trial
                        setTimeout(() => {
                            const currentProfile = module.useAppStore.getState().profile;
                            if (currentProfile && !currentProfile.trialStartDate) {
                                console.log("[AuthContext] Initializing 14-day trial for user");
                                const now = new Date();
                                const endDate = new Date();
                                endDate.setDate(now.getDate() + 14);
                                
                                module.useAppStore.getState().updateProfile({
                                    trialStartDate: now.toISOString(),
                                    trialEndDate: endDate.toISOString(),
                                    subscriptionStatus: 'trial'
                                });
                            }
                        }, 2000); // Small delay to allow firestore sync to finish first
                    }).catch(err => console.error("[AuthContext] Failed to load store:", err));
                }
                setUser(firebaseUser);
            } else {
                // Only clear data if we HAD a user before (actual logout)
                if (currentUserIdRef.current !== null) {
                    console.log("[AuthContext] User logged out");
                    currentUserIdRef.current = null;
                    setUser(null);

                    // Clear user data on logout
                    import('./store').then(module => {
                        module.useAppStore.getState().clearUserData();
                    }).catch(err => console.error("[AuthContext] Failed to clear store:", err));

                    if (unsubscribeStoreRef.current) {
                        unsubscribeStoreRef.current();
                        unsubscribeStoreRef.current = null;
                    }
                } else {
                    // No previous user, just ensure state is clean
                    console.log("[AuthContext] No user (initial state)");
                    setUser(null);
                }
            }
            setLoading(false);
        });

        return () => {
            clearTimeout(safetyTimeout);
            unsubscribe();
            if (unsubscribeStoreRef.current) {
                unsubscribeStoreRef.current();
            }
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {loading ? (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    zIndex: 9999
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid var(--border-subtle)',
                        borderTopColor: 'var(--accent-primary)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <style>{`
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
