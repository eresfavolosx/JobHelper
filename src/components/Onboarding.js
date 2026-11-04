"use client";
import Link from 'next/link';
import {
    Download, Plus, Monitor, Target, SlidersHorizontal,
    Briefcase, Sparkles, CheckCircle2, ArrowRight, FileText, Columns, X, Compass
} from 'lucide-react';
import { useUIStore } from '@/lib/uiStore';
import { useAppStore } from '@/lib/store';
import { DEFAULT_GOAL } from '@/lib/goal-tracker';
import { sanitizeUrl } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';

const MODALITY_OPTIONS = [
    { value: 'remote', label: 'Remote' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'onsite', label: 'On-Site' }
];

const EXPERIENCE_OPTIONS = [
    { value: 'internship', label: 'Internship' },
    { value: 'entry', label: 'Entry Level' },
    { value: 'associate', label: 'Associate' },
    { value: 'mid-senior', label: 'Mid-Senior' },
    { value: 'director', label: 'Director / Staff' },
    { value: 'executive', label: 'Executive' }
];

const CADENCE_PRESETS = [
    { label: 'Focused Daily (3/day)', cadence: 'daily', target: 3 },
    { label: 'Steady Weekly (10/wk)', cadence: 'weekly', target: 10 },
    { label: 'High-Velocity (15/wk)', cadence: 'weekly', target: 15 },
    { label: 'Monthly Sprint (40/mo)', cadence: 'monthly', target: 40 }
];

function parseMultiCsv(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    return String(val)
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== 'any');
}

export default function Onboarding({ isCollapsible = false, onDismiss }) {
    const { openNewJobModal } = useUIStore();
    const profile = useAppStore(state => state.profile);
    const updateProfile = useAppStore(state => state.updateProfile);
    const addJob = useAppStore(state => state.addJob);
    const jobs = useAppStore(state => state.jobs);

    const [isMobile, setIsMobile] = useState(false);
    const [activeStep, setActiveStep] = useState(1);
    const [savedStepBanner, setSavedStepBanner] = useState('');

    // Step 1 local draft: Target Role & Filters
    const [targetRole, setTargetRole] = useState(profile?.targetRole || '');
    const [location, setLocation] = useState(profile?.location || '');
    const [selectedModalities, setSelectedModalities] = useState(() => parseMultiCsv(profile?.modality));
    const [selectedLevels, setSelectedLevels] = useState(() => parseMultiCsv(profile?.experienceLevel));

    // Step 2 local draft: Application Goal
    const currentGoal = profile?.applicationGoal || DEFAULT_GOAL;
    const [goalCadence, setGoalCadence] = useState(currentGoal.cadence || 'weekly');
    const [goalTarget, setGoalTarget] = useState(Number(currentGoal.target) || 10);

    // Step 3 local draft: Quick-Add First Role
    const [quickJob, setQuickJob] = useState({
        role: '',
        company: '',
        status: 'applied',
        location: '',
        url: '',
        resumeUrl: '',
        resumeName: ''
    });
    const [quickJobError, setQuickJobError] = useState('');

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Completion checks for each step
    const stepStatus = useMemo(() => {
        const hasFilters = Boolean(
            (profile?.targetRole && profile.targetRole.trim()) ||
            (profile?.modality && profile.modality !== 'any') ||
            (profile?.experienceLevel && profile.experienceLevel !== 'any')
        );
        const hasGoal = Boolean(profile?.applicationGoal?.target && profile?.applicationGoal?.cadence);
        const hasFirstJob = Array.isArray(jobs) && jobs.some(j => j && j.status !== 'deleted');
        return {
            1: hasFilters,
            2: hasGoal,
            3: hasFirstJob,
            4: hasFilters && hasGoal && hasFirstJob
        };
    }, [profile, jobs]);

    const completedCount = [stepStatus[1], stepStatus[2], stepStatus[3]].filter(Boolean).length;

    const toggleItem = (list, setList, value) => {
        setList(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const handleSaveStep1 = (e) => {
        e.preventDefault();
        const modalityCsv = selectedModalities.length > 0 ? selectedModalities.join(', ') : 'any';
        const levelCsv = selectedLevels.length > 0 ? selectedLevels.join(', ') : 'any';
        updateProfile({
            targetRole: targetRole.trim(),
            location: location.trim(),
            modality: modalityCsv,
            isRemote: selectedModalities.includes('remote'),
            experienceLevel: levelCsv
        });
        setSavedStepBanner('Job preferences saved!');
        setTimeout(() => setSavedStepBanner(''), 2500);
        setActiveStep(2);
    };

    const handleSaveStep2 = (e) => {
        e.preventDefault();
        const sanitizedTarget = Math.max(1, Math.min(500, Number(goalTarget) || 10));
        updateProfile({
            applicationGoal: {
                ...(profile?.applicationGoal || DEFAULT_GOAL),
                cadence: goalCadence,
                target: sanitizedTarget,
                targetRole: targetRole.trim() || profile?.targetRole || '',
                enabled: true,
                updatedAt: new Date().toISOString()
            }
        });
        setSavedStepBanner(`Application goal set to ${sanitizedTarget} per ${goalCadence === 'daily' ? 'day' : goalCadence === 'weekly' ? 'week' : 'month'}!`);
        setTimeout(() => setSavedStepBanner(''), 2500);
        setActiveStep(3);
    };

    const handleQuickAddJob = (e) => {
        e.preventDefault();
        setQuickJobError('');
        if (!quickJob.role.trim() || !quickJob.company.trim()) {
            setQuickJobError('Please enter both a Role Title and Company Name.');
            return;
        }
        try {
            addJob({
                role: quickJob.role.trim(),
                company: quickJob.company.trim(),
                status: quickJob.status || 'applied',
                location: quickJob.location.trim() || (selectedModalities.includes('remote') ? 'Remote' : ''),
                url: quickJob.url ? (sanitizeUrl(quickJob.url) || quickJob.url.trim()) : '',
                resumeUrl: quickJob.resumeUrl ? (sanitizeUrl(quickJob.resumeUrl) || quickJob.resumeUrl.trim()) : '',
                resumeName: quickJob.resumeName.trim()
            });
            setQuickJob({
                role: '',
                company: '',
                status: 'applied',
                location: '',
                url: '',
                resumeUrl: '',
                resumeName: ''
            });
            setSavedStepBanner('Role added to your Application Board!');
            setTimeout(() => setSavedStepBanner(''), 2500);
            setActiveStep(4);
        } catch (err) {
            setQuickJobError(err?.message || 'Could not add job. Please try again.');
        }
    };

    const steps = [
        { id: 1, title: '1. Role & Filters', subtitle: 'Target role & work style', icon: SlidersHorizontal, done: stepStatus[1] },
        { id: 2, title: '2. Set Your Goal', subtitle: 'Daily or weekly pace', icon: Target, done: stepStatus[2] },
        { id: 3, title: '3. Add First Role', subtitle: 'Track job & resume link', icon: Briefcase, done: stepStatus[3] },
        { id: 4, title: '4. Platform Guide', subtitle: 'Extension & AI tools', icon: Compass, done: stepStatus[4] }
    ];

    return (
        <section
            aria-label="NovuJobs Interactive Setup and Onboarding"
            className="card animate-fade-in"
            style={{
                marginBottom: '24px',
                padding: 'clamp(18px, 3vw, 28px)',
                border: '1px solid rgba(107, 126, 103, 0.35)',
                background: 'linear-gradient(180deg, rgba(107, 126, 103, 0.09) 0%, var(--glass-panel) 100%)',
                position: 'relative'
            }}
        >
            {/* Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            background: 'rgba(107, 126, 103, 0.2)',
                            color: 'var(--accent-primary)',
                            border: '1px solid rgba(107, 126, 103, 0.35)'
                        }}>
                            Interactive Quick-Start ({completedCount}/3 Core Steps Ready)
                        </span>
                        {savedStepBanner && (
                            <span style={{
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                color: 'var(--success)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <CheckCircle2 size={14} /> {savedStepBanner}
                            </span>
                        )}
                    </div>
                    <h2 style={{ fontSize: 'clamp(1.35rem, 2.5vw, 1.75rem)', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Welcome to Novu<span style={{ color: 'var(--accent-primary)' }}>Jobs</span> Command Center
                    </h2>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Set your target role, lock in your application pace, and log your first job with the resume link you used.
                    </p>
                </div>

                {isCollapsible && onDismiss && (
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label="Hide Setup Guide"
                        className="btn-secondary"
                        style={{ padding: '7px 12px', fontSize: '0.8rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <X size={15} /> Hide Guide
                    </button>
                )}
            </div>

            {/* 4-Step Interactive Navigation Tabs */}
            <div
                role="tablist"
                aria-label="Onboarding setup steps"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 185px), 1fr))',
                    gap: '10px',
                    marginBottom: '22px'
                }}
            >
                {steps.map(step => {
                    const Icon = step.icon;
                    const isCurrent = activeStep === step.id;
                    return (
                        <button
                            key={step.id}
                            type="button"
                            role="tab"
                            aria-selected={isCurrent}
                            onClick={() => setActiveStep(step.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                background: isCurrent ? 'rgba(107, 126, 103, 0.18)' : 'var(--bg-card)',
                                border: isCurrent ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                transition: 'border-color 0.18s ease, background-color 0.18s ease'
                            }}
                        >
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '9px',
                                background: step.done ? 'rgba(95, 130, 99, 0.2)' : 'var(--glass-highlight)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {step.done ? (
                                    <CheckCircle2 size={17} color="var(--success)" />
                                ) : (
                                    <Icon size={16} color={isCurrent ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                                )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.84rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {step.title}
                                </div>
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {step.subtitle}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* STEP 1: Target Role & Filters */}
            {activeStep === 1 && (
                <form
                    onSubmit={handleSaveStep1}
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '14px',
                        padding: 'clamp(16px, 2.5vw, 22px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
                        <div>
                            <label htmlFor="onboard-target-role" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Target Role / Title
                            </label>
                            <input
                                id="onboard-target-role"
                                type="text"
                                value={targetRole}
                                onChange={e => setTargetRole(e.target.value)}
                                placeholder="e.g. Senior Frontend Engineer, AI Engineer"
                                style={{ padding: '10px 12px', fontSize: '0.9rem', background: 'var(--bg-app)' }}
                            />
                        </div>
                        <div>
                            <label htmlFor="onboard-location" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Home / Preferred Location (for Commute & Search)
                            </label>
                            <input
                                id="onboard-location"
                                type="text"
                                value={location}
                                onChange={e => setLocation(e.target.value)}
                                placeholder="e.g. New York, NY or Austin, TX"
                                style={{ padding: '10px 12px', fontSize: '0.9rem', background: 'var(--bg-app)' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Work Modality (Select one or more)
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {MODALITY_OPTIONS.map(opt => {
                                    const active = selectedModalities.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => toggleItem(selectedModalities, setSelectedModalities, opt.value)}
                                            style={{
                                                padding: '7px 13px',
                                                borderRadius: '999px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                border: active ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                                background: active ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-app)',
                                                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {active ? '✓ ' : ''}{opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Experience Level (Select one or more)
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {EXPERIENCE_OPTIONS.map(opt => {
                                    const active = selectedLevels.includes(opt.value);
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => toggleItem(selectedLevels, setSelectedLevels, opt.value)}
                                            style={{
                                                padding: '7px 12px',
                                                borderRadius: '999px',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                border: active ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                                background: active ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-app)',
                                                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {active ? '✓ ' : ''}{opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '6px' }}>
                        <Link href="/profile" style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                            Need salary or resume upload? Open full Profile Settings →
                        </Link>
                        <button type="submit" className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.88rem' }}>
                            Save Preferences & Next <ArrowRight size={16} />
                        </button>
                    </div>
                </form>
            )}

            {/* STEP 2: Set Application Goal */}
            {activeStep === 2 && (
                <form
                    onSubmit={handleSaveStep2}
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '14px',
                        padding: 'clamp(16px, 2.5vw, 22px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}
                >
                    <div>
                        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Quick Pace Presets
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {CADENCE_PRESETS.map((preset, i) => {
                                const isSelected = goalCadence === preset.cadence && Number(goalTarget) === preset.target;
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            setGoalCadence(preset.cadence);
                                            setGoalTarget(preset.target);
                                        }}
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: '10px',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            border: isSelected ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            background: isSelected ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-app)',
                                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '16px', alignItems: 'end' }}>
                        <div>
                            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Goal Cadence Period
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {['daily', 'weekly', 'monthly'].map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setGoalCadence(c)}
                                        style={{
                                            padding: '9px 10px',
                                            borderRadius: '9px',
                                            fontSize: '0.84rem',
                                            fontWeight: 700,
                                            textTransform: 'capitalize',
                                            border: goalCadence === c ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            background: goalCadence === c ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-app)',
                                            color: goalCadence === c ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="onboard-goal-target" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Applications per {goalCadence === 'daily' ? 'Day' : goalCadence === 'weekly' ? 'Week' : 'Month'}
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    type="button"
                                    aria-label="Decrease target"
                                    onClick={() => setGoalTarget(prev => Math.max(1, (Number(prev) || 1) - 1))}
                                    className="btn-secondary"
                                    style={{ padding: '8px 14px', fontSize: '1rem', fontWeight: 800 }}
                                >
                                    -
                                </button>
                                <input
                                    id="onboard-goal-target"
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={goalTarget}
                                    onChange={e => setGoalTarget(e.target.value)}
                                    style={{ width: '90px', textAlign: 'center', padding: '9px', fontSize: '1rem', fontWeight: 700, background: 'var(--bg-app)' }}
                                />
                                <button
                                    type="button"
                                    aria-label="Increase target"
                                    onClick={() => setGoalTarget(prev => Math.min(500, (Number(prev) || 1) + 1))}
                                    className="btn-secondary"
                                    style={{ padding: '8px 14px', fontSize: '1rem', fontWeight: 800 }}
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '6px' }}>
                        <button type="button" onClick={() => setActiveStep(1)} className="btn-secondary" style={{ padding: '9px 14px', fontSize: '0.84rem' }}>
                            ← Back
                        </button>
                        <button type="submit" className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.88rem' }}>
                            Save Goal & Next <ArrowRight size={16} />
                        </button>
                    </div>
                </form>
            )}

            {/* STEP 3: Add First Role & Resume Link */}
            {activeStep === 3 && (
                <form
                    onSubmit={handleQuickAddJob}
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '14px',
                        padding: 'clamp(16px, 2.5vw, 22px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Quick-Log a Job Application
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Enter a role you applied to (or bookmarked) and attach the link to the resume version you used.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={openNewJobModal}
                            className="btn-secondary"
                            style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                        >
                            <Plus size={14} /> Open Full Modal (with Commute Calculator)
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '12px' }}>
                        <div>
                            <label htmlFor="quick-role" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Role Title <span style={{ color: 'var(--error)' }}>*</span>
                            </label>
                            <input
                                id="quick-role"
                                type="text"
                                required
                                value={quickJob.role}
                                onChange={e => setQuickJob({ ...quickJob, role: e.target.value })}
                                placeholder={targetRole || 'e.g. Software Engineer'}
                                style={{ padding: '9px 12px', fontSize: '0.88rem', background: 'var(--bg-app)' }}
                            />
                        </div>
                        <div>
                            <label htmlFor="quick-company" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Company <span style={{ color: 'var(--error)' }}>*</span>
                            </label>
                            <input
                                id="quick-company"
                                type="text"
                                required
                                value={quickJob.company}
                                onChange={e => setQuickJob({ ...quickJob, company: e.target.value })}
                                placeholder="e.g. Stripe, OpenAI, Vercel"
                                style={{ padding: '9px 12px', fontSize: '0.88rem', background: 'var(--bg-app)' }}
                            />
                        </div>
                        <div>
                            <label htmlFor="quick-url" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Job Posting URL (Optional)
                            </label>
                            <input
                                id="quick-url"
                                type="text"
                                inputMode="url"
                                value={quickJob.url}
                                onChange={e => setQuickJob({ ...quickJob, url: e.target.value })}
                                placeholder="https://..."
                                style={{ padding: '9px 12px', fontSize: '0.88rem', background: 'var(--bg-app)' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px', padding: '12px', borderRadius: '10px', background: 'var(--glass-panel)', border: '1px solid var(--border-subtle)' }}>
                        <div>
                            <label htmlFor="quick-resume-url" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                <FileText size={13} color="var(--accent-primary)" /> Resume Link Used (Google Docs / Drive / Notion)
                            </label>
                            <input
                                id="quick-resume-url"
                                type="text"
                                inputMode="url"
                                value={quickJob.resumeUrl}
                                onChange={e => setQuickJob({ ...quickJob, resumeUrl: e.target.value })}
                                placeholder="https://docs.google.com/document/d/..."
                                style={{ padding: '8px 10px', fontSize: '0.85rem', background: 'var(--bg-app)' }}
                            />
                        </div>
                        <div>
                            <label htmlFor="quick-resume-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Resume Version Label (Optional)
                            </label>
                            <input
                                id="quick-resume-name"
                                type="text"
                                value={quickJob.resumeName}
                                onChange={e => setQuickJob({ ...quickJob, resumeName: e.target.value })}
                                placeholder="e.g. Frontend Resume v2"
                                style={{ padding: '8px 10px', fontSize: '0.85rem', background: 'var(--bg-app)' }}
                            />
                        </div>
                    </div>

                    {quickJobError && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--error)', fontWeight: 600 }}>
                            {quickJobError}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '4px' }}>
                        <button type="button" onClick={() => setActiveStep(2)} className="btn-secondary" style={{ padding: '9px 14px', fontSize: '0.84rem' }}>
                            ← Back
                        </button>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => setActiveStep(4)} className="btn-secondary" style={{ padding: '9px 14px', fontSize: '0.84rem' }}>
                                Skip to Toolkit →
                            </button>
                            <button type="submit" className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.88rem' }}>
                                <Plus size={16} /> Add Role to Board
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* STEP 4: Connect Tools & Platform Guide */}
            {activeStep === 4 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: '14px' }}>
                    <div className="card" style={{ padding: '18px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                            <Columns size={18} color="var(--accent-primary)" /> Application Kanban Board
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                            Drag cards between stages or use the <strong>Stage pill selector</strong> on any card. Attach the resume link you used and launch the <strong>AI Coach</strong> for follow-up emails.
                        </p>
                        <Link href="/kanban" className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.82rem', width: '100%' }}>
                            Open Application Board →
                        </Link>
                    </div>

                    <div className="card" style={{ padding: '18px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                            {isMobile ? <Monitor size={18} color="var(--accent-primary)" /> : <Download size={18} color="var(--accent-primary)" />}
                            1-Click Chrome Extension
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                            Capture jobs directly from LinkedIn, Indeed, Greenhouse, and Lever with clean title parsing and your resume link attached.
                        </p>
                        {isMobile ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '8px', textAlign: 'center', background: 'var(--glass-panel)', borderRadius: '8px' }}>
                                Available on Desktop Chrome
                            </span>
                        ) : (
                            <Link href="/install" className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.82rem', width: '100%' }}>
                                Install Chrome Extension →
                            </Link>
                        )}
                    </div>

                    <div className="card" style={{ padding: '18px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                            <Sparkles size={18} color="var(--accent-primary)" /> AI Job Recommendations
                        </div>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>
                            Discover curated roles matched against your multi-select filters and score how well your resume aligns before applying.
                        </p>
                        <Link href="/recommendations" className="btn-secondary" style={{ padding: '8px 12px', fontSize: '0.82rem', width: '100%' }}>
                            Explore Matched Jobs →
                        </Link>
                    </div>
                </div>
            )}
        </section>
    );
}
