"use client";
import React, { useState, useEffect } from 'react';
import {
    Sliders, Target, Briefcase, MapPin, DollarSign, Sparkles,
    Check, ChevronDown, ChevronUp, Plus, CheckCircle2, ExternalLink, FileText
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { calculateGoalProgress, DEFAULT_GOAL } from '@/lib/goal-tracker';
import { sanitizeUrl } from '@/lib/utils';
import GoalCustomizationModal from './GoalCustomizationModal';

const MODALITY_OPTIONS = ['Remote', 'Hybrid', 'On-site'];
const EXPERIENCE_LEVEL_OPTIONS = [
    'Intern / Junior',
    'Mid-Level',
    'Mid-Senior',
    'Senior',
    'Lead / Manager',
    'Executive'
];

function parseMultiSelect(value, validOptions, fallbackDefault) {
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

function formatMultiSelect(selectedArray, validOptions, fallbackDefault) {
    const ordered = validOptions.filter(opt => selectedArray.includes(opt));
    return ordered.length > 0 ? ordered.join(', ') : fallbackDefault;
}

export default function JobSettingsBanner({
    onSettingsSaved,
    showGoalSummary = true,
    showAddJobButton = true,
    defaultExpanded = false,
    compact = false
}) {
    const profile = useAppStore(state => state.profile);
    const updateProfile = useAppStore(state => state.updateProfile);
    const jobs = useAppStore(state => state.jobs);
    const openNewJobModal = useUIStore(state => state.openNewJobModal);

    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [showTodayRoles, setShowTodayRoles] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedToast, setSavedToast] = useState('');

    const [draft, setDraft] = useState(() => ({
        targetRole: profile?.targetRole || '',
        keywords: profile?.keywords || '',
        location: profile?.location ?? 'Puerto Rico',
        country: profile?.country || '',
        minimumSalary: profile?.minimumSalary != null ? String(profile.minimumSalary) : '',
        modality: parseMultiSelect(profile?.modality, MODALITY_OPTIONS, 'Remote'),
        experienceLevel: parseMultiSelect(profile?.experienceLevel, EXPERIENCE_LEVEL_OPTIONS, 'Mid-Senior')
    }));

    useEffect(() => {
        if (profile && !isExpanded) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDraft({
                targetRole: profile.targetRole || '',
                keywords: profile.keywords || '',
                location: profile.location ?? 'Puerto Rico',
                country: profile.country || '',
                minimumSalary: profile.minimumSalary != null ? String(profile.minimumSalary) : '',
                modality: parseMultiSelect(profile.modality, MODALITY_OPTIONS, 'Remote'),
                experienceLevel: parseMultiSelect(profile.experienceLevel, EXPERIENCE_LEVEL_OPTIONS, 'Mid-Senior')
            });
        }
    }, [profile, isExpanded]);

    const goalProgress = calculateGoalProgress(jobs, profile?.applicationGoal || DEFAULT_GOAL);

    const activeModalityList = parseMultiSelect(profile?.modality, MODALITY_OPTIONS, 'Remote');
    const activeExperienceList = parseMultiSelect(profile?.experienceLevel, EXPERIENCE_LEVEL_OPTIONS, 'Mid-Senior');

    const toggleMultiOption = (field, option, validOptions, fallbackDefault) => {
        setDraft(prev => {
            const current = Array.isArray(prev[field]) ? prev[field] : [fallbackDefault];
            const exists = current.includes(option);
            let next;
            if (exists) {
                next = current.length > 1 ? current.filter(item => item !== option) : current;
            } else {
                next = [...current, option];
            }
            return {
                ...prev,
                [field]: validOptions.filter(opt => next.includes(opt))
            };
        });
    };

    const selectAllMultiOptions = (field, validOptions) => {
        setDraft(prev => ({
            ...prev,
            [field]: [...validOptions]
        }));
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSavedToast('');

        const formattedModality = formatMultiSelect(draft.modality, MODALITY_OPTIONS, 'Remote');
        const formattedExperience = formatMultiSelect(draft.experienceLevel, EXPERIENCE_LEVEL_OPTIONS, 'Mid-Senior');
        const includesRemote = draft.modality.includes('Remote');

        const updatedFields = {
            targetRole: (draft.targetRole || '').trim(),
            keywords: (draft.keywords || '').trim(),
            location: (draft.location || '').trim(),
            country: (draft.country || '').trim(),
            minimumSalary: draft.minimumSalary != null ? String(draft.minimumSalary).trim() : '',
            modality: formattedModality,
            experienceLevel: formattedExperience,
            isRemote: includesRemote
        };

        const res = await updateProfile(updatedFields);
        setSaving(false);
        setSavedToast(res?.synced ? 'Job settings saved & synced!' : 'Job settings saved!');
        if (typeof onSettingsSaved === 'function') {
            onSettingsSaved(updatedFields);
        }
        setTimeout(() => {
            setSavedToast('');
            setIsExpanded(false);
        }, 1400);
    };

    return (
        <>
            <section
                aria-label="Job Search and Target Settings"
                className="card"
                style={{
                    padding: isExpanded ? (compact ? '14px 16px' : '16px 20px') : '10px 14px',
                    marginBottom: compact ? '10px' : '14px',
                    background: 'var(--bg-panel)',
                    border: isExpanded ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    flexShrink: 0
                }}
            >
                {/* Row 1: Compact Collapsible Header Title + Summary Badge + Action Buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: isExpanded ? '12px' : 0
                }}>
                    <div
                        onClick={() => setIsExpanded(prev => !prev)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            minWidth: 0,
                            flex: 1
                        }}
                    >
                        <div style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '7px',
                            background: 'rgba(107, 126, 103, 0.16)',
                            border: '1px solid rgba(107, 126, 103, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Sliders size={13} color="var(--accent-primary)" />
                        </div>
                        <span style={{ whiteSpace: 'nowrap' }}>Job Filters</span>
                        {!isExpanded && (
                            <span style={{
                                fontSize: '0.76rem',
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                minWidth: 0
                            }}>
                                · {profile?.targetRole || 'All Roles'} ({activeModalityList.join('/')})
                            </span>
                        )}
                        {!isExpanded && showGoalSummary && (
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '999px',
                                background: 'rgba(107, 126, 103, 0.14)',
                                color: 'var(--accent-primary)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}>
                                Goal: {goalProgress.count}/{goalProgress.target}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(prev => !prev)}
                            className="btn-secondary"
                            aria-expanded={isExpanded}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.76rem',
                                padding: '5px 10px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <span>{isExpanded ? 'Hide Filters' : 'Show Filters'}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {showAddJobButton && (
                            <button
                                type="button"
                                onClick={openNewJobModal}
                                className="btn-primary"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.76rem',
                                    padding: '5px 11px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <Plus size={13} />
                                <span>Add Job</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Row 2: Full-Width Horizontal Filter Strip (visible when expanded) */}
                {isExpanded && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    width: '100%'
                }}>
                    {/* Target Role Pill */}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 11px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                        title="Click to edit Target Role"
                    >
                        <Briefcase size={12} color="var(--accent-primary)" />
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Role:</span>
                        <span>{profile?.targetRole || 'Set Target Role'}</span>
                    </button>

                    {/* Modality Pill */}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 11px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: 'rgba(107, 126, 103, 0.14)',
                            border: '1px solid rgba(107, 126, 103, 0.32)',
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                        title="Working Modality (Multi-select)"
                    >
                        <span style={{ opacity: 0.8, fontWeight: 500 }}>Modality:</span>
                        <span>{activeModalityList.join(' · ')}</span>
                    </button>

                    {/* Experience Level Pill */}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 11px',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                        title="Experience Level (Multi-select)"
                    >
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Level:</span>
                        <span>
                            {activeExperienceList.length > 2
                                ? `${activeExperienceList.slice(0, 2).join(', ')} +${activeExperienceList.length - 2}`
                                : activeExperienceList.join(' · ')}
                        </span>
                    </button>

                    {/* Location Pill */}
                    {profile?.location && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 11px',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                            title="Target Location"
                        >
                            <MapPin size={12} color="var(--accent-primary)" />
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Location:</span>
                            <span>{profile.location}</span>
                        </button>
                    )}

                    {/* Minimum Salary Pill */}
                    {profile?.minimumSalary && (
                        <button
                            type="button"
                            onClick={() => setIsExpanded(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 11px',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                            title="Minimum Salary"
                        >
                            <DollarSign size={12} color="var(--success)" />
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Min:</span>
                            <span>${Number(profile.minimumSalary).toLocaleString()}+</span>
                        </button>
                    )}
                </div>
                )}

                {/* Row 3: Dedicated Application Goal Section (visible when expanded) */}
                {isExpanded && showGoalSummary && (
                    <div style={{
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            {/* Goal Title + Progress Info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontWeight: 700,
                                    fontSize: '0.86rem',
                                    color: 'var(--text-primary)'
                                }}>
                                    <Target size={16} color={goalProgress.percentage >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
                                    <span>Application Goal</span>
                                </div>

                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {goalProgress.cadence}
                                </span>

                                <span style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    color: goalProgress.percentage >= 100 ? 'var(--success)' : 'var(--text-primary)'
                                }}>
                                    {goalProgress.count} / {goalProgress.target} applications ({goalProgress.percentage}%)
                                </span>

                                <span style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    padding: '2px 9px',
                                    borderRadius: '999px',
                                    background: goalProgress.todayCount > 0 ? 'rgba(78, 135, 82, 0.16)' : 'var(--bg-card)',
                                    border: goalProgress.todayCount > 0 ? '1px solid rgba(78, 135, 82, 0.4)' : '1px solid var(--border-subtle)',
                                    color: goalProgress.todayCount > 0 ? 'var(--success)' : 'var(--text-secondary)'
                                }}>
                                    {goalProgress.todayCount} Applied Today
                                </span>
                            </div>

                            {/* Goal Actions: View Today's Roles + Customize Goal */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowTodayRoles(prev => !prev)}
                                    className="btn-secondary"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.76rem',
                                        padding: '5px 10px',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <Briefcase size={12} color="var(--accent-primary)" />
                                    <span>{showTodayRoles ? 'Hide Today\'s Roles' : `Roles Applied Today (${goalProgress.todayCount})`}</span>
                                    {showTodayRoles ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsGoalModalOpen(true)}
                                    className="btn-secondary"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.76rem',
                                        padding: '5px 11px',
                                        whiteSpace: 'nowrap',
                                        borderColor: 'rgba(107, 126, 103, 0.4)'
                                    }}
                                >
                                    <Target size={12} color="var(--accent-primary)" />
                                    <span>Customize Goal</span>
                                </button>
                            </div>
                        </div>

                        {/* Visual Goal Progress Bar */}
                        <div style={{
                            width: '100%',
                            height: '8px',
                            borderRadius: '999px',
                            background: 'var(--bg-card)',
                            overflow: 'hidden',
                            border: '1px solid var(--border-subtle)'
                        }}>
                            <div style={{
                                width: `${Math.min(100, goalProgress.percentage)}%`,
                                height: '100%',
                                borderRadius: '999px',
                                background: goalProgress.percentage >= 100
                                    ? 'linear-gradient(90deg, #4E8752, #6BA368)'
                                    : 'var(--accent-gradient)',
                                transition: 'width 0.35s ease'
                            }} />
                        </div>

                        {/* Collapsible Drawer: Roles Applied Today */}
                        {showTodayRoles && (
                            <div style={{
                                marginTop: '4px',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                maxHeight: '180px',
                                overflowY: 'auto'
                            }}>
                                {goalProgress.todayJobs && goalProgress.todayJobs.length > 0 ? (
                                    goalProgress.todayJobs.map((job, idx) => {
                                        const roleTitle = job.role || job.title || 'Untitled Role';
                                        const cleanJobUrl = sanitizeUrl(job.url || job.link);
                                        const cleanResumeUrl = sanitizeUrl(job.resumeUrl);
                                        return (
                                            <div
                                                key={job.id || idx}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '10px',
                                                    padding: '6px 8px',
                                                    borderRadius: '8px',
                                                    background: 'var(--bg-panel)',
                                                    border: '1px solid var(--border-subtle)',
                                                    flexWrap: 'wrap'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                    <span style={{
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '5px',
                                                        background: 'rgba(107, 126, 103, 0.16)',
                                                        color: 'var(--accent-primary)',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        {idx + 1}
                                                    </span>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                        {roleTitle}
                                                    </span>
                                                    <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                                        · {job.company || 'Unknown Company'}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {cleanResumeUrl && (
                                                        <a
                                                            href={cleanResumeUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 600,
                                                                padding: '2px 7px',
                                                                borderRadius: '6px',
                                                                background: 'rgba(107, 126, 103, 0.14)',
                                                                color: 'var(--accent-primary)',
                                                                textDecoration: 'none'
                                                            }}
                                                        >
                                                            <FileText size={11} />
                                                            {job.resumeName || 'Resume'}
                                                        </a>
                                                    )}
                                                    {cleanJobUrl && (
                                                        <a
                                                            href={cleanJobUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px',
                                                                fontSize: '0.7rem',
                                                                color: 'var(--text-secondary)',
                                                                textDecoration: 'none'
                                                            }}
                                                        >
                                                            <ExternalLink size={11} />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '6px 0' }}>
                                        No roles logged yet today. Click <strong>+ Add Job</strong> to log an application toward your goal.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Expandable Full-Width Job Settings Editor */}
                {isExpanded && (
                    <form
                        onSubmit={handleSaveSettings}
                        style={{
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}
                    >
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
                            gap: '12px'
                        }}>
                            <div>
                                <label htmlFor="banner-target-role" style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Target Job Title
                                </label>
                                <input
                                    id="banner-target-role"
                                    name="targetRole"
                                    type="text"
                                    value={draft.targetRole}
                                    onChange={e => setDraft(prev => ({ ...prev, targetRole: e.target.value }))}
                                    placeholder="e.g. Senior Software Engineer"
                                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label htmlFor="banner-keywords" style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Core Skills & Keywords
                                </label>
                                <input
                                    id="banner-keywords"
                                    name="keywords"
                                    type="text"
                                    value={draft.keywords}
                                    onChange={e => setDraft(prev => ({ ...prev, keywords: e.target.value }))}
                                    placeholder="e.g. React, Python, AI, TypeScript"
                                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label htmlFor="banner-location" style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Target Location
                                </label>
                                <input
                                    id="banner-location"
                                    name="location"
                                    type="text"
                                    value={draft.location}
                                    onChange={e => setDraft(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="e.g. Austin, TX or Puerto Rico"
                                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label htmlFor="banner-min-salary" style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Minimum Salary (USD)
                                </label>
                                <input
                                    id="banner-min-salary"
                                    name="minimumSalary"
                                    type="number"
                                    step="1000"
                                    value={draft.minimumSalary}
                                    onChange={e => setDraft(prev => ({ ...prev, minimumSalary: e.target.value }))}
                                    placeholder="e.g. 120000"
                                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                                />
                            </div>
                        </div>

                        {/* Multi-Select Chip Pickers for Working Modality & Experience Level */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                            gap: '14px'
                        }}>
                            {/* Working Modality Multi-Select */}
                            <fieldset style={{
                                margin: 0,
                                padding: '12px 14px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-card)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <legend style={{ padding: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Working Modality <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>(Multi-select)</span>
                                    </legend>
                                    <button
                                        type="button"
                                        onClick={() => selectAllMultiOptions('modality', MODALITY_OPTIONS)}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                    >
                                        Select All
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {MODALITY_OPTIONS.map(opt => {
                                        const selected = draft.modality.includes(opt);
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => toggleMultiOption('modality', opt, MODALITY_OPTIONS, 'Remote')}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    padding: '6px 12px',
                                                    borderRadius: '999px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: selected ? 700 : 500,
                                                    background: selected ? 'var(--accent-primary)' : 'var(--bg-panel)',
                                                    color: selected ? '#ffffff' : 'var(--text-primary)',
                                                    border: selected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                {selected && <Check size={12} />}
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            {/* Experience Level Multi-Select */}
                            <fieldset style={{
                                margin: 0,
                                padding: '12px 14px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-card)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <legend style={{ padding: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Experience Level <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>(Multi-select)</span>
                                    </legend>
                                    <button
                                        type="button"
                                        onClick={() => selectAllMultiOptions('experienceLevel', EXPERIENCE_LEVEL_OPTIONS)}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                    >
                                        Select All
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {EXPERIENCE_LEVEL_OPTIONS.map(opt => {
                                        const selected = draft.experienceLevel.includes(opt);
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                aria-pressed={selected}
                                                onClick={() => toggleMultiOption('experienceLevel', opt, EXPERIENCE_LEVEL_OPTIONS, 'Mid-Senior')}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '5px 10px',
                                                    borderRadius: '999px',
                                                    fontSize: '0.76rem',
                                                    fontWeight: selected ? 700 : 500,
                                                    background: selected ? 'var(--accent-primary)' : 'var(--bg-panel)',
                                                    color: selected ? '#ffffff' : 'var(--text-primary)',
                                                    border: selected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                {selected && <Check size={11} />}
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        </div>

                        {/* Footer Actions */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsGoalModalOpen(true)}
                                    className="btn-secondary"
                                    style={{ fontSize: '0.8rem', padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Target size={14} color="var(--accent-primary)" />
                                    Customize Application Goal ({goalProgress.target}/{goalProgress.cadence})
                                </button>
                                {savedToast && (
                                    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--success)' }}>
                                        <CheckCircle2 size={15} /> {savedToast}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsExpanded(false)}
                                    className="btn-secondary"
                                    style={{ fontSize: '0.82rem', padding: '8px 14px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="btn-primary"
                                    style={{ fontSize: '0.82rem', padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Sparkles size={14} />
                                    {saving ? 'Saving...' : 'Save Job Settings'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </section>

            <GoalCustomizationModal
                isOpen={isGoalModalOpen}
                onClose={() => setIsGoalModalOpen(false)}
            />
        </>
    );
}
