"use client";
import { useState, useEffect, Suspense, useRef, useMemo, useSyncExternalStore, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User, Upload, CheckCircle, AlertCircle, FileText, Loader, CreditCard, Sparkles, Clock, MapPin, ExternalLink, ShieldCheck, AlertTriangle, Sliders, Target, ChevronDown, Check, Bot, Cpu, Zap, Globe, Copy, Terminal } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';
import { generateWithFallback, fileToGenerativePart, testGeminiApiKey, testClaudeApiKey, testOpenAiApiKey, testCustomAiProvider, getGeminiUsageStats, setGeminiMonthlyCap, extractJson } from '@/lib/gemini-client';
import { testGoogleMapsApiKey, getMapsUsageStats, setMapsMonthlyCap, clearMapsCache } from '@/lib/maps-service';
import { isOwner, isProUser, getStripeCheckoutUrl } from '@/lib/subscription';
import { calculateGoalProgress, DEFAULT_GOAL } from '@/lib/goal-tracker';
import { filterJobsByCycle } from '@/lib/cycle-utils';
import GoalCustomizationModal from '@/components/GoalCustomizationModal';
import AccountSecurityCard from '@/components/AccountSecurityCard';
import { ProfileSkeleton } from '@/components/SkeletonLoaders';

const emptySubscribe = () => () => {};

const MODALITY_OPTIONS = ['Remote', 'Hybrid', 'On-site'];
const EXPERIENCE_LEVEL_OPTIONS = [
    'Intern / Junior',
    'Mid-Level',
    'Mid-Senior',
    'Senior',
    'Lead / Manager',
    'Executive'
];

function parseMultiSelectValue(value, validOptions, fallbackDefault) {
    if (Array.isArray(value)) {
        const filtered = value.map(v => String(v).trim()).filter(v => validOptions.includes(v));
        return filtered.length > 0 ? filtered : [fallbackDefault];
    }
    if (typeof value === 'string' && value.trim()) {
        const parts = value.split(',').map(v => v.trim()).filter(Boolean);
        const matched = parts.filter(v => validOptions.includes(v));
        if (matched.length > 0) return matched;
    }
    return [fallbackDefault];
}

function formatMultiSelectValue(selectedArray, validOptions, fallbackDefault) {
    const ordered = validOptions.filter(opt => selectedArray.includes(opt));
    return ordered.length > 0 ? ordered.join(', ') : fallbackDefault;
}

function MultiSelectDropdown({ id, label, name, options, value, fallbackDefault, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState(null);
    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const selectedValues = useMemo(
        () => parseMultiSelectValue(value, options, fallbackDefault),
        [value, options, fallbackDefault]
    );

    const updateMenuCoords = useCallback(() => {
        if (!triggerRef.current || typeof window === 'undefined') return;
        const rect = triggerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const estimatedHeight = Math.min(280, options.length * 42 + 48);
        const spaceBelow = viewportHeight - rect.bottom - 12;
        const shouldFlipUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight + 16;

        const width = Math.min(Math.max(rect.width, 220), viewportWidth - 24);
        const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));
        const maxHeight = shouldFlipUp
            ? Math.min(280, rect.top - 16)
            : Math.min(280, Math.max(180, spaceBelow));
        const top = shouldFlipUp ? Math.max(12, rect.top - estimatedHeight - 6) : rect.bottom + 6;

        setCoords({ top, left, width, maxHeight });
    }, [options.length]);

    useEffect(() => {
        if (!isOpen) return;
        updateMenuCoords();
        const handleClickOutside = (e) => {
            if (
                containerRef.current && !containerRef.current.contains(e.target) &&
                (!menuRef.current || !menuRef.current.contains(e.target))
            ) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('resize', updateMenuCoords);
        window.addEventListener('scroll', updateMenuCoords, true);
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('resize', updateMenuCoords);
            window.removeEventListener('scroll', updateMenuCoords, true);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, updateMenuCoords]);

    const toggleOption = (opt) => {
        const exists = selectedValues.includes(opt);
        let next;
        if (exists) {
            // Keep at least 1 selected option so the field is never empty
            next = selectedValues.length > 1
                ? selectedValues.filter(item => item !== opt)
                : selectedValues;
        } else {
            next = [...selectedValues, opt];
        }
        const formatted = formatMultiSelectValue(next, options, fallbackDefault);
        onChange({
            target: {
                name,
                value: formatted,
                type: 'multiselect'
            }
        });
    };

    const selectAll = () => {
        const formatted = formatMultiSelectValue(options, options, fallbackDefault);
        onChange({
            target: {
                name,
                value: formatted,
                type: 'multiselect'
            }
        });
    };

    const portalTarget = (typeof document !== 'undefined' && document.getElementById('portal-root')) || (typeof document !== 'undefined' && document.body);

    return (
        <fieldset
            ref={containerRef}
            style={{
                border: 'none',
                margin: 0,
                padding: 0,
                minWidth: 0,
                position: 'relative'
            }}
        >
            <legend style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '1rem', padding: 0 }}>
                {label}
                <span style={{ marginLeft: '6px', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    ({selectedValues.length} selected)
                </span>
            </legend>

            <button
                ref={triggerRef}
                id={id}
                type="button"
                aria-expanded={isOpen}
                onClick={() => {
                    if (!isOpen) updateMenuCoords();
                    setIsOpen(prev => !prev);
                }}
                style={{
                    width: '100%',
                    minHeight: '44px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-panel)',
                    border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: isOpen ? '0 0 0 3px var(--accent-glow)' : 'none'
                }}
            >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, minWidth: 0 }}>
                    {selectedValues.map(item => (
                        <span
                            key={item}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: 'rgba(107, 126, 103, 0.16)',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(107, 126, 103, 0.32)',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <Check size={11} />
                            {item}
                        </span>
                    ))}
                </div>
                <ChevronDown
                    size={16}
                    color="var(--text-secondary)"
                    style={{
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                    }}
                />
            </button>

            {isOpen && coords && portalTarget && createPortal(
                <div
                    ref={menuRef}
                    role="group"
                    aria-label={`${label} options`}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        maxHeight: `${coords.maxHeight}px`,
                        zIndex: 99999,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        boxShadow: '0 22px 48px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px var(--border-subtle)',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        overflowY: 'auto',
                        pointerEvents: 'auto',
                        boxSizing: 'border-box'
                    }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 8px 6px',
                        borderBottom: '1px solid var(--border-subtle)',
                        marginBottom: '2px',
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)'
                    }}>
                        <span>Select one or more</span>
                        <button
                            type="button"
                            onClick={selectAll}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontWeight: 600,
                                fontSize: '0.74rem',
                                cursor: 'pointer',
                                padding: '2px 4px'
                            }}
                        >
                            Select All
                        </button>
                    </div>

                    {options.map(opt => {
                        const isChecked = selectedValues.includes(opt);
                        return (
                            <button
                                key={opt}
                                type="button"
                                aria-pressed={isChecked}
                                onClick={() => toggleOption(opt)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '10px',
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    border: isChecked ? '1px solid rgba(107, 126, 103, 0.35)' : '1px solid transparent',
                                    cursor: 'pointer',
                                    background: isChecked ? 'rgba(107, 126, 103, 0.14)' : 'transparent',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.88rem',
                                    fontWeight: isChecked ? 600 : 500,
                                    textAlign: 'left',
                                    transition: 'background 0.15s ease, border-color 0.15s ease'
                                }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: '17px',
                                            height: '17px',
                                            borderRadius: '5px',
                                            background: isChecked ? 'var(--accent-primary)' : 'var(--bg-panel)',
                                            border: isChecked ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {isChecked && <Check size={12} color="#ffffff" strokeWidth={2.5} />}
                                    </span>
                                    <span>{opt}</span>
                                </span>
                                {isChecked && <Check size={14} color="var(--accent-primary)" />}
                            </button>
                        );
                    })}
                </div>,
                portalTarget
            )}
        </fieldset>
    );
}

function ProfileContent() {
    const profile = useAppStore(state => state.profile);
    const updateProfile = useAppStore(state => state.updateProfile);
    const rawJobs = useAppStore(state => state.jobs);
    const cycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const jobs = useMemo(() => filterJobsByCycle(rawJobs, cycles, selectedCycleId), [rawJobs, cycles, selectedCycleId]);
    const { user, loading } = useAuth();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

    const goalProgress = calculateGoalProgress(jobs, profile?.applicationGoal || DEFAULT_GOAL);

    useEffect(() => {
        if (mounted && !loading && !user) {
            window.location.href = '/login';
        }
    }, [mounted, loading, user]);

    // Local state to handle Core Preferences form inputs before saving to global store
    const [formData, setFormData] = useState(() => ({
        fullName: profile?.fullName || '',
        targetRole: profile?.targetRole || '',
        location: profile?.location ?? 'Puerto Rico',
        keywords: profile?.keywords || '',
        isRemote: Boolean(profile?.isRemote),
        experienceLevel: formatMultiSelectValue(
            parseMultiSelectValue(profile?.experienceLevel, EXPERIENCE_LEVEL_OPTIONS, 'Mid-Senior'),
            EXPERIENCE_LEVEL_OPTIONS,
            'Mid-Senior'
        ),
        country: profile?.country || '',
        modality: formatMultiSelectValue(
            parseMultiSelectValue(profile?.modality, MODALITY_OPTIONS, 'Remote'),
            MODALITY_OPTIONS,
            'Remote'
        ),
        minimumSalary: profile?.minimumSalary != null ? String(profile.minimumSalary) : ''
    }));

    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const isDirtyRef = useRef(false);

    // Load from global store on mount / external updates unless user is actively editing
    useEffect(() => {
        if (profile && !isDirtyRef.current) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                fullName: profile.fullName || '',
                targetRole: profile.targetRole || '',
                location: profile.location ?? 'Puerto Rico',
                keywords: profile.keywords || '',
                isRemote: Boolean(profile.isRemote),
                experienceLevel: formatMultiSelectValue(
                    parseMultiSelectValue(profile.experienceLevel, EXPERIENCE_LEVEL_OPTIONS, 'Mid-Senior'),
                    EXPERIENCE_LEVEL_OPTIONS,
                    'Mid-Senior'
                ),
                country: profile.country || '',
                modality: formatMultiSelectValue(
                    parseMultiSelectValue(profile.modality, MODALITY_OPTIONS, 'Remote'),
                    MODALITY_OPTIONS,
                    'Remote'
                ),
                minimumSalary: profile.minimumSalary != null ? String(profile.minimumSalary) : ''
            });
        }
    }, [profile]);

    if (loading) return <ProfileSkeleton />;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        isDirtyRef.current = true;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveMessage('');

        const normalizedModality = formatMultiSelectValue(
            parseMultiSelectValue(formData.modality, MODALITY_OPTIONS, 'Remote'),
            MODALITY_OPTIONS,
            'Remote'
        );
        const normalizedExperience = formatMultiSelectValue(
            parseMultiSelectValue(formData.experienceLevel, EXPERIENCE_LEVEL_OPTIONS, 'Mid-Senior'),
            EXPERIENCE_LEVEL_OPTIONS,
            'Mid-Senior'
        );
        const includesRemote = parseMultiSelectValue(normalizedModality, MODALITY_OPTIONS, 'Remote').includes('Remote');

        const cleanPreferences = {
            fullName: (formData.fullName || '').trim(),
            targetRole: (formData.targetRole || '').trim(),
            location: (formData.location || '').trim(),
            keywords: (formData.keywords || '').trim(),
            isRemote: includesRemote,
            experienceLevel: normalizedExperience,
            country: (formData.country || '').trim(),
            modality: normalizedModality,
            minimumSalary: formData.minimumSalary != null ? String(formData.minimumSalary).trim() : ''
        };

        isDirtyRef.current = false;
        setFormData(cleanPreferences);

        const result = await updateProfile(cleanPreferences);
        setSaving(false);
        setSaved(true);
        setSaveMessage(
            result?.synced
                ? 'Saved to profile & synced to cloud!'
                : 'Saved to your profile!'
        );
        setTimeout(() => {
            setSaved(false);
            setSaveMessage('');
        }, 3500);
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
                <div className="card animate-slide-up delay-100" style={{ background: 'rgba(107, 126, 103, 0.12)', border: '1px solid rgba(107, 126, 103, 0.35)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>Sync Local Data</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                                Push your locally saved jobs and profile preferences to the cloud so you can see them on other devices.
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
                <div id="api-keys-section" className="card animate-slide-up delay-175">
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
                            <div>
                                <label htmlFor="targetRole" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Job Title</label>
                                <input
                                    id="targetRole"
                                    name="targetRole"
                                    value={formData.targetRole}
                                    onChange={handleChange}
                                    placeholder="e.g. AI Safety Researcher, Software Engineer"
                                />
                            </div>
                            <div>
                                <label htmlFor="keywords" style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Keywords</label>
                                <input
                                    id="keywords"
                                    name="keywords"
                                    value={formData.keywords}
                                    onChange={handleChange}
                                    placeholder="e.g. Python, React, Machine Learning"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px' }}>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px', alignItems: 'start' }}>
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
                            <MultiSelectDropdown
                                id="modality"
                                label="Working Modality"
                                name="modality"
                                options={MODALITY_OPTIONS}
                                value={formData.modality}
                                fallbackDefault="Remote"
                                onChange={handleChange}
                            />
                            <MultiSelectDropdown
                                id="experienceLevel"
                                label="Experience Level"
                                name="experienceLevel"
                                options={EXPERIENCE_LEVEL_OPTIONS}
                                value={formData.experienceLevel}
                                fallbackDefault="Mid-Senior"
                                onChange={handleChange}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '8px' }}>
                            <button type="submit" disabled={saving} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                                {saving ? 'Saving...' : saved ? '✓ Changes Saved!' : 'Save Preferences'}
                            </button>
                            {saveMessage && (
                                <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--success)', fontWeight: 600 }}>
                                    <CheckCircle size={16} /> {saveMessage}
                                </span>
                            )}
                        </div>
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
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 135px), 1fr))',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '12px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Applied Today
                            </span>
                            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', marginTop: '4px', color: goalProgress.todayCount > 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                                {goalProgress.todayCount} <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 500 }}>role{goalProgress.todayCount === 1 ? '' : 's'}</span>
                            </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Current Target
                            </span>
                            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', marginTop: '4px', color: 'var(--accent-primary)' }}>
                                {goalProgress.target} apps <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>/ {goalProgress.cadence}</span>
                            </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Cycle Progress
                            </span>
                            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', marginTop: '4px' }}>
                                {goalProgress.count} of {goalProgress.target} ({goalProgress.percentage}%)
                            </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Cadence Pacing
                            </span>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '6px', color: goalProgress.pace === 'completed' ? 'var(--success)' : goalProgress.pace === 'on_track' ? 'var(--accent-primary)' : 'var(--warning)' }}>
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

                {/* 2. Sign-In & Password Management */}
                <AccountSecurityCard />

                {/* 3. MCP & External AI Assistant Integration */}
                <McpIntegrationCard />

                {/* 3. Data Management */}
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

function McpIntegrationCard() {
    const { user } = useAuth();
    const [copiedUid, setCopiedUid] = useState(false);
    const [copiedConfig, setCopiedConfig] = useState(false);

    if (!user) return null;

    const mcpConfigJson = JSON.stringify({
        mcpServers: {
            novujobs: {
                command: "node",
                args: [
                    "/Users/fabianvelez/.gemini/antigravity/scratch/job-tracker/mcp/server.js"
                ],
                env: {
                    NOVUJOBS_USER_ID: user.uid,
                    FIREBASE_PROJECT_ID: "jobhelper-c3cd7"
                }
            }
        }
    }, null, 2);

    const handleCopyUid = async () => {
        try {
            await navigator.clipboard.writeText(user.uid);
            setCopiedUid(true);
            setTimeout(() => setCopiedUid(false), 2000);
        } catch (e) {
            console.error('Failed to copy UID:', e);
        }
    };

    const handleCopyConfig = async () => {
        try {
            await navigator.clipboard.writeText(mcpConfigJson);
            setCopiedConfig(true);
            setTimeout(() => setCopiedConfig(false), 2000);
        } catch (e) {
            console.error('Failed to copy config:', e);
        }
    };

    return (
        <div className="card animate-slide-up delay-200" id="mcp-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <Terminal size={20} color="var(--accent-primary)" /> Model Context Protocol (MCP) & ChatGPT Connection
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', lineHeight: 1.5 }}>
                        Connect ChatGPT Desktop, Claude Desktop, Cursor, or AI agents directly to your NovuJobs application pipeline over secure local stdio.
                    </p>
                </div>
                <a
                    href="https://github.com/eresfavolosx/JobHelper/tree/main/mcp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}
                >
                    View MCP Repo & Docs <ExternalLink size={13} />
                </a>
            </div>

            {/* User ID Section */}
            <div style={{
                background: 'var(--bg-panel)',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                marginBottom: '14px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Your Firebase User ID (UID)
                        </span>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: '2px', wordBreak: 'break-all' }}>
                            {user.uid}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopyUid}
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        {copiedUid ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                        <span>{copiedUid ? 'Copied UID!' : 'Copy UID'}</span>
                    </button>
                </div>
            </div>

            {/* Desktop MCP Config Snippet */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Client Configuration (Claude Desktop / ChatGPT Desktop)
                    </span>
                    <button
                        type="button"
                        onClick={handleCopyConfig}
                        className="btn-primary"
                        style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                        {copiedConfig ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedConfig ? 'Copied JSON!' : 'Copy Config'}</span>
                    </button>
                </div>
                <pre style={{
                    margin: 0,
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#0d1117',
                    color: '#e6edf3',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    {mcpConfigJson}
                </pre>
            </div>
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

        const safeProfile = profile ? { ...profile } : {};
        delete safeProfile.geminiApiKey;
        delete safeProfile.claudeApiKey;
        delete safeProfile.openaiApiKey;
        delete safeProfile.customAiApiKey;
        delete safeProfile.googleMapsApiKey;

        const exportData = {
            exportDate: new Date().toISOString(),
            user: user ? { email: user.email, displayName: user.displayName } : null,
            profile: safeProfile,
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
        setError('');
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
    const { user } = useAuth();
    const isPlatformOwner = isOwner(user);

    const envGemini = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_GEMINI_API_KEY || '') : '';
    const envMaps = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '') : '';

    // Never expose environment keys or existing saved keys inside DOM <input value="..."> attributes
    // (even type="password" exposes the raw value in DOM inspection).
    // Instead, keep input fields strictly as write-only drafts.
    const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
    const [geminiSaved, setGeminiSaved] = useState(false);
    const [testingGemini, setTestingGemini] = useState(false);
    const [geminiStatus, setGeminiStatus] = useState(null);

    // Claude states
    const [claudeKeyDraft, setClaudeKeyDraft] = useState('');
    const [claudeSaved, setClaudeSaved] = useState(false);
    const [testingClaude, setTestingClaude] = useState(false);
    const [claudeStatus, setClaudeStatus] = useState(null);

    // OpenAI states
    const [openAiKeyDraft, setOpenAiKeyDraft] = useState('');
    const [openAiSaved, setOpenAiSaved] = useState(false);
    const [testingOpenAi, setTestingOpenAi] = useState(false);
    const [openAiStatus, setOpenAiStatus] = useState(null);

    // Custom Provider states (e.g. DeepSeek, Groq, OpenRouter)
    const [customKeyDraft, setCustomKeyDraft] = useState('');
    const [customBaseUrlDraft, setCustomBaseUrlDraft] = useState(profile?.customAiBaseUrl || '');
    const [customModelDraft, setCustomModelDraft] = useState(profile?.customAiModel || '');
    const [customSaved, setCustomSaved] = useState(false);
    const [testingCustom, setTestingCustom] = useState(false);
    const [customStatus, setCustomStatus] = useState(null);
    const [showCustomSettings, setShowCustomSettings] = useState(Boolean(profile?.customAiBaseUrl));

    const [mapsKeyDraft, setMapsKeyDraft] = useState('');
    const [mapsSaved, setMapsSaved] = useState(false);
    const [testingMaps, setTestingMaps] = useState(false);
    const [mapsStatus, setMapsStatus] = useState(null);

    // Check if user has a valid personal BYOK key saved
    const hasPersonalGeminiKey = Boolean(
        profile?.geminiApiKey &&
        profile.geminiApiKey.trim().length > 5 &&
        (isPlatformOwner || profile.geminiApiKey.trim() !== envGemini.trim())
    );
    const hasPersonalClaudeKey = Boolean(profile?.claudeApiKey && profile.claudeApiKey.trim().length > 5);
    const hasPersonalOpenAiKey = Boolean(profile?.openaiApiKey && profile.openaiApiKey.trim().length > 5);
    const hasPersonalCustomAi = Boolean(profile?.customAiApiKey && profile.customAiApiKey.trim().length > 5 && profile?.customAiBaseUrl);
    const activeProvider = profile?.activeAiProvider || 'gemini';

    const hasPersonalMapsKey = Boolean(
        profile?.googleMapsApiKey &&
        profile.googleMapsApiKey.trim().length > 5 &&
        (isPlatformOwner || profile.googleMapsApiKey.trim() !== envMaps.trim())
    );

    const handleSelectProvider = (prov) => {
        updateProfile({ activeAiProvider: prov });
    };

    const handleSaveClaude = () => {
        const trimmed = claudeKeyDraft.trim();
        if (!trimmed) return;
        updateProfile({ claudeApiKey: trimmed });
        setClaudeKeyDraft('');
        setClaudeSaved(true);
        setTimeout(() => setClaudeSaved(false), 3000);
    };

    const handleClearClaude = () => {
        updateProfile({ claudeApiKey: '' });
        setClaudeKeyDraft('');
        setClaudeStatus(null);
    };

    const handleTestClaude = async () => {
        setTestingClaude(true);
        setClaudeStatus(null);
        try {
            const keyToTest = claudeKeyDraft.trim() || (hasPersonalClaudeKey ? profile?.claudeApiKey : '');
            if (!keyToTest) {
                setClaudeStatus({ success: false, message: 'Please enter an Anthropic Claude API key first.' });
                return;
            }
            const res = await testClaudeApiKey(keyToTest);
            setClaudeStatus(res);
        } catch (err) {
            setClaudeStatus({ success: false, message: err?.message || 'Connection test failed.' });
        } finally {
            setTestingClaude(false);
        }
    };

    const handleSaveOpenAi = () => {
        const trimmed = openAiKeyDraft.trim();
        if (!trimmed) return;
        updateProfile({ openaiApiKey: trimmed });
        setOpenAiKeyDraft('');
        setOpenAiSaved(true);
        setTimeout(() => setOpenAiSaved(false), 3000);
    };

    const handleClearOpenAi = () => {
        updateProfile({ openaiApiKey: '' });
        setOpenAiKeyDraft('');
        setOpenAiStatus(null);
    };

    const handleTestOpenAi = async () => {
        setTestingOpenAi(true);
        setOpenAiStatus(null);
        try {
            const keyToTest = openAiKeyDraft.trim() || (hasPersonalOpenAiKey ? profile?.openaiApiKey : '');
            if (!keyToTest) {
                setOpenAiStatus({ success: false, message: 'Please enter an OpenAI API key first.' });
                return;
            }
            const res = await testOpenAiApiKey(keyToTest);
            setOpenAiStatus(res);
        } catch (err) {
            setOpenAiStatus({ success: false, message: err?.message || 'Connection test failed.' });
        } finally {
            setTestingOpenAi(false);
        }
    };

    const handleSaveCustom = () => {
        const key = customKeyDraft.trim() || (hasPersonalCustomAi ? profile?.customAiApiKey : '');
        const baseUrl = customBaseUrlDraft.trim();
        const model = customModelDraft.trim();
        if (!baseUrl) {
            setCustomStatus({ success: false, message: 'Please provide a Base URL (e.g. https://api.deepseek.com/v1).' });
            return;
        }
        updateProfile({
            customAiApiKey: key,
            customAiBaseUrl: baseUrl,
            customAiModel: model
        });
        setCustomKeyDraft('');
        setCustomSaved(true);
        setTimeout(() => setCustomSaved(false), 3000);
    };

    const handleClearCustom = () => {
        updateProfile({
            customAiApiKey: '',
            customAiBaseUrl: '',
            customAiModel: ''
        });
        setCustomKeyDraft('');
        setCustomBaseUrlDraft('');
        setCustomModelDraft('');
        setCustomStatus(null);
    };

    const handleTestCustom = async () => {
        setTestingCustom(true);
        setCustomStatus(null);
        try {
            const keyToTest = customKeyDraft.trim() || (hasPersonalCustomAi ? profile?.customAiApiKey : '');
            const urlToTest = customBaseUrlDraft.trim() || profile?.customAiBaseUrl;
            const modelToTest = customModelDraft.trim() || profile?.customAiModel;
            const res = await testCustomAiProvider(urlToTest, keyToTest, modelToTest);
            setCustomStatus(res);
        } catch (err) {
            setCustomStatus({ success: false, message: err?.message || 'Connection test failed.' });
        } finally {
            setTestingCustom(false);
        }
    };

    // Automatically scrub any accidentally persisted platform env key from non-owner profiles
    useEffect(() => {
        if (!isPlatformOwner && profile) {
            const updates = {};
            if (envGemini && profile.geminiApiKey && profile.geminiApiKey.trim() === envGemini.trim()) {
                updates.geminiApiKey = '';
            }
            if (envMaps && profile.googleMapsApiKey && profile.googleMapsApiKey.trim() === envMaps.trim()) {
                updates.googleMapsApiKey = '';
            }
            if (Object.keys(updates).length > 0) {
                updateProfile(updates);
            }
        }
    }, [isPlatformOwner, profile, envGemini, envMaps, updateProfile]);

    const handleSaveGemini = () => {
        const trimmed = geminiKeyDraft.trim();
        if (!trimmed) return;
        if (!isPlatformOwner && envGemini && trimmed === envGemini.trim()) {
            setGeminiStatus({ success: false, message: 'Please enter your own personal Gemini API key.' });
            return;
        }
        updateProfile({ geminiApiKey: trimmed });
        setGeminiKeyDraft('');
        setGeminiSaved(true);
        setTimeout(() => setGeminiSaved(false), 3000);
    };

    const handleClearGemini = () => {
        updateProfile({ geminiApiKey: '' });
        setGeminiKeyDraft('');
        setGeminiStatus(null);
    };

    const handleTestGemini = async () => {
        setTestingGemini(true);
        setGeminiStatus(null);
        try {
            const keyToTest = geminiKeyDraft.trim()
                || (hasPersonalGeminiKey ? profile?.geminiApiKey : '')
                || (isPlatformOwner ? envGemini : '');
            if (!keyToTest) {
                setGeminiStatus({ success: false, message: 'Please enter a Gemini API key first.' });
                return;
            }
            const res = await testGeminiApiKey(keyToTest);
            setGeminiStatus(res);
        } catch (err) {
            setGeminiStatus({ success: false, message: err?.message || 'Connection test failed.' });
        } finally {
            setTestingGemini(false);
        }
    };

    const handleSaveMaps = () => {
        const trimmed = mapsKeyDraft.trim();
        if (!trimmed) return;
        if (!isPlatformOwner && envMaps && trimmed === envMaps.trim()) {
            setMapsStatus({ success: false, message: 'Please enter your own personal Google Maps API key.' });
            return;
        }
        updateProfile({ googleMapsApiKey: trimmed });
        setMapsKeyDraft('');
        setMapsSaved(true);
        setTimeout(() => setMapsSaved(false), 3000);
    };

    const handleClearMaps = () => {
        updateProfile({ googleMapsApiKey: '' });
        setMapsKeyDraft('');
        setMapsStatus(null);
    };

    const handleTestMaps = async () => {
        setTestingMaps(true);
        setMapsStatus(null);
        try {
            const keyToTest = mapsKeyDraft.trim()
                || (hasPersonalMapsKey ? profile?.googleMapsApiKey : '')
                || (isPlatformOwner ? envMaps : '');
            if (!keyToTest) {
                setMapsStatus({ success: false, message: 'Please enter a Google Maps API key first.' });
                return;
            }
            const res = await testGoogleMapsApiKey(keyToTest);
            setMapsStatus(res);
        } catch (err) {
            setMapsStatus({ success: false, message: err?.message || 'Connection test failed.' });
        } finally {
            setTestingMaps(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Sparkles size={20} color="var(--accent-primary)" />
                    {isPlatformOwner ? 'Google Cloud & Developer Program Integration' : 'Personal API Keys (Bring Your Own Key)'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    {isPlatformOwner
                        ? 'Power NovuJobs with your Google Developer Program benefits. Your $190.00 credit pool covers all Google Cloud APIs (Gemini Vertex AI, Firebase Blaze) and Google Maps Platform services through 2027.'
                        : 'Optionally connect your own personal Google Gemini or Google Maps API keys. Keys are write-only and are never displayed in plaintext after saving.'}
                </p>
            </div>

            {/* Developer Program Credit Badge - Strictly visible ONLY to Platform Owner (fabian.velez1996@gmail.com) */}
            {isPlatformOwner && (
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
                                <h4 style={{ fontWeight: '700', fontSize: '0.95rem' }}>Active Owner Benefit: $190.00 Google Cloud & Maps Credits</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                                    Restricted exclusively to {user?.email} • Platform keys are hidden from all other users
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
            )}

            {/* Primary AI Provider Selector */}
            <div style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <Cpu size={18} color="var(--accent-primary)" />
                            Primary AI Engine
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                            Choose which AI model drives your resume tailoring, career coaching, and job matching.
                        </p>
                    </div>
                    <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: 'rgba(94, 135, 110, 0.15)',
                        border: '1px solid rgba(94, 135, 110, 0.4)',
                        color: 'var(--accent-primary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Active: {activeProvider === 'gemini' ? 'Google Gemini' : activeProvider === 'claude' ? 'Anthropic Claude' : activeProvider === 'openai' ? 'OpenAI ChatGPT' : 'Custom Provider'}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {[
                        { id: 'gemini', label: 'Google Gemini', sub: 'Flash 3.8 / 2.5', icon: Sparkles, configured: hasPersonalGeminiKey || (isPlatformOwner && Boolean(envGemini)) },
                        { id: 'claude', label: 'Anthropic Claude', sub: 'Sonnet 3.5 / Haiku', icon: Zap, configured: hasPersonalClaudeKey },
                        { id: 'openai', label: 'OpenAI ChatGPT', sub: 'GPT-4o / 4o-mini', icon: Bot, configured: hasPersonalOpenAiKey },
                        { id: 'custom', label: 'Custom Provider', sub: 'DeepSeek / Groq / Router', icon: Globe, configured: hasPersonalCustomAi }
                    ].map(p => {
                        const IconComponent = p.icon;
                        const isSelected = activeProvider === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectProvider(p.id)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                    background: isSelected ? 'rgba(94, 135, 110, 0.12)' : 'var(--glass-highlight)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                                    <IconComponent size={16} color={isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                                    {p.configured && (
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} title="Configured" />
                                    )}
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? '700' : '600', color: 'var(--text-primary)' }}>
                                    {p.label}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    {p.sub}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 1. Gemini AI API Key (Write-Only Input) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <label htmlFor="gemini-api-key-input" style={{ fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={16} color="var(--accent-primary)" /> Google Gemini API Key
                    </label>
                    {(hasPersonalGeminiKey || (isPlatformOwner && Boolean(envGemini))) && (
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: '999px',
                            background: 'rgba(78, 135, 82, 0.16)',
                            border: '1px solid rgba(78, 135, 82, 0.4)',
                            color: 'var(--success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <CheckCircle size={12} />
                            {hasPersonalGeminiKey ? 'Personal Key Configured (Hidden)' : 'Owner Platform Key Active (Hidden)'}
                        </span>
                    )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                    Powers multimodal resume analysis and instant job matching with Gemini 3.8 Flash & Gemini 2.5 Flash.
                </p>
                <div>
                    <input
                        id="gemini-api-key-input"
                        aria-label="Gemini API Key"
                        type="password"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={geminiKeyDraft}
                        onChange={(e) => setGeminiKeyDraft(e.target.value)}
                        placeholder={
                            hasPersonalGeminiKey
                                ? '•••••••••••••••••••••••• (Key saved securely — enter a new key to replace)'
                                : isPlatformOwner && envGemini
                                    ? '•••••••••••••••••••••••• (Owner key active — enter a custom key to override)'
                                    : 'Paste your personal Gemini API key (from Google AI Studio)'
                        }
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleSaveGemini}
                        disabled={!geminiKeyDraft.trim()}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.85rem', opacity: geminiKeyDraft.trim() ? 1 : 0.6 }}
                    >
                        {geminiSaved ? 'Saved!' : 'Save Key'}
                    </button>
                    {hasPersonalGeminiKey && (
                        <button
                            type="button"
                            onClick={handleClearGemini}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        >
                            Remove Key
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleTestGemini}
                        disabled={testingGemini || (!geminiKeyDraft.trim() && !hasPersonalGeminiKey && !(isPlatformOwner && envGemini))}
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
                        Get Free Key in AI Studio
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

            {/* 2. Anthropic Claude API Key (Write-Only Input) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <label htmlFor="claude-api-key-input" style={{ fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={16} color="var(--accent-primary)" /> Anthropic Claude API Key
                    </label>
                    {hasPersonalClaudeKey && (
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: '999px',
                            background: 'rgba(78, 135, 82, 0.16)',
                            border: '1px solid rgba(78, 135, 82, 0.4)',
                            color: 'var(--success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <CheckCircle size={12} />
                            Claude Key Configured (Hidden)
                        </span>
                    )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                    Powers deep reasoning and document synthesis with Claude 3.5 Sonnet & Claude 3.5 Haiku.
                </p>
                <div>
                    <input
                        id="claude-api-key-input"
                        aria-label="Anthropic Claude API Key"
                        type="password"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={claudeKeyDraft}
                        onChange={(e) => setClaudeKeyDraft(e.target.value)}
                        placeholder={
                            hasPersonalClaudeKey
                                ? '•••••••••••••••••••••••• (Key saved securely — enter a new key to replace)'
                                : 'Paste your Anthropic API key (sk-ant-...)'
                        }
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleSaveClaude}
                        disabled={!claudeKeyDraft.trim()}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.85rem', opacity: claudeKeyDraft.trim() ? 1 : 0.6 }}
                    >
                        {claudeSaved ? 'Saved!' : 'Save Key'}
                    </button>
                    {hasPersonalClaudeKey && (
                        <button
                            type="button"
                            onClick={handleClearClaude}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        >
                            Remove Key
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleTestClaude}
                        disabled={testingClaude || (!claudeKeyDraft.trim() && !hasPersonalClaudeKey)}
                        style={{
                            padding: '6px 14px',
                            fontSize: '0.85rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--glass-highlight)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)',
                            cursor: testingClaude ? 'wait' : 'pointer'
                        }}
                    >
                        {testingClaude ? 'Testing...' : 'Test Connection'}
                    </button>
                    <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}
                    >
                        Get Key in Anthropic Console
                    </a>
                </div>
                {claudeStatus && (
                    <div style={{
                        fontSize: '0.82rem',
                        color: claudeStatus.success ? 'var(--success)' : 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '2px'
                    }}>
                        {claudeStatus.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {claudeStatus.message}
                    </div>
                )}
            </div>

            {/* 3. OpenAI (ChatGPT) API Key (Write-Only Input) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <label htmlFor="openai-api-key-input" style={{ fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bot size={16} color="var(--accent-primary)" /> OpenAI (ChatGPT) API Key
                    </label>
                    {hasPersonalOpenAiKey && (
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: '999px',
                            background: 'rgba(78, 135, 82, 0.16)',
                            border: '1px solid rgba(78, 135, 82, 0.4)',
                            color: 'var(--success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <CheckCircle size={12} />
                            OpenAI Key Configured (Hidden)
                        </span>
                    )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                    Powers intelligent career recommendations and interview practice with GPT-4o & GPT-4o-mini.
                </p>
                <div>
                    <input
                        id="openai-api-key-input"
                        aria-label="OpenAI API Key"
                        type="password"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={openAiKeyDraft}
                        onChange={(e) => setOpenAiKeyDraft(e.target.value)}
                        placeholder={
                            hasPersonalOpenAiKey
                                ? '•••••••••••••••••••••••• (Key saved securely — enter a new key to replace)'
                                : 'Paste your OpenAI API key (sk-...)'
                        }
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleSaveOpenAi}
                        disabled={!openAiKeyDraft.trim()}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.85rem', opacity: openAiKeyDraft.trim() ? 1 : 0.6 }}
                    >
                        {openAiSaved ? 'Saved!' : 'Save Key'}
                    </button>
                    {hasPersonalOpenAiKey && (
                        <button
                            type="button"
                            onClick={handleClearOpenAi}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        >
                            Remove Key
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleTestOpenAi}
                        disabled={testingOpenAi || (!openAiKeyDraft.trim() && !hasPersonalOpenAiKey)}
                        style={{
                            padding: '6px 14px',
                            fontSize: '0.85rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--glass-highlight)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)',
                            cursor: testingOpenAi ? 'wait' : 'pointer'
                        }}
                    >
                        {testingOpenAi ? 'Testing...' : 'Test Connection'}
                    </button>
                    <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}
                    >
                        Get Key in OpenAI Platform
                    </a>
                </div>
                {openAiStatus && (
                    <div style={{
                        fontSize: '0.82rem',
                        color: openAiStatus.success ? 'var(--success)' : 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '2px'
                    }}>
                        {openAiStatus.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                        {openAiStatus.message}
                    </div>
                )}
            </div>

            {/* 4. Custom OpenAI-Compatible Provider (DeepSeek, Groq, OpenRouter) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => setShowCustomSettings(!showCustomSettings)}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <Globe size={16} color="var(--accent-primary)" />
                        Custom AI Provider (DeepSeek / Groq / OpenRouter / Ollama)
                        <ChevronDown size={14} style={{ transform: showCustomSettings ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                    {hasPersonalCustomAi && (
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: '999px',
                            background: 'rgba(78, 135, 82, 0.16)',
                            border: '1px solid rgba(78, 135, 82, 0.4)',
                            color: 'var(--success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <CheckCircle size={12} />
                            Custom Endpoint Configured
                        </span>
                    )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                    Connect any OpenAI-compatible API endpoint (such as DeepSeek-V3, Groq, or OpenRouter).
                </p>

                {showCustomSettings && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        background: 'var(--glass-highlight)',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                API Base URL (e.g. https://api.deepseek.com/v1 or https://api.groq.com/openai/v1)
                            </label>
                            <input
                                type="text"
                                value={customBaseUrlDraft}
                                onChange={(e) => setCustomBaseUrlDraft(e.target.value)}
                                placeholder="https://api.deepseek.com/v1"
                                style={{ width: '100%', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                Model Identifier (e.g. deepseek-chat or llama-3.3-70b-versatile)
                            </label>
                            <input
                                type="text"
                                value={customModelDraft}
                                onChange={(e) => setCustomModelDraft(e.target.value)}
                                placeholder="deepseek-chat"
                                style={{ width: '100%', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                API Key (write-only)
                            </label>
                            <input
                                type="password"
                                value={customKeyDraft}
                                onChange={(e) => setCustomKeyDraft(e.target.value)}
                                placeholder={hasPersonalCustomAi ? '•••••••••••••••• (Key saved — enter new key to replace)' : 'sk-...'}
                                style={{ width: '100%', fontSize: '0.85rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                            <button
                                type="button"
                                onClick={handleSaveCustom}
                                className="btn-primary"
                                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                            >
                                {customSaved ? 'Saved!' : 'Save Custom Provider'}
                            </button>
                            {hasPersonalCustomAi && (
                                <button
                                    type="button"
                                    onClick={handleClearCustom}
                                    className="btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                                >
                                    Clear Custom Provider
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleTestCustom}
                                disabled={testingCustom || (!customBaseUrlDraft.trim() && !profile?.customAiBaseUrl)}
                                style={{
                                    padding: '6px 14px',
                                    fontSize: '0.82rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--glass-bg)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-subtle)',
                                    cursor: testingCustom ? 'wait' : 'pointer'
                                }}
                            >
                                {testingCustom ? 'Testing...' : 'Test Connection'}
                            </button>
                        </div>
                        {customStatus && (
                            <div style={{
                                fontSize: '0.82rem',
                                color: customStatus.success ? 'var(--success)' : 'var(--error)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginTop: '4px'
                            }}>
                                {customStatus.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {customStatus.message}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 2. Google Maps Platform API Key (Write-Only Input - Never Exposes Key Value in DOM) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <label htmlFor="maps-api-key-input" style={{ fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={16} color="var(--accent-primary)" /> Google Maps Platform API Key
                    </label>
                    {(hasPersonalMapsKey || (isPlatformOwner && Boolean(envMaps))) && (
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: '999px',
                            background: 'rgba(78, 135, 82, 0.16)',
                            border: '1px solid rgba(78, 135, 82, 0.4)',
                            color: 'var(--success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <CheckCircle size={12} />
                            {hasPersonalMapsKey ? 'Personal Key Configured (Hidden)' : 'Owner Platform Key Active (Hidden)'}
                        </span>
                    )}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                    Enables Distance Matrix commute calculations and company office mapping (Distance Matrix & Geocoding APIs).
                </p>
                <div>
                    <input
                        id="maps-api-key-input"
                        aria-label="Google Maps API Key"
                        type="password"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={mapsKeyDraft}
                        onChange={(e) => setMapsKeyDraft(e.target.value)}
                        placeholder={
                            hasPersonalMapsKey
                                ? '•••••••••••••••••••••••• (Key saved securely — enter a new key to replace)'
                                : isPlatformOwner && envMaps
                                    ? '•••••••••••••••••••••••• (Owner key active — enter a custom key to override)'
                                    : 'Paste your personal Google Maps API key'
                        }
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleSaveMaps}
                        disabled={!mapsKeyDraft.trim()}
                        className="btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.85rem', opacity: mapsKeyDraft.trim() ? 1 : 0.6 }}
                    >
                        {mapsSaved ? 'Saved!' : 'Save Key'}
                    </button>
                    {hasPersonalMapsKey && (
                        <button
                            type="button"
                            onClick={handleClearMaps}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        >
                            Remove Personal Key
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleTestMaps}
                        disabled={testingMaps || (!mapsKeyDraft.trim() && !hasPersonalMapsKey && !(isPlatformOwner && envMaps))}
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

            {/* 3. Zero-Overflow Budget & Credit Protection - Strictly visible ONLY to Platform Owner */}
            {isPlatformOwner && (
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
                        <h4 style={{ fontWeight: '700', fontSize: '0.95rem' }}>Credit Overflow Protection ($10/mo Safety Guard)</h4>
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
                            <li>Set a monthly budget of <strong>$10.00</strong> in <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>GCP Billing & Budgets</a> with email notifications at 50%, 80%, and 100%.</li>
                            <li>Set daily quota limits under <a href="https://console.cloud.google.com/apis/enabled" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>APIs & Services &rarr; Quotas</a> (e.g. max 50 Distance Matrix requests/day). Google will drop excess calls rather than billing extra.</li>
                        </ol>
                    </div>
                </div>
            )}
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
