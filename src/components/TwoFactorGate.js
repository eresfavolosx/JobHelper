"use client";
import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, KeyRound, AlertCircle, LogOut, RefreshCw, LifeBuoy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useAppStore } from '@/lib/store';
import {
    verifyTotpCode,
    verifyAndConsumeBackupCode,
    getTotpSecondsRemaining,
    markSession2FAVerified,
    clearSession2FAVerification
} from '@/lib/totp';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function TwoFactorGate({ onUnlocked }) {
    const { user } = useAuth();
    const profile = useAppStore(state => state.profile);
    const updateProfile = useAppStore(state => state.updateProfile);

    const [code, setCode] = useState('');
    const [isBackupMode, setIsBackupMode] = useState(false);
    const [backupCode, setBackupCode] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(() => getTotpSecondsRemaining());

    const security2FA = profile?.security2FA;
    const has2FA = Boolean(security2FA?.enabled && security2FA?.secret);

    useEffect(() => {
        if (!has2FA) return;
        const timer = setInterval(() => {
            setSecondsLeft(getTotpSecondsRemaining());
        }, 1000);
        return () => clearInterval(timer);
    }, [has2FA]);

    if (!user || !has2FA) {
        return null;
    }

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');

        if (isBackupMode) {
            const cleanBackup = backupCode.trim().toUpperCase();
            if (!cleanBackup) {
                setError('Enter an 8-character backup recovery code (e.g. ABCD-1234).');
                return;
            }
            setBusy(true);
            try {
                const result = verifyAndConsumeBackupCode(cleanBackup, security2FA.backupCodes || []);
                if (!result.valid) {
                    setError('Invalid or already used backup code. Please check and try again.');
                    return;
                }

                // Update remaining backup codes in Firestore
                await updateProfile({
                    security2FA: {
                        ...security2FA,
                        backupCodes: result.remainingCodes
                    }
                });

                markSession2FAVerified(user.uid);
                if (onUnlocked) onUnlocked();
            } catch (err) {
                console.error('[2FA Gate] Backup verification failed:', err);
                setError('Verification error. Please try again.');
            } finally {
                setBusy(false);
            }
            return;
        }

        // Standard TOTP Verification
        const cleanCode = code.replace(/\D/g, '').slice(0, 6);
        if (cleanCode.length !== 6) {
            setError('Enter the 6-digit verification code from your authenticator app.');
            return;
        }

        setBusy(true);
        try {
            const isValid = await verifyTotpCode(security2FA.secret, cleanCode, 1);
            if (!isValid) {
                setError('Invalid or expired 6-digit code. Check your authenticator app for the latest code.');
                return;
            }

            markSession2FAVerified(user.uid);
            if (onUnlocked) onUnlocked();
        } catch (err) {
            console.error('[2FA Gate] TOTP verification failed:', err);
            setError('Verification error. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const handleSignOut = async () => {
        try {
            clearSession2FAVerification(user?.uid);
            useAppStore.getState().clearUserData();
            await signOut(auth);
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        } catch (err) {
            console.error('Sign out failed:', err);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="two-factor-gate-title"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999999,
                background: 'rgba(10, 15, 20, 0.92)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                boxSizing: 'border-box'
            }}
        >
            <div
                className="card"
                style={{
                    width: '100%',
                    maxWidth: '440px',
                    padding: '28px',
                    borderRadius: '20px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-medium)',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                }}
            >
                {/* Header Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(59, 130, 246, 0.15))',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--success)',
                            flexShrink: 0
                        }}
                    >
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h2
                            id="two-factor-gate-title"
                            style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, lineHeight: 1.2 }}
                        >
                            Two-Factor Authentication
                        </h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            Protected by RFC 6238 Authenticator ($0 free tier)
                        </p>
                    </div>
                </div>

                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                    {isBackupMode
                        ? 'Enter one of your 8-character emergency backup recovery codes generated during 2FA setup.'
                        : `Enter the 6-digit verification code from Google Authenticator, Apple Passwords, Authy, or 1Password for ${user.email || 'your account'}.`}
                </p>

                <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!isBackupMode ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label
                                    htmlFor="totp-input"
                                    style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}
                                >
                                    6-Digit Authenticator Code
                                </label>
                                <span
                                    style={{
                                        fontSize: '0.72rem',
                                        fontFamily: 'monospace',
                                        color: secondsLeft <= 5 ? 'var(--error)' : 'var(--accent-primary)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <RefreshCw size={11} className={secondsLeft <= 5 ? 'spin' : ''} />
                                    Refreshes in {secondsLeft}s
                                </span>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <KeyRound
                                    size={16}
                                    style={{
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-secondary)'
                                    }}
                                />
                                <input
                                    id="totp-input"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    autoFocus
                                    placeholder="000000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px 12px 38px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-medium)',
                                        background: 'var(--bg-card)',
                                        color: 'var(--text-primary)',
                                        fontSize: '1.25rem',
                                        fontFamily: 'monospace',
                                        letterSpacing: '0.3em',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label
                                htmlFor="backup-code-input"
                                style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}
                            >
                                Emergency Recovery Code
                            </label>
                            <input
                                id="backup-code-input"
                                type="text"
                                autoFocus
                                placeholder="e.g. ABCD-1234"
                                value={backupCode}
                                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-medium)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1.05rem',
                                    fontFamily: 'monospace',
                                    letterSpacing: '0.15em',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    )}

                    {error && (
                        <div
                            role="alert"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                fontSize: '0.82rem'
                            }}
                        >
                            <AlertCircle size={16} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <ShieldCheck size={18} />
                        <span>{busy ? 'Verifying...' : 'Verify & Access JobHelper'}</span>
                    </button>
                </form>

                {/* Switch between Authenticator and Backup Code */}
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => {
                            setIsBackupMode(!isBackupMode);
                            setError('');
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            textDecoration: 'underline'
                        }}
                    >
                        <LifeBuoy size={13} />
                        <span>{isBackupMode ? 'Use Authenticator App 6-digit code' : 'Lost phone? Use a backup recovery code'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSignOut}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <LogOut size={13} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
