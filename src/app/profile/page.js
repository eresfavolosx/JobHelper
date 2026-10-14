"use client";
import { useState, useEffect, Suspense, useRef, useMemo, useSyncExternalStore } from 'react';
import { User, Upload, CheckCircle, AlertCircle, FileText, Loader, CreditCard, Sparkles, Clock, MapPin, ExternalLink, ShieldCheck, Key, AlertTriangle, Sliders, Target } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';
import { generateWithFallback, fileToGenerativePart, testGeminiApiKey, getGeminiUsageStats, setGeminiMonthlyCap, extractJson } from '@/lib/gemini-client';
import { testGoogleMapsApiKey, getMapsUsageStats, setMapsMonthlyCap, clearMapsCache } from '@/lib/maps-service';
import { isOwner, isProUser, getStripeCheckoutUrl } from '@/lib/subscription';
import { calculateGoalProgress, DEFAULT_GOAL } from '@/lib/goal-tracker';
import GoalCustomizationModal from '@/components/GoalCustomizationModal';

const emptySubscribe = () => () => {};

function ProfileContent() {
    const profile = useAppStore(state => state.profile);
    const updateProfile = useAppStore(state => state.updateProfile);
    const jobs = useAppStore(state => state.jobs);
    const { user, loading } = useAuth();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

    const goalProgress = calculateGoalProgress(jobs, profile?.applicationGoal || DEFAULT_GOAL);

    useEffect(() => {
        if (mounted && !loading && !user) {
            window.location.href = '/login';
        }
    }, [mounted, loading, user]);

    // Local state to handle form inputs before saving to global store
    const [formData, setFormData] = useState(() => ({
        fullName: '',
        targetRole: '',
        location: 'Puerto Rico',
        keywords: '',
        isRemote: false,
        experienceLevel: 'Mid-Senior',
        country: '',
        modality: 'Remote',
        minimumSalary: '',
        ...(profile || {})
    }));

    const [saved, setSaved] = useState(false);

    // Load from global store on mount / updates
    useEffect(() => {
        if (profile) {
            const timer = setTimeout(() => {
                setFormData(prev => ({ ...prev, ...profile }));
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [profile]);

    if (loading) return null; // Wait for auth check

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        updateProfile(formData);

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="container" style={{ maxWidth: '800px', paddingBottom: '100px' }}>
            <header className="animate-slide-up" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <User size={32} color="var(--accent-primary)" /> Your Profile
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Manage your personal details and preferences.
                    </p>
                </div>
            </header>

            <div style={{ display: 'grid', gap: '32px' }}>
                {/* 0. Cloud Sync - ONLY SHOW IF NOT MIGRATED OR FOR MANUAL SYNC */}
                <div className="card animate-slide-up delay-100" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>Sync Local Data</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                                Push your locally saved jobs to the cloud so you can see them on other devices.
                            </p>
                        </div>
                        <SyncButton />
                    </div>
                </div>

                {/* 1. Resume Upload */}
                <div className="card animate-slide-up delay-150">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Resume & Skills</h3>
                    <ResumeUpload onAnalysisComplete={(analysis) => {
                        updateProfile({
                            resumeAnalysis: analysis,
                            // Auto-fill form if empty
                            keywords: formData.keywords || analysis.keywords.join(', '),
                            targetRole: formData.targetRole || (analysis.targetRoles && analysis.targetRoles[0]) || '',
                            experienceLevel: formData.experienceLevel || analysis.experienceLevel || 'Mid-Senior'
                        });
                        // Update local form state too so it shows immediately
                        setFormData(prev => ({
                            ...prev,
                            keywords: prev.keywords || analysis.keywords.join(', '),
                            targetRole: prev.targetRole || (analysis.targetRoles && analysis.targetRoles[0]) || '',
                            experienceLevel: prev.experienceLevel || analysis.experienceLevel || 'Mid-Senior'
                        }));
                    }} />
                </div>

                {/* 1.5. Google Cloud & Developer Benefits */}
                <div className="card animate-slide-up delay-175">
                    <GoogleServicesConfig />
                </div>

                {/* 2. Profile Form */}
                <div className="card animate-slide-up delay-200">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Core Preferences</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label htmlFor="fullName" style={{ fontWeight: '600' }}>Full Name</label>
                            <input
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="e.g. Jane Doe"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 1fr', gap: '16px' }}>
                            <div>
                                <label htmlFor="targetRole" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Job Title</label>
                                <input
                                    id="targetRole"
                                    name="targetRole"
                                    value={formData.targetRole}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="keywords" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Keywords</label>
                                <input
                                    id="keywords"
                                    name="keywords"
                                    value={formData.keywords}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 1fr', gap: '16px' }}>
                            <div>
                                <label htmlFor="location" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Target Location (City/State)</label>
                                <input
                                    id="location"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="country" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Country</label>
                                <input
                                    id="country"
                                    name="country"
                                    value={formData.country || ''}
                                    onChange={handleChange}
                                    placeholder="e.g. USA, UK, Global"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                            <div>
                                <label htmlFor="minimumSalary" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Minimum Salary (USD)</label>
                                <input
                                    id="minimumSalary"
                                    type="number"
                                    name="minimumSalary"
                                    value={formData.minimumSalary || ''}
                                    onChange={handleChange}
                                    placeholder="e.g. 80000"
                                    step="1000"
                                />
                            </div>
                            <div>
                                <label htmlFor="modality" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Working Modality</label>
                                <select
                                    id="modality"
                                    name="modality"
                                    value={formData.modality || 'Remote'}
                                    onChange={handleChange}
                                >
                                    <option style={{ background: 'var(--bg-panel)' }} value="Remote">Remote</option>
                                    <option style={{ background: 'var(--bg-panel)' }} value="Hybrid">Hybrid</option>
                                    <option style={{ background: 'var(--bg-panel)' }} value="On-site">On-site</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="experienceLevel" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Experience Level</label>
                                <select
                                    id="experienceLevel"
                                    name="experienceLevel"
                                    value={formData.experienceLevel}
                                    onChange={handleChange}
                                >
                                    <option style={{ background: 'var(--bg-panel)' }}>Intern / Junior</option>
                                    <option style={{ background: 'var(--bg-panel)' }}>Mid-Level</option>
                                    <option style={{ background: 'var(--bg-panel)' }}>Senior</option>
                                    <option style={{ background: 'var(--bg-panel)' }}>Lead / Manager</option>
                                    <option style={{ background: 'var(--bg-panel)' }}>Executive</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '16px' }}>
                            {saved ? 'Changes Saved!' : 'Save Preferences'}
                        </button>
                    </form>
                </div>

                {/* 1.5. Application Goals & Cadence */}
                <div className="card animate-slide-up delay-200">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Target size={20} color="var(--accent-primary)" /> Application Output Goal & Cadence
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                                Set targets for how many applications you submit per week, month, or day.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsGoalModalOpen(true)}
                            className="btn-secondary"
                            style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Sliders size={14} /> Customize Goal
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '12px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Current Target
                            </span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginTop: '4px', color: 'var(--accent-primary)' }}>
                                {goalProgress.target} apps <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>/ {goalProgress.cadence}</span>
                            </div>
                        </div>

                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Progress
                            </span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', marginTop: '4px' }}>
                                {goalProgress.count} of {goalProgress.target} ({goalProgress.percentage}%)
                            </div>
                        </div>

                        <div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Cadence Pacing
                            </span>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '6px', color: goalProgress.pace === 'completed' ? '#10b981' : goalProgress.pace === 'on_track' ? 'var(--accent-primary)' : '#f59e0b' }}>
                                {goalProgress.pace === 'completed' ? 'Goal Crushed! 🎉' : goalProgress.pace === 'on_track' ? 'On Track 🚀' : 'Behind Pace ⏳'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Subscription Management */}
                <div id="subscription-section" className="card animate-slide-up delay-250">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={20} color="var(--accent-primary)" /> Subscription & Billing
                    </h3>
                    <SubscriptionManager />
                </div>
                {/* 2. Data Management */}
                <div className="card animate-slide-up delay-300">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Data Management</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Export your data or delete your account. These actions help you stay in control of your information.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <ExportDataButton />
                        <DeleteAccountButton />
                    </div>
                </div>
            </div>

            <GoalCustomizationModal
                isOpen={isGoalModalOpen}
                onClose={() => setIsGoalModalOpen(false)}
            />
        </div>
    );
}

function ExportDataButton() {
    const jobs = useAppStore(state => state.jobs);
    const profile = useAppStore(state => state.profile);
    const isPremium = useAppStore(state => state.isPremium);
    const { user } = useAuth();
    const [showPremiumToast, setShowPremiumToast] = useState(false);

    const handleExport = () => {
        if (!isPremium()) {
            setShowPremiumToast(true);
            setTimeout(() => setShowPremiumToast(false), 5000);
            const subSection = document.getElementById('subscription-section');
            if (subSection) subSection.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            user: user ? { email: user.email, displayName: user.displayName } : null,
            profile,
            jobs,
            totalJobs: jobs.length
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jobtracker-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={handleExport}
                style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                📦 Export My Data
            </button>
            {showPremiumToast && (
                <div role="alert" aria-live="assertive" className="animate-fade-in" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--warning)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap',
                    zIndex: 10
                }}>
                    📦 Data Export is a Premium feature.
                </div>
            )}
        </div>
    );
}

function DeleteAccountButton() {
    const { user } = useAuth();
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        if (!user) return;

        setDeleting(true);
        setErrorMsg('');
        try {
            // Delete Firestore data
            const { deleteAllUserData } = await import('@/lib/firestore-sync');
            await deleteAllUserData(user.uid);

            // Delete Firebase auth account
            await user.delete();

            // Clear local storage
            localStorage.clear();

            // Redirect to login
            window.location.href = '/login';
        } catch (err) {
            console.error('Delete account error:', err);
            setError('Failed to delete account. You may need to re-authenticate first.');
            setDeleting(false);
        }
    };

    if (confirming) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--error)', fontSize: '0.9rem' }}>Are you sure?</span>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        aria-label="Confirm Delete Account"
                        style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: 'var(--error)',
                            color: 'white',
                            border: 'none',
                            cursor: deleting ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                        onClick={() => { setConfirming(false); setError(''); }}
                        aria-label="Cancel Delete Account"
                        style={{
                            padding: '10px 16px',
                            borderRadius: '8px',
                            background: 'var(--bg-panel)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                </div>
                {error && (
                    <div role="alert" aria-live="assertive" className="animate-fade-in" style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '4px' }}>
                        {error}
                    </div>
                )}
            </div>
        );
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            aria-label="Delete Account"
            title="Delete Account"
            style={{
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--error)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            🗑️ Delete Account
        </button>
    );
}

function SubscriptionManager() {
    const profile = useAppStore(state => state.profile);
    const updateProfile = useAppStore(state => state.updateProfile);
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const [successBanner, setSuccessBanner] = useState('');

    const isPlatformOwner = isOwner(user);
    const isPro = isProUser(user, profile);
    const isTrial = !isPlatformOwner && profile?.subscriptionStatus === 'trial';

    const [now] = useState(() => new Date());

    // Handle return from Stripe Checkout redirect (?payment=success or ?session_id=...)
    useEffect(() => {
        if (!searchParams) return;
        const paymentParam = searchParams.get('payment');
        const sessionId = searchParams.get('session_id');
        if (paymentParam === 'success' || sessionId) {
            const timer = setTimeout(() => {
                updateProfile({ subscriptionStatus: 'premium' });
                setSuccessBanner('🎉 Welcome to NovuJobs Pro! Full AI and cloud features have been unlocked.');
            }, 0);
            const clearTimer = setTimeout(() => setSuccessBanner(''), 8000);
            return () => {
                clearTimeout(timer);
                clearTimeout(clearTimer);
            };
        }
    }, [searchParams, updateProfile]);

    const trialEndDate = profile?.trialEndDate;
    const trialDaysLeft = useMemo(() => {
        if (!trialEndDate) return 0;
        const end = new Date(trialEndDate);
        if (isNaN(end.getTime())) return 0;
        const diff = end.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }, [trialEndDate, now]);

    const stripeCheckoutUrl = getStripeCheckoutUrl(user);

    return (
        <div style={{ display: 'grid', gap: '20px' }}>
            {successBanner && (
                <div role="alert" className="animate-fade-in" style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#10b981',
                    fontWeight: 'bold',
                    fontSize: '0.95rem',
                    textAlign: 'center'
                }}>
                    {successBanner}
                </div>
            )}

            <div style={{ 
                padding: '24px', 
                borderRadius: '16px', 
                background: isPlatformOwner 
                    ? 'linear-gradient(135deg, rgba(212, 163, 115, 0.2) 0%, rgba(94, 135, 110, 0.18) 100%)'
                    : isPro 
                        ? 'linear-gradient(135deg, rgba(94, 135, 110, 0.18) 0%, rgba(132, 167, 145, 0.16) 100%)' 
                        : 'var(--bg-panel)',
                border: isPlatformOwner 
                    ? '1px solid rgba(212, 163, 115, 0.45)' 
                    : isPro 
                        ? '1px solid var(--accent-primary)' 
                        : '1px solid var(--border-subtle)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                            <span style={{ 
                                fontSize: '0.75rem', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em', 
                                fontWeight: 'bold',
                                color: isPlatformOwner ? '#eab308' : isPro ? 'var(--accent-primary)' : 'var(--text-secondary)'
                            }}>
                                Current Status
                            </span>
                            <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '4px' }}>
                                {isPlatformOwner 
                                    ? 'Platform Owner (Unlimited Lifetime)' 
                                    : isPro 
                                        ? 'NovuJobs Pro' 
                                        : isTrial 
                                            ? 'Premium Trial' 
                                            : 'Free Tier (25 Jobs Cap)'}
                            </h4>
                        </div>
                        {isPlatformOwner ? (
                            <span style={{ 
                                padding: '4px 12px', 
                                borderRadius: '20px', 
                                background: 'linear-gradient(135deg, #eab308, #ca8a04)', 
                                color: 'black', 
                                fontSize: '0.8rem', 
                                fontWeight: 'bold' 
                            }}>
                                👑 OWNER
                            </span>
                        ) : isPro ? (
                            <span style={{ 
                                padding: '4px 12px', 
                                borderRadius: '20px', 
                                background: 'var(--accent-primary)', 
                                color: 'white', 
                                fontSize: '0.8rem', 
                                fontWeight: 'bold' 
                            }}>
                                ⭐ PRO ACTIVE
                            </span>
                        ) : (
                            <span style={{ 
                                padding: '4px 12px', 
                                borderRadius: '20px', 
                                background: 'rgba(255, 255, 255, 0.08)', 
                                color: 'var(--text-secondary)', 
                                fontSize: '0.8rem', 
                                fontWeight: 'bold' 
                            }}>
                                FREE TIER
                            </span>
                        )}
                    </div>

                    {isPlatformOwner && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                            Permanent unrestricted access for <strong>{user?.email}</strong>. All AI features, Ghosting Radar, Unlimited Jobs, and Maps APIs are unlocked.
                        </p>
                    )}

                    {isTrial && trialDaysLeft > 0 && !isPlatformOwner && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            <Clock size={16} />
                            <span>{trialDaysLeft} days remaining in your trial</span>
                        </div>
                    )}

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', fontSize: '0.9rem', display: 'grid', gap: '8px' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={14} color="var(--accent-primary)" /> 
                            <strong>Ghosting Radar & 1-Click Follow-Up Strategist</strong>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={14} color="var(--accent-primary)" /> 
                            <strong>Interview Power Coach with STAR frameworks</strong>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={14} color="var(--accent-primary)" /> 
                            AI Resume Parsing & Job Match Scoring (Gemini 3.8 Flash)
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sparkles size={14} color="var(--accent-primary)" /> 
                            Unlimited Applications & Real-time Cloud Sync
                        </li>
                    </ul>

                    {!isPlatformOwner && !isPro ? (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            <a
                                href={stripeCheckoutUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary"
                                style={{ width: '100%', justifyContent: 'center', py: '14px', textDecoration: 'none', fontWeight: 'bold' }}
                            >
                                <CreditCard size={18} /> Upgrade with Stripe ($9.99/mo)
                            </a>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                Want to use AI for free? Add your personal free Gemini API key below under Google Cloud Configuration.
                            </p>
                        </div>
                    ) : !isPlatformOwner && isPro ? (
                        <a 
                            href={stripeCheckoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary" 
                            style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
                        >
                            Manage Stripe Subscription
                        </a>
                    ) : null}
                </div>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Secure subscriptions powered by <strong>Stripe</strong>. Cancel anytime with one click.
            </p>
        </div>
    );
}

function SyncButton() {
    const { user } = useAuth();
    const jobs = useAppStore(state => state.jobs);
    const profile = useAppStore(state => state.profile);
    const [syncing, setSyncing] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, success, error

    const handleSync = async () => {
        if (!user) return;
        setSyncing(true);
        setStatus('idle');
        try {
            // Dynamically import to avoid server-side issues if any
            const { syncLocalDataToFirestore } = await import('@/lib/firestore-sync');
            await syncLocalDataToFirestore(user.uid, jobs, profile);
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err) {
            console.error(err);
            setStatus('error');
        } finally {
            setSyncing(false);
        }
    };

    if (!user) return null;

    return (
        <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary"
            style={{
                minWidth: '120px',
                background: status === 'error' ? 'var(--error)' : status === 'success' ? 'var(--success)' : undefined
            }}
        >
            {syncing ? 'Syncing...' : status === 'success' ? 'Done!' : status === 'error' ? 'Error' : 'Sync Now'}
        </button>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="container">Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}

function GoogleServicesConfig() {
    const profile = useAppStore(state => state.profile);
    const updateProfile = useAppStore(state => state.updateProfile);

    const envGemini = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_GEMINI_API_KEY || '') : '';
    const envMaps = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '') : '';

    // Gemini State
    const [geminiKey, setGeminiKey] = useState(() => profile?.geminiApiKey || envGemini || '');
    const [showGemini, setShowGemini] = useState(false);
    const [geminiSaved, setGeminiSaved] = useState(false);
    const [testingGemini, setTestingGemini] = useState(false);
    const [geminiStatus, setGeminiStatus] = useState(null);

    // Google Maps State
    const [mapsKey, setMapsKey] = useState(() => profile?.googleMapsApiKey || envMaps || '');
    const [showMaps, setShowMaps] = useState(false);
    const [mapsSaved, setMapsSaved] = useState(false);
    const [testingMaps, setTestingMaps] = useState(false);
    const [mapsStatus, setMapsStatus] = useState(null);

    // Sync with store & environment
    useEffect(() => {
        const timer = setTimeout(() => {
            setGeminiKey(profile?.geminiApiKey || envGemini || '');
            setMapsKey(profile?.googleMapsApiKey || envMaps || '');
        }, 0);
        return () => clearTimeout(timer);
    }, [profile?.geminiApiKey, profile?.googleMapsApiKey, envGemini, envMaps]);

    const handleSaveGemini = () => {
        updateProfile({ geminiApiKey: geminiKey.trim() });
        setGeminiSaved(true);
        setTimeout(() => setGeminiSaved(false), 3000);
    };

    const handleTestGemini = async () => {
        setTestingGemini(true);
        setGeminiStatus(null);
        const res = await testGeminiApiKey(geminiKey || profile?.geminiApiKey);
        setTestingGemini(false);
        setGeminiStatus(res);
    };

    const handleSaveMaps = () => {
        updateProfile({ googleMapsApiKey: mapsKey.trim() });
        setMapsSaved(true);
        setTimeout(() => setMapsSaved(false), 3000);
    };

    const handleTestMaps = async () => {
        setTestingMaps(true);
        setMapsStatus(null);
        const res = await testGoogleMapsApiKey(mapsKey || profile?.googleMapsApiKey);
        setTestingMaps(false);
        setMapsStatus(res);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Sparkles size={20} color="var(--accent-primary)" /> Google Cloud & Developer Program Integration
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Power NovuJobs with your Google Developer Program benefits. Your \$190.00 credit pool covers all Google Cloud APIs (Gemini Vertex AI, Firebase Blaze) and Google Maps Platform services through 2027.
                </p>
            </div>

            {/* Developer Program Credit Badge */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(94, 135, 110, 0.16) 0%, rgba(132, 167, 145, 0.14) 100%)',
                border: '1px solid rgba(94, 135, 110, 0.35)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ShieldCheck size={24} color="var(--accent-primary)" />
                        <div>
                            <h4 style={{ fontWeight: '700', fontSize: '0.95rem' }}>Active Benefit: \$190.00 Google Cloud & Maps Credits</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                                Scope: All Google Cloud Platform APIs + Google Maps Platform (List pricing)
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <a
                            href="https://console.cloud.google.com/apis/credentials"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                fontSize: '0.78rem',
                                color: 'var(--accent-primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'var(--glass-highlight)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                textDecoration: 'none'
                            }}
                        >
                            GCP Credentials <ExternalLink size={12} />
                        </a>
                        <a
                            href="https://console.cloud.google.com/billing"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                fontSize: '0.78rem',
                                color: 'var(--accent-primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'var(--glass-highlight)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                textDecoration: 'none'
                            }}
                        >
                            Billing & Budgets <ExternalLink size={12} />
                        </a>
                    </div>
                </div>
            </div>

            {/* 1. Gemini AI API Key */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={16} color="var(--accent-primary)" /> Google Gemini API Key
                </label>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                    Used for AI resume tailoring, automated interview questions, and job recommendation scoring.
                </p>
                <div style={{ position: 'relative' }}>
                    <input
                        aria-label="Gemini API Key"
                        type={showGemini ? 'text' : 'password'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIzaSy... (from AI Studio or Google Cloud Console)"
                        style={{ width: '100%', paddingRight: '75px' }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowGemini(!showGemini)}
                        aria-label={showGemini ? "Hide API key" : "Show API key"}
                        style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.82rem'
                        }}
                    >
                        {showGemini ? 'Hide' : 'Show'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleSaveGemini} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                        {geminiSaved ? 'Saved!' : 'Save Key'}
                    </button>
                    <button
                        type="button"
                        onClick={handleTestGemini}
                        disabled={testingGemini || (!geminiKey && !profile?.geminiApiKey)}
                        style={{
                            padding: '6px 14px',
                            fontSize: '0.85rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--glass-highlight)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)',
                            cursor: testingGemini ? 'wait' : 'pointer'
                        }}
                    >
                        {testingGemini ? 'Testing...' : 'Test Connection'}
                    </button>
                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}
                    >
                        Get Key in AI Studio
                    </a>
                </div>
                {geminiStatus && (
                    <div style={{
                        fontSize: '0.82rem',
                        color: geminiStatus.success ? 'var(--success)' : 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '2px'
                    }}>
                        {geminiStatus.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {geminiStatus.message}
                    </div>
                )}
            </div>

            {/* 2. Google Maps Platform API Key */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={16} color="var(--accent-primary)" /> Google Maps Platform API Key
                </label>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                    Enables Distance Matrix commute calculations and company office mapping (Distance Matrix & Geocoding APIs).
                </p>
                <div style={{ position: 'relative' }}>
                    <input
                        aria-label="Google Maps API Key"
                        type={showMaps ? 'text' : 'password'}
                        value={mapsKey}
                        onChange={(e) => setMapsKey(e.target.value)}
                        placeholder="AIzaSy... (from Google Cloud Console Credentials)"
                        style={{ width: '100%', paddingRight: '75px' }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowMaps(!showMaps)}
                        aria-label={showMaps ? "Hide Google Maps key" : "Show Google Maps key"}
                        style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.82rem'
                        }}
                    >
                        {showMaps ? 'Hide' : 'Show'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" onClick={handleSaveMaps} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                        {mapsSaved ? 'Saved!' : 'Save Key'}
                    </button>
                    <button
                        type="button"
                        onClick={handleTestMaps}
                        disabled={testingMaps || (!mapsKey && !profile?.googleMapsApiKey)}
                        style={{
                            padding: '6px 14px',
                            fontSize: '0.85rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--glass-highlight)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)',
                            cursor: testingMaps ? 'wait' : 'pointer'
                        }}
                    >
                        {testingMaps ? 'Testing...' : 'Test Connection'}
                    </button>
                    <a
                        href="https://console.cloud.google.com/google/maps-apis/overview"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}
                    >
                        Enable Maps APIs in GCP
                    </a>
                </div>
                {mapsStatus && (
                    <div style={{
                        fontSize: '0.82rem',
                        color: mapsStatus.success ? 'var(--success)' : 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '2px'
                    }}>
                        {mapsStatus.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {mapsStatus.message}
                    </div>
                )}
            </div>

            {/* 3. Zero-Overflow Budget & Credit Protection */}
            <div style={{
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={20} color="var(--warning)" />
                    <h4 style={{ fontWeight: '700', fontSize: '0.95rem' }}>Credit Overflow Protection (\$10/mo Safety Guard)</h4>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    To ensure you never pay beyond your monthly promotional credits, NovuJobs enforces local monthly request caps and persistent route caching.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    {/* Maps Usage Box */}
                    <div style={{ background: 'var(--glass-highlight)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: '600' }}>Google Maps Calls</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                                {getMapsUsageStats().used} / {getMapsUsageStats().cap}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                            Past routes are cached locally to save API calls.
                        </p>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                                aria-label="Monthly Maps API cap"
                                type="number"
                                min="10"
                                max="1000"
                                defaultValue={getMapsUsageStats().cap}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val > 0) setMapsMonthlyCap(val);
                                }}
                                style={{ width: '80px', padding: '4px 8px', fontSize: '0.8rem' }}
                                title="Max Maps calls allowed per month"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    clearMapsCache();
                                    alert('Commute cache cleared.');
                                }}
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: 'var(--glass-panel)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear Cache
                            </button>
                        </div>
                    </div>

                    {/* Gemini Usage Box */}
                    <div style={{ background: 'var(--glass-highlight)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: '600' }}>Gemini AI Calls</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                                {getGeminiUsageStats().used} / {getGeminiUsageStats().cap}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                            Covers resume parsing, tailor bullets, and job match.
                        </p>
                        <input
                            aria-label="Monthly Gemini API cap"
                            type="number"
                            min="10"
                            max="2000"
                            defaultValue={getGeminiUsageStats().cap}
                            onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val > 0) setGeminiMonthlyCap(val);
                            }}
                            style={{ width: '80px', padding: '4px 8px', fontSize: '0.8rem' }}
                            title="Max Gemini AI calls allowed per month"
                        />
                    </div>
                </div>

                {/* Hard Cap GCP Recommendation */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(234, 179, 8, 0.2)', paddingTop: '10px' }}>
                    <p style={{ margin: '0 0 6px 0', fontWeight: '600', color: 'var(--text-primary)' }}>
                        🔒 100% Hard Stop in Google Cloud Console:
                    </p>
                    <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <li>Set a monthly budget of <strong>\$10.00</strong> in <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>GCP Billing & Budgets</a> with email notifications at 50%, 80%, and 100%.</li>
                        <li>Set daily quota limits under <a href="https://console.cloud.google.com/apis/enabled" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>APIs & Services &rarr; Quotas</a> (e.g. max 50 Distance Matrix requests/day). Google will drop excess calls rather than billing extra.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}

function ResumeUpload({ onAnalysisComplete }) {
    const fileInputRef = useRef(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const profile = useAppStore(state => state.profile);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setError("File is too large (max 5MB)");
            return;
        }

        setAnalyzing(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const prompt = `
            You are an expert career coach and resume analyst.
            Analyze the following resume and extract the key information needed to find relevant job matches and improve the user's profile.

            Return a JSON object with the following structure:
            {
                "skills": ["skill1", "skill2", ...],
                "experienceLevel": "Entry/Mid/Senior/Executive",
                "targetRoles": ["Role Title 1", "Role Title 2"],
                "summary": "A 2-sentence professional summary of the candidate.",
                "keywords": ["keyword1", "keyword2", ...]
            }

            Resume Content:
            `;

            const documentPart = await fileToGenerativePart(file);
            const responseText = await generateWithFallback([prompt, documentPart], { jsonMode: true });
            const analysis = extractJson(responseText);

            console.log("Resume analysis:", analysis);
            onAnalysisComplete(analysis);
        } catch (err) {
            console.error('Resume analysis error:', err);
            if (err?.code === 'SUBSCRIPTION_REQUIRED') {
                setError('NovuJobs Pro ($9.99/mo) or your personal Gemini API key is required to analyze resumes with AI.');
            } else {
                setError(err.message || 'Failed to analyze resume. Please check your Gemini API key in Profile settings.');
            }
        } finally {
            setAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const hasResume = profile?.resumeAnalysis;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: hasResume ? 'rgba(34, 197, 94, 0.1)' : 'var(--glass-highlight)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {hasResume ? <CheckCircle size={24} color="var(--success)" /> : <FileText size={24} color="var(--text-secondary)" />}
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {hasResume ? 'Resume Analyzed' : 'Upload Resume'}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {hasResume
                            ? 'Your resume has been processed. We use this to find better job matches.'
                            : 'Upload your resume (PDF) to auto-fill your profile and get better job matches.'}
                    </p>
                </div>
                <div>
                    <input
                        type="file"
                        accept=".pdf,.txt"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        aria-label="Upload Resume"
                    />
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={analyzing}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {analyzing ? (
                            <>
                                <Loader size={16} className="spin" /> Analyzing...
                            </>
                        ) : (
                            <>
                                <Upload size={16} /> {hasResume ? 'Update Resume' : 'Upload PDF'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--error)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {hasResume && (
                <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--accent-primary)' }}>AI Summary:</p>
                    <p style={{ fontStyle: 'italic', marginBottom: '12px', color: 'var(--text-secondary)' }}>&ldquo;{profile.resumeAnalysis.summary}&rdquo;</p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {profile.resumeAnalysis.skills?.slice(0, 5).map((skill, i) => (
                            <span key={i} style={{ padding: '4px 10px', background: 'var(--glass-highlight)', borderRadius: '12px', fontSize: '0.8rem' }}>
                                {skill}
                            </span>
                        ))}
                        {profile.resumeAnalysis.skills?.length > 5 && (
                            <span style={{ padding: '4px 10px', fontSize: '0.8rem', opacity: 0.7 }}>+{profile.resumeAnalysis.skills.length - 5} more</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
