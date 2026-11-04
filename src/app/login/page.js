"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Lock, Mail, Eye, EyeOff, Loader, Briefcase, Sparkles, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
        </svg>
    );
}

export default function LoginPage() {
    const { user } = useAuth();
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push('/');
        }
    }, [user, router]);

    const handleGoogleLogin = async () => {
        try {
            setError('');
            await signInWithPopup(auth, googleProvider);
            router.push('/');
        } catch (err) {
            console.error('Authentication error occurred', err);
            setError(err.message || 'Failed to authenticate with Google. Please try again.');
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please enter your email and password.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email.trim(), password);
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), password);
            }
            router.push('/');
        } catch (err) {
            console.error('Authentication error occurred', err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('Invalid email or password. Please double check and try again.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists. Try signing in instead.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Please provide a valid email address.');
            } else {
                setError(err.message || 'An unexpected error occurred. Please try again.');
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
            boxSizing: 'border-box',
            overflowY: 'auto'
        }}>
            {/* Top Right Theme Mode Selector */}
            <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 100 }}>
                <ThemeSwitcher compact={true} />
            </div>

            {/* Ambient Lighting Orbs */}
            <div style={{
                position: 'absolute',
                width: '380px',
                height: '380px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(107, 126, 103, 0.22) 0%, rgba(107, 126, 103, 0) 70%)',
                top: '20%',
                left: '50%',
                transform: 'translate(-80%, -30%)',
                filter: 'blur(40px)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                width: '360px',
                height: '360px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(169, 105, 83, 0.18) 0%, rgba(169, 105, 83, 0) 70%)',
                bottom: '20%',
                left: '50%',
                transform: 'translate(10%, 20%)',
                filter: 'blur(40px)',
                pointerEvents: 'none'
            }} />

            <div
                className="animate-scale-in"
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    textAlign: 'center',
                    padding: 'clamp(24px, 5vw, 36px) clamp(20px, 5vw, 32px)',
                    borderRadius: '24px',
                    background: 'var(--glass-panel)',
                    border: '1px solid var(--glass-border)',
                    borderTop: '1px solid var(--glass-border)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.45), 0 0 32px -8px rgba(107, 126, 103, 0.18)',
                    position: 'relative',
                    zIndex: 1,
                    boxSizing: 'border-box'
                }}
            >
                {/* Modern Brand Icon */}
                <div
                    style={{
                        width: '68px',
                        height: '68px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, rgba(118, 133, 142, 0.18) 0%, rgba(250, 248, 244, 0.08) 100%)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 18px',
                        boxShadow: '0 8px 24px -4px rgba(33, 38, 44, 0.28)',
                        position: 'relative'
                    }}
                >
                    <Briefcase size={30} color="var(--accent-secondary)" />
                    <Sparkles size={14} color="var(--accent-primary)" style={{ position: 'absolute', top: '10px', right: '10px' }} />
                </div>

                {/* Brand Title */}
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: '800',
                    marginBottom: '6px',
                    letterSpacing: '-0.5px',
                    color: 'var(--text-primary)'
                }}>
                    Novu<span style={{
                        color: 'var(--accent-secondary)',
                        fontWeight: '700'
                    }}>Jobs</span>
                </h1>

                <p style={{
                    color: 'var(--text-secondary)',
                    marginBottom: '22px',
                    fontSize: '0.92rem',
                    lineHeight: '1.4'
                }}>
                    Your personal career command center.
                </p>

                {/* Mode Segmented Switcher */}
                <div style={{
                    display: 'flex',
                    background: 'var(--bg-panel)',
                    padding: '4px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '20px',
                    gap: '4px'
                }}>
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(false); setError(''); }}
                        style={{
                            flex: 1,
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '0.88rem',
                            fontWeight: !isSignUp ? 600 : 500,
                            background: !isSignUp ? 'var(--accent-gradient)' : 'transparent',
                            color: !isSignUp ? '#FAF8F4' : 'var(--text-secondary)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: !isSignUp ? 'var(--shadow-btn)' : 'none'
                        }}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(true); setError(''); }}
                        style={{
                            flex: 1,
                            padding: '8px 14px',
                            borderRadius: '10px',
                            fontSize: '0.88rem',
                            fontWeight: isSignUp ? 600 : 500,
                            background: isSignUp ? 'var(--accent-gradient)' : 'transparent',
                            color: isSignUp ? '#FAF8F4' : 'var(--text-secondary)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: isSignUp ? 'var(--shadow-btn)' : 'none'
                        }}
                    >
                        Create Account
                    </button>
                </div>

                {error && (
                    <div
                        role="alert"
                        aria-live="assertive"
                        style={{
                            padding: '10px 14px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#f87171',
                            borderRadius: '12px',
                            marginBottom: '18px',
                            fontSize: '0.85rem',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Email/Password Form */}
                <form onSubmit={handleEmailAuth} style={{ marginBottom: '18px' }}>
                    <div style={{ marginBottom: '12px', position: 'relative' }}>
                        <Mail
                            size={18}
                            style={{
                                position: 'absolute',
                                left: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-secondary)',
                                pointerEvents: 'none'
                            }}
                        />
                        <input
                            aria-label="Email address"
                            id="email"
                            type="email"
                            required
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '13px 14px 13px 44px',
                                borderRadius: '12px',
                                border: '1px solid var(--glass-border)',
                                background: 'var(--glass-highlight)',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s, box-shadow 0.2s'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = 'var(--accent-secondary)';
                                e.target.style.boxShadow = '0 0 0 3px rgba(118, 133, 142, 0.22)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = 'var(--glass-border)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                        <Lock
                            size={18}
                            style={{
                                position: 'absolute',
                                left: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-secondary)',
                                pointerEvents: 'none'
                            }}
                        />
                        <input
                            aria-label="Password"
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '13px 44px 13px 44px',
                                borderRadius: '12px',
                                border: '1px solid var(--glass-border)',
                                background: 'var(--glass-highlight)',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.2s, box-shadow 0.2s'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = 'var(--accent-secondary)';
                                e.target.style.boxShadow = '0 0 0 3px rgba(118, 133, 142, 0.22)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = 'var(--glass-border)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                        <button
                            type="button"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            title={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '13px',
                            fontSize: '0.98rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            borderRadius: '12px',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? (
                            <Loader size={18} className="spin" />
                        ) : (
                            <>
                                <span>{isSignUp ? 'Create My Account' : 'Sign In'}</span>
                                <ArrowRight size={17} />
                            </>
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>or</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                </div>

                {/* Google Sign In Button */}
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        background: 'var(--glass-highlight)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--glass-panel)';
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--glass-highlight)';
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <GoogleIcon />
                    <span>Continue with Google</span>
                </button>

                {/* Security Trust Badge */}
                <div style={{
                    marginTop: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    opacity: 0.8
                }}>
                    <ShieldCheck size={14} color="var(--success)" />
                    <span>Protected by Google Cloud & Firebase Security</span>
                </div>
            </div>
        </div>
    );
}
