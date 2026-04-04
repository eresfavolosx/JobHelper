"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleGoogleLogin = async () => {
        try {
            setError('');
            await signInWithPopup(auth, googleProvider);
            router.push('/');
        } catch (err) {
            console.error(err);
            setError('Authentication failed. Please try again.');
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter email and password');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            router.push('/');
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/user-not-found') {
                setError('No account found. Try signing up instead.');
            } else if (err.code === 'auth/wrong-password') {
                setError('Incorrect password. Please try again.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Email already in use. Try signing in instead.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address.');
            } else {
                setError('Authentication failed. Please try again.');
            }
        } finally {
            setLoading(false);
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
                    maxWidth: '400px',
                    textAlign: 'center',
                    padding: '40px',
                    background: 'var(--bg-app)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}
            >
                <div
                    className="animate-slide-up"
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        background: 'var(--glass-panel)',
                        width: '70px',
                        height: '70px',
                        borderRadius: '16px',
                        alignItems: 'center',
                        margin: '0 auto 20px auto',
                        padding: '16px'
                    }}
                >
                    <Lock size={35} color="var(--accent-primary)" />
                </div>

                <h1 className="animate-slide-up delay-100" style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '6px', letterSpacing: '-0.5px' }}>
                    JobTracker
                </h1>

                <p className="animate-slide-up delay-200" style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '1rem' }}>
                    Your personal career command center.
                </p>

                {error && (
                    <div role="alert" aria-live="assertive" className="animate-fade-in" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--error)', borderRadius: '12px', marginBottom: '20px', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'left' }}>
                        {error}
                    </div>
                )}

                {/* Email/Password Form */}
                <form onSubmit={handleEmailAuth} className="animate-slide-up delay-300" style={{ marginBottom: '20px' }}>
                    <div style={{ marginBottom: '12px' }}>
                        <label htmlFor="email" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                aria-label="Email address"
                                id="email"
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '14px 14px 14px 44px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-app)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label htmlFor="password" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                aria-label="Password"
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '14px 44px 14px 44px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-app)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem'
                                }}
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                title={showPassword ? "Hide password" : "Show password"}
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '14px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} color="var(--text-secondary)" /> : <Eye size={18} color="var(--text-secondary)" />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            padding: '14px',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        <Mail size={18} />
                        {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        marginBottom: '20px'
                    }}
                >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>or</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
                </div>

                <button
                    onClick={handleGoogleLogin}
                    className="animate-slide-up delay-400"
                    style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '14px',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <img src="https://www.google.com/favicon.ico" alt="G" style={{ width: '18px', height: '18px' }} />
                    Continue with Google
                </button>
            </div>
        </div>
    );
}
