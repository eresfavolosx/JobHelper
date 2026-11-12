"use client";
import { useState } from 'react';
import {
    EmailAuthProvider,
    linkWithCredential,
    reauthenticateWithPopup,
    sendPasswordResetEmail,
    updatePassword,
} from 'firebase/auth';
import { KeyRound, CheckCircle, AlertCircle, Loader, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react';
import { auth, createGoogleProviderForAccount } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import {
    hasGoogleProvider,
    hasPasswordProvider,
    mapPasswordActionError,
    MIN_PASSWORD_LENGTH,
    validateNewPassword,
} from '@/lib/account-security';
import { getRememberSignInPreference, upsertSavedAccount } from '@/lib/saved-accounts';

export default function AccountSecurityCard() {
    const { user } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sendingReset, setSendingReset] = useState(false);
    const [status, setStatus] = useState(null);
    const [providerLinkedLocally, setProviderLinkedLocally] = useState(false);

    if (!user) return null;

    const googleLinked = hasGoogleProvider(user);
    const passwordLinked = providerLinkedLocally || hasPasswordProvider(user);

    const runWithRecentLoginRetry = async (actionFn) => {
        try {
            await actionFn();
        } catch (err) {
            if (err?.code === 'auth/requires-recent-login' && googleLinked && auth.currentUser) {
                await reauthenticateWithPopup(
                    auth.currentUser,
                    createGoogleProviderForAccount(user.email || '')
                );
                await actionFn();
                return;
            }
            throw err;
        }
    };

    const handleSetOrUpdatePassword = async (e) => {
        e.preventDefault();
        setStatus(null);

        const validation = validateNewPassword(newPassword);
        if (!validation.valid) {
            setStatus({ type: 'error', message: validation.error });
            return;
        }

        if (!auth.currentUser || !user.email) {
            setStatus({ type: 'error', message: 'No active account email found.' });
            return;
        }

        setSaving(true);
        try {
            if (!passwordLinked) {
                const credential = EmailAuthProvider.credential(user.email, newPassword);
                await runWithRecentLoginRetry(() => linkWithCredential(auth.currentUser, credential));
                setProviderLinkedLocally(true);
                if (getRememberSignInPreference()) {
                    upsertSavedAccount(auth.currentUser, 'password');
                }
                setStatus({
                    type: 'success',
                    message: `Password added! You can now sign in directly with ${user.email} and this password instead of Google.`,
                });
            } else {
                await runWithRecentLoginRetry(() => updatePassword(auth.currentUser, newPassword));
                if (getRememberSignInPreference()) {
                    upsertSavedAccount(auth.currentUser, 'password');
                }
                setStatus({
                    type: 'success',
                    message: 'Your sign-in password has been updated.',
                });
            }
            setNewPassword('');
        } catch (err) {
            console.error('Set/update password error:', err);
            setStatus({ type: 'error', message: mapPasswordActionError(err) });
        } finally {
            setSaving(false);
        }
    };

    const handleSendResetEmail = async () => {
        if (!user.email) return;
        setStatus(null);
        setSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, user.email);
            setStatus({
                type: 'success',
                message: `Password reset email sent to ${user.email}. Check your inbox (and spam) for the link.`,
            });
        } catch (err) {
            console.error('Password reset email error:', err);
            setStatus({ type: 'error', message: mapPasswordActionError(err) });
        } finally {
            setSendingReset(false);
        }
    };

    return (
        <div id="account-security-section" className="card animate-slide-up delay-250">
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="var(--accent-primary)" /> Sign-In &amp; Password
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
                {passwordLinked
                    ? 'Your account supports Email & Password sign-in. Update your password below or send yourself a reset email.'
                    : 'Signed in with Google? Set a password here so you can also sign in directly with your email and password.'}
            </p>

            {/* Connected sign-in methods */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: 'var(--glass-highlight)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                }}>
                    <Mail size={13} color="var(--accent-primary)" /> {user.email}
                </span>
                {googleLinked && (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: 'rgba(107, 126, 103, 0.14)',
                        color: 'var(--accent-primary)',
                    }}>
                        <ShieldCheck size={13} /> Google Connected
                    </span>
                )}
                {passwordLinked && (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: 'rgba(34, 197, 94, 0.14)',
                        color: 'var(--success)',
                    }}>
                        <CheckCircle size={13} /> Password Sign-In Enabled
                    </span>
                )}
            </div>

            {status && (
                <div
                    role={status.type === 'error' ? 'alert' : 'status'}
                    aria-live="polite"
                    style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        marginBottom: '14px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        background: status.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                        border: status.type === 'error' ? '1px solid rgba(239, 68, 68, 0.28)' : '1px solid rgba(34, 197, 94, 0.28)',
                        color: status.type === 'error' ? 'var(--error)' : 'var(--success)',
                    }}
                >
                    {status.type === 'error' ? (
                        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                        <CheckCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <span>{status.message}</span>
                </div>
            )}

            <form
                method="post"
                aria-label={passwordLinked ? 'Update sign-in password' : 'Set a sign-in password'}
                onSubmit={handleSetOrUpdatePassword}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
                <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    value={user.email || ''}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ display: 'none' }}
                />

                <div>
                    <label
                        htmlFor="profile-new-password"
                        style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}
                    >
                        {passwordLinked ? 'New password' : 'Create password for email sign-in'}
                    </label>
                    <div style={{ position: 'relative', maxWidth: '380px' }}>
                        <input
                            id="profile-new-password"
                            name="new-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            minLength={MIN_PASSWORD_LENGTH}
                            required
                            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '11px 42px 11px 14px',
                                borderRadius: '10px',
                                border: '1px solid var(--glass-border)',
                                background: 'var(--glass-highlight)',
                                color: 'var(--text-primary)',
                                fontSize: '0.92rem',
                                boxSizing: 'border-box',
                            }}
                        />
                        <button
                            type="button"
                            aria-pressed={showPassword}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword((prev) => !prev)}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px',
                            }}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        type="submit"
                        disabled={saving || sendingReset}
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        {saving ? (
                            <>
                                <Loader size={16} className="spin" /> Saving...
                            </>
                        ) : (
                            <>
                                <KeyRound size={16} /> {passwordLinked ? 'Update Password' : 'Set Password'}
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        disabled={sendingReset || saving}
                        onClick={handleSendResetEmail}
                        className="btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        {sendingReset ? (
                            <>
                                <Loader size={16} className="spin" /> Sending...
                            </>
                        ) : (
                            <>
                                <Mail size={16} /> Send Reset Email
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
