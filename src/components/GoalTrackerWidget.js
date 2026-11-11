"use client";
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
    Target, Sliders, CheckCircle2, TrendingUp, AlertCircle,
    Calendar, Briefcase, ExternalLink, ChevronDown, ChevronUp, Sparkles, ArrowRight, FileText, PartyPopper
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { calculateGoalProgress, DEFAULT_GOAL } from '@/lib/goal-tracker';
import { filterJobsByCycle } from '@/lib/cycle-utils';
import { sanitizeUrl } from '@/lib/utils';
import GoalCustomizationModal from './GoalCustomizationModal';

const STATUS_BADGE_STYLES = {
    applied: { label: 'Applied', bg: 'rgba(107, 126, 103, 0.16)', border: 'rgba(107, 126, 103, 0.4)', color: 'var(--accent-primary)' },
    screening: { label: 'Initial Screening', bg: 'rgba(14, 165, 233, 0.15)', border: 'rgba(14, 165, 233, 0.4)', color: '#0ea5e9' },
    interviewing: { label: 'Interviewing', bg: 'rgba(209, 138, 60, 0.16)', border: 'rgba(209, 138, 60, 0.4)', color: 'var(--warning)' },
    offer: { label: 'Offer', bg: 'rgba(78, 135, 82, 0.18)', border: 'rgba(78, 135, 82, 0.45)', color: 'var(--success)' },
    rejected: { label: 'Rejected', bg: 'rgba(196, 90, 79, 0.14)', border: 'rgba(196, 90, 79, 0.35)', color: 'var(--error)' }
};

function formatRoleTimestamp(isoString, isAppliedToday) {
    if (!isoString) return 'Recently';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently';
    if (isAppliedToday) {
        return `Today • ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function GoalTrackerWidget({ jobs: propJobs }) {
    const rawJobs = useAppStore(state => state.jobs);
    const cycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const jobSearchMode = useAppStore(state => state.jobSearchMode);
    const setJobSearchMode = useAppStore(state => state.setJobSearchMode);
    const jobs = useMemo(() => {
        if (propJobs) return propJobs;
        return filterJobsByCycle(rawJobs, cycles, selectedCycleId);
    }, [propJobs, rawJobs, cycles, selectedCycleId]);
    const profile = useAppStore(state => state.profile);
    const triggerGoalCelebration = useUIStore(state => state.triggerGoalCelebration);
    const openNewJobModal = useUIStore(state => state.openNewJobModal);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showRolesPanel, setShowRolesPanel] = useState(true);
    const [activeFilter, setActiveFilter] = useState('today'); // 'today' | 'cycle'

    const goal = profile?.applicationGoal || DEFAULT_GOAL;
    const progress = calculateGoalProgress(jobs, goal);

    const paceColors = {
        completed: { bg: 'rgba(82, 150, 97, 0.15)', border: 'rgba(82, 150, 97, 0.4)', text: 'var(--success)', icon: CheckCircle2 },
        on_track: { bg: 'rgba(94, 135, 110, 0.15)', border: 'rgba(94, 135, 110, 0.4)', text: 'var(--accent-primary)', icon: TrendingUp },
        behind: { bg: 'rgba(212, 163, 115, 0.15)', border: 'rgba(212, 163, 115, 0.4)', text: 'var(--warning)', icon: AlertCircle }
    };

    const currentPaceStyle = paceColors[progress.pace] || paceColors.on_track;
    const PaceIcon = currentPaceStyle.icon;

    const cycleLabelMap = {
        daily: 'Today',
        weekly: 'This Week',
        monthly: 'This Month',
        total: 'Milestone Total'
    };
    const cycleLabel = cycleLabelMap[progress.cadence] || 'Current Cycle';

    // Determine which list of roles to display based on the selected tab
    const effectiveFilter = progress.cadence === 'daily' ? 'today' : activeFilter;
    const displayedJobs = effectiveFilter === 'today' ? (progress.todayJobs || []) : (progress.cycleJobs || []);

    return (
        <>
            <div className="card goal-tracker-card" style={{
                padding: '20px',
                marginTop: '20px',
                marginBottom: '20px',
                position: 'relative',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
            }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(107, 126, 103, 0.25), rgba(250, 248, 244, 0.06))',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Target size={20} color="var(--accent-primary)" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Application Output Goal</h3>
                                <span style={{
                                    fontSize: '0.72rem',
                                    textTransform: 'uppercase',
                                    fontWeight: 'bold',
                                    letterSpacing: '0.05em',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: 'var(--glass-highlight)',
                                    color: 'var(--text-secondary)'
                                }}>
                                    {progress.cadence}
                                </span>
                                <span
                                    onClick={progress.todayCount >= 5 ? triggerGoalCelebration : undefined}
                                    style={{
                                        fontSize: '0.74rem',
                                        fontWeight: '700',
                                        padding: '2px 9px',
                                        borderRadius: '999px',
                                        background: progress.todayCount >= 5
                                            ? 'rgba(212, 163, 115, 0.25)'
                                            : (progress.todayCount > 0 ? 'rgba(78, 135, 82, 0.16)' : 'var(--glass-highlight)'),
                                        border: progress.todayCount >= 5
                                            ? '1px solid rgba(212, 163, 115, 0.6)'
                                            : (progress.todayCount > 0 ? '1px solid rgba(78, 135, 82, 0.4)' : '1px solid var(--border-subtle)'),
                                        color: progress.todayCount >= 5
                                            ? 'var(--warning)'
                                            : (progress.todayCount > 0 ? 'var(--success)' : 'var(--text-secondary)'),
                                        cursor: progress.todayCount >= 5 ? 'pointer' : 'default'
                                    }}
                                    title={progress.todayCount >= 5 ? '5 Applications Daily Goal Achieved! Click to celebrate 🎉' : undefined}
                                >
                                    {progress.todayCount >= 5 ? `🎉 ${progress.todayCount} Applied Today (Goal Hit!)` : `${progress.todayCount} Applied Today`}
                                </span>
                                {jobSearchMode === false && (
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.74rem',
                                        fontWeight: '600',
                                        padding: '2px 9px',
                                        borderRadius: '999px',
                                        background: 'rgba(148, 163, 184, 0.16)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        <span>Standby Mode</span>
                                        <button
                                            type="button"
                                            onClick={() => setJobSearchMode(true)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                padding: 0,
                                                color: 'var(--accent-primary)',
                                                fontWeight: '700',
                                                fontSize: '0.74rem',
                                                cursor: 'pointer',
                                                textDecoration: 'underline'
                                            }}
                                        >
                                            Reactivate
                                        </button>
                                    </span>
                                )}
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {goal.targetRole ? `Focus: ${goal.targetRole} • ` : ''}
                                {progress.cycleTimeRemaining}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {/* Pace Badge / Celebrate Trigger */}
                        <div
                            onClick={(progress.percentage >= 100 || progress.todayCount >= 5) ? triggerGoalCelebration : undefined}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                background: (progress.todayCount >= 5 || progress.percentage >= 100) ? 'rgba(212, 163, 115, 0.2)' : currentPaceStyle.bg,
                                border: (progress.todayCount >= 5 || progress.percentage >= 100) ? '1px solid rgba(212, 163, 115, 0.5)' : `1px solid ${currentPaceStyle.border}`,
                                color: (progress.todayCount >= 5 || progress.percentage >= 100) ? 'var(--warning)' : currentPaceStyle.text,
                                fontSize: '0.78rem',
                                fontWeight: 'bold',
                                cursor: (progress.percentage >= 100 || progress.todayCount >= 5) ? 'pointer' : 'default',
                                transition: 'transform 0.15s ease'
                            }}
                            title={(progress.percentage >= 100 || progress.todayCount >= 5) ? 'Click to celebrate goal with full-screen confetti!' : undefined}
                        >
                            <PaceIcon size={14} />
                            <span>
                                {progress.todayCount >= 5
                                    ? 'Daily Goal Hit 🎉'
                                    : (progress.pace === 'completed' ? 'Goal Reached 🎉' : progress.pace === 'on_track' ? 'On Track 🚀' : 'Behind Pace ⏳')}
                            </span>
                        </div>

                        {(progress.percentage >= 100 || progress.todayCount >= 5) && (
                            <button
                                type="button"
                                onClick={triggerGoalCelebration}
                                className="btn-primary"
                                style={{
                                    fontSize: '0.78rem',
                                    padding: '5px 11px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #4A7C55 0%, #D4A373 100%)',
                                    boxShadow: '0 4px 14px rgba(212, 163, 115, 0.35)'
                                }}
                                title="Trigger full-screen confetti and celebration!"
                            >
                                <PartyPopper size={13} /> {progress.todayCount >= 5 && progress.percentage < 100 ? 'Celebrate Daily Goal 🎉' : 'Celebrate Goal 🎉'}
                            </button>
                        )}

                        {/* Customize button */}
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="btn-secondary"
                            style={{
                                fontSize: '0.8rem',
                                padding: '6px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            title="Customize your application target number and cadence"
                        >
                            <Sliders size={14} /> Customize Goal
                        </button>
                    </div>
                </div>

                {/* Progress Stats & Bar */}
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                {progress.count}
                            </span>
                            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                                / {progress.target} applications ({cycleLabel.toLowerCase()})
                            </span>
                        </div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: progress.percentage >= 100 ? 'var(--success)' : 'var(--accent-primary)' }}>
                            {progress.percentage}%
                        </span>
                    </div>

                    {/* Glowing Progress bar */}
                    <div style={{
                        width: '100%',
                        height: '12px',
                        borderRadius: '6px',
                        background: 'rgba(128, 128, 128, 0.14)',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <div style={{
                            width: `${progress.percentage}%`,
                            height: '100%',
                            background: progress.percentage >= 100
                                ? 'linear-gradient(90deg, var(--success), #3e734a)'
                                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                            borderRadius: '6px',
                            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: progress.percentage > 0 ? '0 0 12px rgba(94, 135, 110, 0.45)' : 'none'
                        }} />
                    </div>
                </div>

                {/* Footer Insight message */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginBottom: '14px'
                }}>
                    <span>{progress.paceMessage}</span>
                    {progress.remaining > 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                                {progress.remaining} application{progress.remaining > 1 ? 's' : ''} left to reach {progress.target}
                            </span>
                            {progress.todayCount >= 5 && (
                                <button
                                    type="button"
                                    onClick={triggerGoalCelebration}
                                    style={{
                                        background: 'rgba(212, 163, 115, 0.2)',
                                        border: '1px solid rgba(212, 163, 115, 0.5)',
                                        borderRadius: '6px',
                                        color: 'var(--warning)',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    title="5 Applications Daily Goal Achieved! Click to celebrate"
                                >
                                    <PartyPopper size={12} /> 5 Today Confetti 🎉
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.78rem' }}>
                                Target achieved for this cycle! Keep going!
                            </span>
                            <button
                                type="button"
                                onClick={triggerGoalCelebration}
                                style={{
                                    background: 'rgba(95, 130, 99, 0.18)',
                                    border: '1px solid var(--success)',
                                    borderRadius: '6px',
                                    color: 'var(--success)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                                title="Show confetti and celebration"
                            >
                                <PartyPopper size={12} /> Confetti 🎉
                            </button>
                        </div>
                    )}
                </div>

                {/* Applied Today & Goal Breakdown Section */}
                <div style={{
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '14px'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        marginBottom: showRolesPanel ? '12px' : 0
                    }}>
                        {/* Segmented Switcher: Applied Today vs Goal Cycle Roles */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px',
                            borderRadius: '10px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            maxWidth: '100%',
                            overflowX: 'auto'
                        }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveFilter('today');
                                    setShowRolesPanel(true);
                                }}
                                style={{
                                    padding: '5px 11px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: effectiveFilter === 'today' ? 700 : 500,
                                    background: effectiveFilter === 'today' ? 'var(--accent-primary)' : 'transparent',
                                    color: effectiveFilter === 'today' ? '#ffffff' : 'var(--text-secondary)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Calendar size={13} />
                                Applied Today ({progress.todayCount})
                            </button>

                            {progress.cadence !== 'daily' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveFilter('cycle');
                                        setShowRolesPanel(true);
                                    }}
                                    style={{
                                        padding: '5px 11px',
                                        borderRadius: '7px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '0.78rem',
                                        fontWeight: effectiveFilter === 'cycle' ? 700 : 500,
                                        background: effectiveFilter === 'cycle' ? 'var(--accent-primary)' : 'transparent',
                                        color: effectiveFilter === 'cycle' ? '#ffffff' : 'var(--text-secondary)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <Briefcase size={13} />
                                    {cycleLabel} Goal Roles ({progress.count}/{progress.target})
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Link
                                href="/kanban"
                                style={{
                                    fontSize: '0.78rem',
                                    color: 'var(--accent-primary)',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                Open Board <ArrowRight size={13} />
                            </Link>
                            <button
                                type="button"
                                onClick={() => setShowRolesPanel(prev => !prev)}
                                style={{
                                    background: 'var(--glass-highlight)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    color: 'var(--text-secondary)',
                                    padding: '4px 9px',
                                    fontSize: '0.76rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                                aria-expanded={showRolesPanel}
                            >
                                {showRolesPanel ? (
                                    <>Hide Roles <ChevronUp size={14} /></>
                                ) : (
                                    <>Show Roles <ChevronDown size={14} /></>
                                )}
                            </button>
                        </div>
                    </div>

                    {showRolesPanel && (
                        <div>
                            {displayedJobs.length === 0 ? (
                                <div style={{
                                    padding: '16px',
                                    borderRadius: '10px',
                                    background: 'var(--bg-card)',
                                    border: '1px dashed var(--border-subtle)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Sparkles size={18} color="var(--accent-primary)" />
                                        <div>
                                            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {effectiveFilter === 'today'
                                                    ? 'No applications logged today yet'
                                                    : `No applications logged for ${cycleLabel.toLowerCase()} yet`}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                {effectiveFilter === 'today' && progress.count > 0 && progress.cadence !== 'daily'
                                                    ? `You have ${progress.count} of ${progress.target} applications logged ${cycleLabel.toLowerCase()}. Add a role today to keep your momentum!`
                                                    : `Add a role on your Kanban board or from AI Recommendations to advance toward your ${progress.target} ${progress.cadence} goal.`}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {effectiveFilter === 'today' && progress.count > 0 && progress.cadence !== 'daily' && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveFilter('cycle')}
                                                className="btn-secondary"
                                                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                                            >
                                                View {progress.count} {cycleLabel} Role{progress.count > 1 ? 's' : ''}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={openNewJobModal}
                                            className="btn-primary"
                                            style={{ fontSize: '0.78rem', padding: '6px 12px', cursor: 'pointer', border: 'none' }}
                                        >
                                            + Log Application
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))',
                                    gap: '10px',
                                    maxHeight: '260px',
                                    overflowY: 'auto',
                                    paddingRight: '2px'
                                }}>
                                    {displayedJobs.map((job, idx) => {
                                        const roleTitle = job.role || job.title || 'Untitled Role';
                                        const companyName = job.company || 'Unknown Company';
                                        const statusInfo = STATUS_BADGE_STYLES[job.status] || STATUS_BADGE_STYLES.applied;
                                        const safeHref = sanitizeUrl(job.url || job.link);
                                        const safeResumeHref = sanitizeUrl(job.resumeUrl);
                                        // Reverse index so newest shows its chronological contribution number toward the goal
                                        const contributionNum = displayedJobs.length - idx;

                                        return (
                                            <div
                                                key={job.id || `${companyName}-${idx}`}
                                                style={{
                                                    padding: '11px 13px',
                                                    borderRadius: '10px',
                                                    background: 'var(--bg-card)',
                                                    border: job.isAppliedToday
                                                        ? '1px solid rgba(107, 126, 103, 0.45)'
                                                        : '1px solid var(--border-subtle)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    gap: '8px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{
                                                            fontSize: '0.88rem',
                                                            fontWeight: 700,
                                                            color: 'var(--text-primary)',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }} title={roleTitle}>
                                                            {roleTitle}
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.78rem',
                                                            color: 'var(--text-secondary)',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            marginTop: '1px'
                                                        }} title={companyName}>
                                                            {companyName}
                                                        </div>
                                                    </div>

                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        padding: '2px 7px',
                                                        borderRadius: '999px',
                                                        background: statusInfo.bg,
                                                        border: `1px solid ${statusInfo.border}`,
                                                        color: statusInfo.color,
                                                        whiteSpace: 'nowrap',
                                                        flexShrink: 0
                                                    }}>
                                                        {statusInfo.label}
                                                    </span>
                                                </div>

                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    fontSize: '0.72rem',
                                                    color: 'var(--text-secondary)',
                                                    borderTop: '1px solid var(--border-subtle)',
                                                    paddingTop: '6px',
                                                    gap: '6px',
                                                    flexWrap: 'wrap'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            fontWeight: 700,
                                                            color: 'var(--accent-primary)',
                                                            background: 'rgba(107, 126, 103, 0.14)',
                                                            padding: '1px 6px',
                                                            borderRadius: '4px'
                                                        }}>
                                                            #{contributionNum} of {progress.target}
                                                        </span>
                                                        <span>{formatRoleTimestamp(job.parsedDate, job.isAppliedToday)}</span>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {safeResumeHref && (
                                                            <a
                                                                href={safeResumeHref}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    color: 'var(--accent-primary)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px',
                                                                    textDecoration: 'none',
                                                                    fontWeight: 600
                                                                }}
                                                                title={job.resumeName ? `Resume: ${job.resumeName}` : 'Open resume used'}
                                                            >
                                                                <FileText size={11} /> Resume
                                                            </a>
                                                        )}
                                                        {safeHref && (
                                                            <a
                                                                href={safeHref}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    color: 'var(--accent-primary)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px',
                                                                    textDecoration: 'none',
                                                                    fontWeight: 600
                                                                }}
                                                                title="Open job posting"
                                                            >
                                                                Job <ExternalLink size={11} />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <GoalCustomizationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}

