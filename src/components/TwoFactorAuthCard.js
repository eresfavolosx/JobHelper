"use client";
import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck, ShieldAlert, KeyRound, Copy, Check,
    RefreshCw, AlertCircle, CheckCircle, Trash2, Laptop
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/lib/auth-context';
import { useAppStore } from '@/lib/store';
import { hasGoogleProvider } from '@/lib/account-security';
import { getRememberSignInPreference } from '@/lib/saved-accounts';
import {
    generateTotpSecret,
    buildOtpAuthUri,
    verifyTotpCode,
    verifyAndConsumeBackupCode,
    generateBackupCodes,
    getTotpSecondsRemaining,
    markSession2FAVerified,
    clearSession2FAVerification,
    trustCurrent2FADevice,
    clearTrusted2FADevice,
    getTrusted2FADeviceInfo,
    TRUSTED_2FA_CHANGE_EVENT
} from '@/lib/totp';

export default function TwoFactorAuthCard() {
    const { user } = useAuth();
    const profile = useAppStore(state => state.profile);
    const updateSecurity2FA = useAppStore(state => state.updateSecurity2FA);

    const security2FA = profile?.security2FA;
    const isEnabled = Boolean(security2FA?.enabled && security2FA?.secret);
    const googleLinked = Boolean(user && hasGoogleProvider(user));

    // Setup Wizard State
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [setupSecret, setSetupSecret] = useState('');
    const [setupBackupCodes, setSetupBackupCodes] = useState([]);
    const [verifyCode, setVerifyCode] = useState('');
    const [copiedKey, setCopiedKey] = useState(false);
    const [copiedBackup, setCopiedBackup] = useState(false);
    const [setupError, setSetupError] = useState('');
    const [saving, setSaving] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(() => getTotpSecondsRemaining());

    // Management State
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);
    const [disabling, setDisabling] = useState(false);
    const [isConfirmingDisable, setIsConfirmingDisable] = useState(false);
    const [disableCode, setDisableCode] = useState('');
    const [disableError, setDisableError] = useState('');
    const [trustSetupDevice, setTrustSetupDevice] = useState(() => getRememberSignInPreference());
    const [revokingAll, setRevokingAll] = useState(false);
    const [trustRevision, setTrustRevision] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onTrustChange = () => setTrustRevision(r => r + 1);
        window.addEventListener(TRUSTED_2FA_CHANGE_EVENT, onTrustChange);
        window.addEventListener('storage', onTrustChange);
        return () => {
            window.removeEventListener(TRUSTED_2FA_CHANGE_EVENT, onTrustChange);
            window.removeEventListener('storage', onTrustChange);
        };
    }, []);

    const startSetupFlow = useCallback(() => {
        const secret = generateTotpSecret(32);
        const backupCodes = generateBackupCodes(8);
        setSetupSecret(secret);
        setSetupBackupCodes(backupCodes);
        setVerifyCode('');
        setSetupError('');
        setCopiedKey(false);
        setCopiedBackup(false);
        setIsSettingUp(true);
        setStatusMessage(null);
    }, []);

    useEffect(() => {
        if (!isSettingUp) return;
        const timer = setInterval(() => {
            setSecondsLeft(getTotpSecondsRemaining());
        }, 1000);
        return () => clearInterval(timer);
    }, [isSettingUp]);

    useEffect(() => {
        if (!user || typeof window === 'undefined') return;

        const scrollIntoView = () => {
            window.requestAnimationFrame(() => {
                document.getElementById('two-factor-auth-section')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        };

        const handleOpenEvent = () => {
            if (!isEnabled) {
                startSetupFlow();
            }
            scrollIntoView();
        };

        window.addEventListener('jobhelper:open-2fa-setup', handleOpenEvent);

        const wantsSetup = window.location.search.includes('setup2fa=1') ||
            window.location.hash === '#two-factor-auth-setup';
        if (wantsSetup) {
            if (!isEnabled) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                startSetupFlow();
            }
            scrollIntoView();
        }

        return () => {
            window.removeEventListener('jobhelper:open-2fa-setup', handleOpenEvent);
        };
    }, [user, isEnabled, startSetupFlow]);

    if (!user) return null;

    const handleCopyKey = async () => {
        if (!setupSecret) return;
        try {
            await navigator?.clipboard?.writeText?.(setupSecret);
            setCopiedKey(true);
            setTimeout(() => setCopiedKey(false), 2500);
        } catch (err) {
            console.warn('[2FA Setup] Clipboard copy failed:', err);
        }
    };

    const handleCopyBackupCodes = async (codes) => {
        if (!Array.isArray(codes) || codes.length === 0) return;
        const text = `JobHelper Emergency 2FA Backup Codes for ${user.email}:\n\n` + codes.join('\n') + '\n\nEach code can be used once if you lose your phone.';
        try {
            await navigator?.clipboard?.writeText?.(text);
            setCopiedBackup(true);
            setTimeout(() => setCopiedBackup(false), 2500);
        } catch (err) {
            console.warn('[2FA Setup] Clipboard copy failed:', err);
        }
    };

    const handleConfirmAndActivate = async (e) => {
        e.preventDefault();
        setSetupError('');

        const cleanCode = verifyCode.replace(/\D/g, '').slice(0, 6);
        if (cleanCode.length !== 6) {
            setSetupError('Please enter the 6-digit confirmation code from your authenticator app.');
            return;
        }

        setSaving(true);
        try {
            const isValid = await verifyTotpCode(setupSecret, cleanCode, 1);
            if (!isValid) {
                setSetupError('Invalid code. Ensure your device time is synchronized and enter the current code displayed in your app.');
                return;
            }

            // Save active 2FA to dedicated /data/security Firestore document
            const payload = {
                enabled: true,
                secret: setupSecret,
                backupCodes: setupBackupCodes,
                enabledAt: new Date().toISOString()
            };

            const syncResult = await updateSecurity2FA(payload);
            if (!syncResult?.synced) {
                setSetupError(
                    syncResult?.error
                        ? `Could not save 2FA to your account: ${syncResult.error}`
                        : 'Could not save 2FA to your cloud account. Please try again.'
                );
                return;
            }

            if (trustSetupDevice) {
                trustCurrent2FADevice(user.uid, payload);
            } else {
                clearTrusted2FADevice(user.uid);
                markSession2FAVerified(user.uid);
            }
            setIsSettingUp(false);
            setStatusMessage({
                type: 'success',
                text: 'Two-Factor Authentication is now enabled! Your account is protected.'
            });
        } catch (err) {
            console.error('[2FA Setup] Activation error:', err);
            setSetupError('Failed to activate 2FA. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenDisableConfirm = () => {
        setDisableCode('');
        setDisableError('');
        setIsConfirmingDisable(true);
    };

    const handleDisable2FA = async (e) => {
        e.preventDefault();
        setDisableError('');
        const rawInput = disableCode.trim();
        if (!rawInput) {
            setDisableError('Enter your current 6-digit authenticator code or an 8-character backup code to disable 2FA.');
            return;
        }

        setDisabling(true);
        try {
            const digitsOnly = rawInput.replace(/\D/g, '');
            let verified = false;
            if (/^\d{6}$/.test(digitsOnly)) {
                verified = await verifyTotpCode(security2FA?.secret, digitsOnly, 1);
            }
            if (!verified) {
                const backupResult = verifyAndConsumeBackupCode(rawInput, security2FA?.backupCodes || []);
                verified = backupResult.valid;
            }
            if (!verified) {
                setDisableError('Invalid authenticator or backup code. Please verify and try again.');
                return;
            }

            const syncResult = await updateSecurity2FA({
                enabled: false,
                secret: '',
                backupCodes: [],
                enabledAt: null
            });
            if (!syncResult?.synced) {
                setDisableError(
                    syncResult?.error
                        ? `Could not disable 2FA on your account: ${syncResult.error}`
                        : 'Could not disable 2FA in your cloud account. Please try again.'
                );
                return;
            }

            clearTrusted2FADevice(user.uid);
            clearSession2FAVerification(user.uid);
            setIsConfirmingDisable(false);
            setDisableCode('');
            setShowBackupCodes(false);
            setStatusMessage({
                type: 'info',
                text: 'Two-Factor Authentication has been disabled. You can re-enable it at any time.'
            });
        } catch (err) {
            console.error('[2FA Disable] Error:', err);
            setStatusMessage({
                type: 'error',
                text: 'Failed to disable 2FA. Please try again.'
            });
        } finally {
            setDisabling(false);
        }
    };

    const handleRegenerateBackupCodes = async () => {
        if (!window.confirm('Regenerate fresh backup codes? Any previously saved codes will become invalid.')) {
            return;
        }
        const freshCodes = generateBackupCodes(8);
        const syncResult = await updateSecurity2FA({
            ...security2FA,
            backupCodes: freshCodes
        });
        if (!syncResult?.synced) {
            setStatusMessage({
                type: 'error',
                text: syncResult?.error
                    ? `Could not save new backup recovery codes to your account: ${syncResult.error}`
                    : 'Could not save new backup recovery codes to your cloud account. Please try again.'
            });
        } else {
            setStatusMessage({
                type: 'success',
                text: 'Fresh backup recovery codes generated. Make sure to copy them.'
            });
        }
    };

    const handleTrustCurrentDevice = () => {
        if (!security2FA?.secret || !user?.uid) return;
        const ok = trustCurrent2FADevice(user.uid, security2FA);
        if (ok) {
            setStatusMessage({
                type: 'success',
                text: 'This device is now trusted. Future sign-ins on this browser will skip the 2FA prompt.'
            });
        }
    };

    const handleUntrustCurrentDevice = () => {
        if (!user?.uid) return;
        clearTrusted2FADevice(user.uid);
        markSession2FAVerified(user.uid);
        setStatusMessage({
            type: 'info',
            text: 'Removed trusted status for this device. You will be prompted for a 2FA code on the next sign-in here.'
        });
    };

    const handleRevokeAllTrustedDevices = async () => {
        if (!isEnabled || !user?.uid) return;
        setRevokingAll(true);
        try {
            const updatedSecurity2FA = {
                ...security2FA,
                enabledAt: new Date().toISOString()
            };
            const syncResult = await updateSecurity2FA(updatedSecurity2FA);
            if (!syncResult?.synced) {
                setStatusMessage({
                    type: 'error',
                    text: syncResult?.error
                        ? `Could not revoke trusted devices on your account: ${syncResult.error}`
                        : 'Could not revoke trusted devices on your cloud account. Please try again.'
                });
                return;
            }
            clearTrusted2FADevice(user.uid);
            markSession2FAVerified(user.uid);
            setStatusMessage({
                type: 'success',
                text: 'All trusted devices have been revoked. Other devices will need a 2FA code on next sign-in.'
            });
        } catch (err) {
            console.error('[2FA Revoke All] Error:', err);
            setStatusMessage({
                type: 'error',
                text: 'Failed to revoke trusted devices. Please try again.'
            });
        } finally {
            setRevokingAll(false);
        }
    };

    const deviceTrustInfo = isEnabled && trustRevision >= 0
        ? getTrusted2FADeviceInfo(user?.uid, security2FA)
        : { trusted: false, trustedAt: null };

    const otpAuthUri = setupSecret
        ? buildOtpAuthUri(setupSecret, user.email || 'user', 'JobHelper')
        : '';

    return (
        <section
            id="two-factor-auth-section"
            aria-labelledby="two-factor-auth-heading"
            className="card"
            style={{
                padding: '24px',
                borderRadius: '16px',
                border: googleLinked && !isEnabled ? '1px solid rgba(107, 126, 103, 0.45)' : '1px solid var(--border-subtle)',
                background: 'var(--bg-card)'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: isEnabled
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(59, 130, 246, 0.15))'
                                : 'var(--bg-secondary)',
                            border: `1px solid ${isEnabled ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isEnabled ? 'var(--success)' : 'var(--text-secondary)'
                        }}
                    >
                        {isEnabled ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
                    </div>
                    <div>
                        <h2 id="two-factor-auth-heading" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                            Two-Factor Authentication (2FA)
                        </h2>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            Free RFC 6238 TOTP ($0 forever) · Compatible with Google Authenticator, Apple Passwords &amp; Authy
                        </p>
                    </div>
                </div>

                {/* Status Indicator Chip */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span
                        style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '999px',
                            background: isEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.14)',
                            color: isEnabled ? 'var(--success)' : '#f59e0b',
                            border: `1px solid ${isEnabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <span
                            style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: isEnabled ? 'var(--success)' : '#f59e0b'
                            }}
                        />
                        {isEnabled ? 'Active / Protected' : 'Not Enabled'}
                    </span>
                </div>
            </div>

            {googleLinked && (
                <div
                    style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        marginBottom: '16px',
                        fontSize: '0.83rem',
                        lineHeight: 1.45,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        background: 'rgba(107, 126, 103, 0.12)',
                        border: '1px solid rgba(107, 126, 103, 0.32)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <ShieldCheck size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                        <strong>Google Account Connected ({user.email})</strong> — No password required to enable 2FA. Your 6-digit authenticator code will be requested after Google Sign-In.
                    </span>
                </div>
            )}

            {statusMessage && (
                <div
                    role="alert"
                    style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        marginBottom: '16px',
                        fontSize: '0.84rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: statusMessage.type === 'success'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : statusMessage.type === 'warning'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : statusMessage.type === 'error'
                            ? 'rgba(239, 68, 68, 0.12)'
                            : 'rgba(59, 130, 246, 0.12)',
                        border: `1px solid ${
                            statusMessage.type === 'success'
                                ? 'rgba(16, 185, 129, 0.3)'
                                : statusMessage.type === 'warning'
                                ? 'rgba(245, 158, 11, 0.35)'
                                : statusMessage.type === 'error'
                                ? 'rgba(239, 68, 68, 0.3)'
                                : 'rgba(59, 130, 246, 0.3)'
                        }`,
                        color: statusMessage.type === 'success'
                            ? 'var(--success)'
                            : statusMessage.type === 'warning'
                            ? '#f59e0b'
                            : statusMessage.type === 'error'
                            ? '#ef4444'
                            : 'var(--accent-primary)'
                    }}
                >
                    {statusMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span>{statusMessage.text}</span>
                </div>
            )}

            {/* Content Body */}
            {!isEnabled && !isSettingUp && (
                <div>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                        Add an extra layer of security to your job hunt data. When 2FA is active, signing in will require a 6-digit code generated by your free authenticator app. Works offline with zero SMS fees.
                    </p>

                    <button
                        type="button"
                        onClick={startSetupFlow}
                        className="btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', padding: '10px 16px' }}
                    >
                        <ShieldCheck size={16} />
                        <span>Enable Two-Factor Authentication</span>
                    </button>
                </div>
            )}

            {/* Active 2FA Management State */}
            {isEnabled && !isSettingUp && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div
                        style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Method:</span>
                            <span style={{ fontWeight: 600 }}>RFC 6238 TOTP (Authenticator App)</span>
                        </div>
                        {security2FA.enabledAt && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Activated:</span>
                                <span>{new Date(security2FA.enabledAt).toLocaleDateString()}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Available Backup Codes:</span>
                            <span style={{ fontWeight: 700, color: (security2FA.backupCodes || []).length <= 2 ? 'var(--warning)' : 'inherit' }}>
                                {(security2FA.backupCodes || []).length} remaining
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>This Device:</span>
                            <span style={{ fontWeight: 600, color: deviceTrustInfo.trusted ? 'var(--success)' : 'var(--text-secondary)' }}>
                                {deviceTrustInfo.trusted
                                    ? `Trusted (2FA skipped on sign-in${deviceTrustInfo.trustedAt ? ` · since ${new Date(deviceTrustInfo.trustedAt).toLocaleDateString()}` : ''})`
                                    : 'Not trusted (2FA required on sign-in)'}
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                            type="button"
                            onClick={deviceTrustInfo.trusted ? handleUntrustCurrentDevice : handleTrustCurrentDevice}
                            className="btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.84rem' }}
                        >
                            <Laptop size={15} />
                            <span>{deviceTrustInfo.trusted ? 'Remove Trust for This Device' : 'Trust This Device'}</span>
                        </button>

                        <button
                            type="button"
                            disabled={revokingAll}
                            onClick={handleRevokeAllTrustedDevices}
                            className="btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.84rem' }}
                        >
                            <ShieldAlert size={15} />
                            <span>{revokingAll ? 'Revoking...' : 'Revoke All Trusted Devices'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowBackupCodes(!showBackupCodes)}
                            className="btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.84rem' }}
                        >
                            <KeyRound size={15} />
                            <span>{showBackupCodes ? 'Hide Backup Codes' : 'View Backup Codes'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={startSetupFlow}
                            className="btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.84rem' }}
                        >
                            <RefreshCw size={14} />
                            <span>Reconfigure / Re-enable on New Device</span>
                        </button>

                        <button
                            type="button"
                            disabled={disabling || isConfirmingDisable}
                            onClick={handleOpenDisableConfirm}
                            className="btn-secondary"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                fontSize: '0.84rem',
                                color: 'var(--error)',
                                borderColor: 'rgba(239, 68, 68, 0.3)'
                            }}
                        >
                            <Trash2 size={14} />
                            <span>{disabling ? 'Disabling...' : 'Disable 2FA'}</span>
                        </button>
                    </div>

                    {isConfirmingDisable && (
                        <form
                            onSubmit={handleDisable2FA}
                            className="animate-fade-in"
                            style={{
                                padding: '16px',
                                borderRadius: '12px',
                                background: 'rgba(239, 68, 68, 0.06)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}
                        >
                            <label
                                htmlFor="disable-2fa-code-input"
                                style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}
                            >
                                Enter your current 6-digit authenticator code (or an 8-character backup code) to disable 2FA:
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <input
                                    id="disable-2fa-code-input"
                                    type="text"
                                    autoComplete="one-time-code"
                                    placeholder="000000 or XXXX-XXXX"
                                    value={disableCode}
                                    onChange={(e) => setDisableCode(e.target.value)}
                                    disabled={disabling}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-medium)',
                                        background: 'var(--bg-card)',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'monospace',
                                        fontSize: '0.95rem',
                                        letterSpacing: '0.12em',
                                        width: '210px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={disabling || !disableCode.trim()}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        background: 'var(--error)',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontSize: '0.84rem',
                                        fontWeight: 600,
                                        cursor: disabling ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {disabling ? 'Verifying...' : 'Confirm Disable 2FA'}
                                </button>
                                <button
                                    type="button"
                                    disabled={disabling}
                                    onClick={() => {
                                        setIsConfirmingDisable(false);
                                        setDisableCode('');
                                        setDisableError('');
                                    }}
                                    className="btn-secondary"
                                    style={{ fontSize: '0.84rem', padding: '8px 12px' }}
                                >
                                    Cancel
                                </button>
                            </div>
                            {disableError && (
                                <div role="alert" style={{ color: '#ef4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                                    <span>{disableError}</span>
                                </div>
                            )}
                        </form>
                    )}

                    {/* View / Manage Backup Codes Accordion */}
                    {showBackupCodes && (
                        <div
                            className="animate-fade-in"
                            style={{
                                padding: '16px',
                                borderRadius: '12px',
                                background: 'var(--bg-panel)',
                                border: '1px solid var(--border-medium)',
                                marginTop: '4px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>Emergency Recovery Codes</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyBackupCodes(security2FA.backupCodes || [])}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            fontSize: '0.78rem',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--border-subtle)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {copiedBackup ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                                        <span>{copiedBackup ? 'Copied' : 'Copy All'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleRegenerateBackupCodes}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            fontSize: '0.78rem',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--border-subtle)',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <RefreshCw size={13} />
                                        <span>Regenerate Fresh Codes</span>
                                    </button>
                                </div>
                            </div>

                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                                Store these codes in a safe password manager. If you ever lose your authenticator device, each code can be used once to access your account.
                            </p>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                    gap: '8px'
                                }}
                            >
                                {(security2FA.backupCodes || []).map((code, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border-subtle)',
                                            fontFamily: 'monospace',
                                            fontSize: '0.85rem',
                                            textAlign: 'center',
                                            letterSpacing: '0.1em'
                                        }}
                                    >
                                        {code}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Interactive Setup Wizard */}
            {isSettingUp && (
                <div
                    className="animate-fade-in"
                    style={{
                        padding: '20px',
                        borderRadius: '14px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-medium)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                            {isEnabled ? 'Reconfigure Authenticator (2FA)' : 'Set Up Free Two-Factor Authentication'}
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsSettingUp(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Step 1: Scan QR Code */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '20px',
                            alignItems: 'center'
                        }}
                    >
                        {/* QR Code Container */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '16px',
                                borderRadius: '12px',
                                background: '#ffffff',
                                border: '1px solid var(--border-subtle)'
                            }}
                        >
                            <QRCodeSVG value={otpAuthUri} size={160} level="M" includeMargin={false} />
                            <span style={{ fontSize: '0.72rem', color: '#475569', marginTop: '8px', fontWeight: 500 }}>
                                Scan with Authenticator App
                            </span>
                        </div>

                        {/* Secret Key & Instructions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Step 1: Scan or Enter Key</span>
                                <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                                    Cycle: {secondsLeft}s
                                </span>
                            </div>

                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                                Open <strong>Google Authenticator</strong>, <strong>Apple Passwords</strong>, <strong>Authy</strong>, or <strong>1Password</strong> and scan the QR code, or enter this secret key manually:
                            </p>

                            <div
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem',
                                    letterSpacing: '0.12em',
                                    wordBreak: 'break-all',
                                    color: 'var(--accent-primary)'
                                }}
                            >
                                {setupSecret}
                            </div>

                            <button
                                type="button"
                                onClick={handleCopyKey}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    fontSize: '0.78rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    width: 'fit-content'
                                }}
                            >
                                {copiedKey ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                                <span>{copiedKey ? 'Copied Key!' : 'Copy Secret Key'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Step 2: Emergency Recovery Codes */}
                    <div
                        style={{
                            padding: '14px',
                            borderRadius: '10px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Step 2: Save Emergency Recovery Codes</span>
                            <button
                                type="button"
                                onClick={() => handleCopyBackupCodes(setupBackupCodes)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontSize: '0.75rem',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                {copiedBackup ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                                <span>{copiedBackup ? 'Copied Codes!' : 'Copy All Backup Codes'}</span>
                            </button>
                        </div>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                            Keep these 8 codes in your password manager. Each code can be used once to log in if your phone is unavailable.
                        </p>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                gap: '6px'
                            }}
                        >
                            {setupBackupCodes.map((code, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-subtle)',
                                        fontFamily: 'monospace',
                                        fontSize: '0.8rem',
                                        textAlign: 'center'
                                    }}
                                >
                                    {code}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 3: Verification & Activation Form */}
                    <form onSubmit={handleConfirmAndActivate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label
                            htmlFor="verify-totp-input"
                            style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}
                        >
                            Step 3: Enter the 6-digit code currently shown in your app
                        </label>

                        <div>
                            <div className="brand-checkbox-row">
                                <input
                                    id="trust-device-setup-2fa"
                                    name="trustSetupDevice"
                                    type="checkbox"
                                    className="brand-checkbox-input"
                                    checked={trustSetupDevice}
                                    onChange={(e) => setTrustSetupDevice(e.target.checked)}
                                    aria-describedby="trust-device-setup-2fa-hint"
                                />
                                <label htmlFor="trust-device-setup-2fa" className="brand-checkbox-label">
                                    <span>Don&apos;t ask for 2FA again on this device</span>
                                </label>
                            </div>
                            <p id="trust-device-setup-2fa-hint" className="brand-checkbox-hint">
                                Recommended only on your personal devices. You can revoke trusted devices anytime here.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <input
                                id="verify-totp-input"
                                name="verifyTotpCode"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                autoComplete="one-time-code"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                enterKeyHint="done"
                                aria-invalid={Boolean(setupError)}
                                placeholder="000000"
                                value={verifyCode}
                                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-medium)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '1.2rem',
                                    fontFamily: 'monospace',
                                    letterSpacing: '0.3em',
                                    width: '180px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />

                            <button
                                type="submit"
                                disabled={saving || verifyCode.length !== 6}
                                className="btn-primary"
                                style={{
                                    padding: '10px 20px',
                                    fontSize: '0.88rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <ShieldCheck size={16} />
                                <span>{saving ? 'Verifying...' : 'Verify & Enable 2FA'}</span>
                            </button>
                        </div>

                        {setupError && (
                            <div
                                role="alert"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#ef4444',
                                    fontSize: '0.82rem'
                                }}
                            >
                                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                                <span>{setupError}</span>
                            </div>
                        )}
                    </form>
                </div>
            )}
        </section>
    );
}
