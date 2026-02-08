"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { Lock } from "lucide-react";

export default function LoginPage() {
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            router.push('/');
        } catch (err) {
            console.error(err);
            setError(err.message);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            <div
                className="card animate-scale-in"
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    textAlign: 'center',
                    padding: '48px 40px',
                    backdropFilter: 'blur(40px)', // Extra blur for focus
                    background: 'rgba(25, 25, 35, 0.6)'
                }}
            >
                <div
                    className="animate-slide-up"
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '24px',
                        background: 'rgba(255,255,255,0.05)',
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        alignItems: 'center',
                        margin: '0 auto 24px auto'
                    }}
                >
                    <Lock size={40} color="var(--accent-primary)" />
                </div>

                <h1 className="animate-slide-up delay-100" style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                    JobTracker
                </h1>

                <p className="animate-slide-up delay-200" style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '1.1rem' }}>
                    Your personal career command center.
                </p>

                {error && (
                    <div className="animate-fade-in" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderRadius: '12px', marginBottom: '24px', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    className="btn-primary animate-slide-up delay-300"
                    style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '16px',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}
                >
                    <img src="https://www.google.com/favicon.ico" alt="G" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
                    Sign in with Google
                </button>
            </div>
        </div>
    );
}
