"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Target, X, Check, CheckCircle2, Sliders, Minus, Plus, Briefcase, PartyPopper } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { CADENCE_OPTIONS, DEFAULT_GOAL, calculateGoalProgress } from '@/lib/goal-tracker';
import { filterJobsByCycle } from '@/lib/cycle-utils';

export default function GoalCustomizationModal({ isOpen, onClose }) {
    if (!isOpen || typeof document === 'undefined') return null;
    return createPortal(<GoalFormModalBody onClose={onClose} />, document.body);
}

function GoalFormModalBody({ onClose }) {
    const profile = useAppStore(state => state.profile);
    const rawJobs = useAppStore(state => state.jobs);
    const cycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const jobs = useMemo(() => filterJobsByCycle(rawJobs, cycles, selectedCycleId), [rawJobs, cycles, selectedCycleId]);
    const updateProfile = useAppStore(state => state.updateProfile);
    const triggerGoalCelebration = useUIStore(state => state.triggerGoalCelebration);

    const currentGoal = profile?.applicationGoal || DEFAULT_GOAL;

    const [target, setTarget] = useState(currentGoal.target || 10);
    const [cadence, setCadence] = useState(currentGoal.cadence || 'weekly');
    const [targetRole, setTargetRole] = useState(currentGoal.targetRole || profile?.targetRole || '');
    const [hoursPerWeek, setHoursPerWeek] = useState(currentGoal.hoursPerWeek || 5);
    const [reminderEnabled, setReminderEnabled] = useState(currentGoal.reminderEnabled !== false);
    const [saving, setSaving] = useState(false);
    const [savedNotice, setSavedNotice] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const liveProgress = calculateGoalProgress(jobs, {
        ...currentGoal,
        target: Math.max(1, parseInt(target, 10) || 10),
        cadence
    });

    const handlePresetTarget = (num) => {
        setTarget(num);
    };

    const handleIncrement = () => {
        setTarget(prev => Math.min(1000, (parseInt(prev, 10) || 0) + 1));
    };

    const handleDecrement = () => {
        setTarget(prev => Math.max(1, (parseInt(prev, 10) || 1) - 1));
    };

    const handleSave = async (e) => {
        e?.preventDefault();
        if (saving) return;
        setSaving(true);
        const updatedGoal = {
            target: Math.max(1, parseInt(target, 10) || 10),
            cadence,
            targetRole: (targetRole || '').trim(),
            hoursPerWeek: Math.max(1, parseInt(hoursPerWeek, 10) || 5),
            reminderEnabled,
            enabled: true,
            updatedAt: new Date().toISOString()
        };

        await updateProfile({ applicationGoal: updatedGoal });
        setSaving(false);
        setSavedNotice(true);
        setTimeout(() => {
            onClose();
        }, 420);
    };

    const numTarget = Math.max(1, parseInt(target, 10) || 1);
    const numHours = Math.max(1, parseInt(hoursPerWeek, 10) || 1);
    const hoursPerApp = Math.round((numHours / numTarget) * 10) / 10;

    const mouseDownTargetRef = useRef(null);

    const handleBackdropMouseDown = (e) => {
        mouseDownTargetRef.current = e.target;
    };

    const handleBackdropClick = (e) => {
        if (mouseDownTargetRef.current === e.currentTarget && e.target === e.currentTarget) {
            onClose();
        }
        mouseDownTargetRef.current = null;
    };

    return (
        <div
            onMouseDown={handleBackdropMouseDown}
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(12, 15, 18, 0.78)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="goal-modal-heading"
                className="card animate-scale-up goal-modal-card"
                style={{
                    width: '100%',
                    maxWidth: '660px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    position: 'relative',
                    padding: '28px 30px',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--accent-primary)',
                    boxShadow: '0 28px 60px -12px rgba(0, 0, 0, 0.65)',
                    boxSizing: 'border-box',
                    borderRadius: '18px'
                }}
            >
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '18px',
                        right: '18px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '50%',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        width: '34px',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                    }}
                    aria-label="Close"
                    title="Close"
                >
                    <X size={18} />
                </button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', paddingRight: '40px' }}>
                    <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: 'rgba(107, 126, 103, 0.18)',
                        border: '1px solid rgba(107, 126, 103, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Target size={24} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <h3 id="goal-modal-heading" style={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.2, color: 'var(--text-primary)' }}>
                            Application Goal &amp; Cadence
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: '4px' }}>
                            Configure your target application pace, track today&apos;s output, and stay accountable.
                        </p>
                    </div>
                </div>

                {/* Live Current Cycle Progress Summary Bar */}
                <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                Current {cadence} Progress:
                            </span>
                            <span style={{
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                color: liveProgress.percentage >= 100 ? 'var(--success)' : 'var(--accent-primary)'
                            }}>
                                {liveProgress.count} / {numTarget} applications ({liveProgress.percentage}%)
                            </span>
                            {(liveProgress.percentage >= 100 || liveProgress.todayCount >= 5) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        triggerGoalCelebration();
                                    }}
                                    style={{
                                        background: 'rgba(95, 130, 99, 0.2)',
                                        border: '1px solid var(--success)',
                                        borderRadius: '999px',
                                        color: 'var(--success)',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    title="Celebrate goal with full-screen confetti!"
                                >
                                    <PartyPopper size={12} /> {liveProgress.todayCount >= 5 && liveProgress.percentage < 100 ? 'Celebrate 5 Today 🎉' : 'Celebrate 🎉'}
                                </button>
                            )}
                        </div>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '999px',
                            background: liveProgress.todayCount > 0 ? 'rgba(78, 135, 82, 0.16)' : 'var(--bg-card)',
                            border: liveProgress.todayCount > 0 ? '1px solid rgba(78, 135, 82, 0.4)' : '1px solid var(--border-subtle)',
                            color: liveProgress.todayCount > 0 ? 'var(--success)' : 'var(--text-secondary)'
                        }}>
                            <Briefcase size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                            {liveProgress.todayCount} Applied Today
                        </span>
                    </div>
                    <div style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '999px',
                        background: 'var(--bg-card)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${Math.min(100, liveProgress.percentage)}%`,
                            height: '100%',
                            borderRadius: '999px',
                            background: liveProgress.percentage >= 100
                                ? 'linear-gradient(90deg, #4E8752, #6BA368)'
                                : 'var(--accent-gradient)',
                            transition: 'width 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
                        }} />
                    </div>
                    {liveProgress.todayJobs && liveProgress.todayJobs.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '2px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                Today&apos;s roles:
                            </span>
                            {liveProgress.todayJobs.slice(0, 5).map((job, idx) => (
                                <span
                                    key={job.id || idx}
                                    style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    {job.role || job.title || 'Role'} · <span style={{ color: 'var(--text-secondary)' }}>{job.company}</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px' }}>
                    {/* 1. Cadence Selection (2x2 Grid on Desktop) */}
                    <div>
                        <label style={{ fontSize: '0.86rem', fontWeight: 700, display: 'block', marginBottom: '10px', color: 'var(--text-primary)' }}>
                            1. Select Cadence
                        </label>
                        <div
                            className="goal-cadence-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: '10px'
                            }}
                        >
                            {CADENCE_OPTIONS.map(opt => {
                                const selected = cadence === opt.value;
                                return (
                                    <div
                                        key={opt.value}
                                        onClick={() => {
                                            setCadence(opt.value);
                                            if (target === 10 || target === 40 || target === 3 || target === 100) {
                                                setTarget(opt.defaultTarget);
                                            }
                                        }}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            background: selected ? 'rgba(94, 135, 110, 0.14)' : 'var(--bg-panel)',
                                            transition: 'all 0.2s ease',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: selected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                                {opt.label}
                                            </span>
                                            {selected && <CheckCircle2 size={16} color="var(--accent-primary)" />}
                                        </div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35 }}>
                                            {opt.helper}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Target Number Input & Quick Presets */}
                    <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px'
                    }}>
                        <div>
                            <label style={{ fontSize: '0.88rem', fontWeight: 700, display: 'block', color: 'var(--text-primary)' }}>
                                2. Target Applications ({cadence})
                            </label>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '2px' }}>
                                    Quick presets:
                                </span>
                                {[3, 5, 10, 15, 25, 50].map(val => {
                                    const isCurrent = Number(target) === val;
                                    return (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => handlePresetTarget(val)}
                                            style={{
                                                padding: '4px 11px',
                                                borderRadius: '999px',
                                                fontSize: '0.76rem',
                                                fontWeight: isCurrent ? 700 : 500,
                                                background: isCurrent ? 'var(--accent-primary)' : 'var(--bg-card)',
                                                color: isCurrent ? 'white' : 'var(--text-primary)',
                                                border: isCurrent ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {val}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Stepper */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={handleDecrement}
                                aria-label="Decrease target"
                                title="Decrease target"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <Minus size={16} />
                            </button>
                            <input
                                type="number"
                                min="1"
                                max="1000"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="input-field"
                                style={{
                                    fontSize: '1.2rem',
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    width: '92px',
                                    height: '40px',
                                    boxSizing: 'border-box',
                                    background: 'var(--bg-card)'
                                }}
                                required
                            />
                            <button
                                type="button"
                                onClick={handleIncrement}
                                aria-label="Increase target"
                                title="Increase target"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* 3. Cadence Strategy & Accountability Questions (2-Column Grid) */}
                    <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        display: 'grid',
                        gap: '14px'
                    }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                            <Sliders size={15} color="var(--accent-primary)" /> 3. Accountability &amp; Focus
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '14px'
                        }}>
                            <div>
                                <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Primary target role for this goal
                                </label>
                                <input
                                    type="text"
                                    value={targetRole}
                                    onChange={(e) => setTargetRole(e.target.value)}
                                    placeholder="e.g. Co-Founder / Head of Growth"
                                    className="input-field"
                                    style={{ fontSize: '0.85rem', background: 'var(--bg-card)' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                                    Weekly prep &amp; application hours (~{hoursPerApp}h/app)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="168"
                                    value={hoursPerWeek}
                                    onChange={(e) => setHoursPerWeek(e.target.value)}
                                    className="input-field"
                                    style={{ fontSize: '0.85rem', background: 'var(--bg-card)' }}
                                />
                            </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            <input
                                type="checkbox"
                                checked={reminderEnabled}
                                onChange={(e) => setReminderEnabled(e.target.checked)}
                                style={{ width: '16px', height: '16px' }}
                            />
                            <span>Include goal pacing in Morning Career Radar briefing</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="goal-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                            style={{ fontSize: '0.88rem', padding: '10px 20px', minHeight: '42px' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ fontSize: '0.88rem', padding: '10px 26px', minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            {savedNotice ? (
                                <>
                                    <Check size={16} /> Saved!
                                </>
                            ) : (
                                <>
                                    <Check size={16} /> Save Goal Settings
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
