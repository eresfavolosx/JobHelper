"use client";
import React, { useState } from 'react';
import { Target, X, Check, CheckCircle2, Sliders } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { CADENCE_OPTIONS, DEFAULT_GOAL } from '@/lib/goal-tracker';

export default function GoalCustomizationModal({ isOpen, onClose }) {
    if (!isOpen) return null;
    return <GoalFormModalBody onClose={onClose} />;
}

function GoalFormModalBody({ onClose }) {
    const profile = useAppStore(state => state.profile);
    const updateProfile = useAppStore(state => state.updateProfile);

    const currentGoal = profile?.applicationGoal || DEFAULT_GOAL;

    const [target, setTarget] = useState(currentGoal.target || 10);
    const [cadence, setCadence] = useState(currentGoal.cadence || 'weekly');
    const [targetRole, setTargetRole] = useState(currentGoal.targetRole || profile?.targetRole || '');
    const [hoursPerWeek, setHoursPerWeek] = useState(currentGoal.hoursPerWeek || 5);
    const [reminderEnabled, setReminderEnabled] = useState(currentGoal.reminderEnabled !== false);
    const [savedNotice, setSavedNotice] = useState(false);

    const handlePresetTarget = (num) => {
        setTarget(num);
    };

    const handleSave = (e) => {
        e?.preventDefault();
        const updatedGoal = {
            target: Math.max(1, parseInt(target, 10) || 10),
            cadence,
            targetRole: targetRole.trim(),
            hoursPerWeek: Math.max(1, parseInt(hoursPerWeek, 10) || 5),
            reminderEnabled,
            enabled: true,
            updatedAt: new Date().toISOString()
        };

        updateProfile({ applicationGoal: updatedGoal });
        setSavedNotice(true);
        setTimeout(() => {
            onClose();
        }, 600);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }}>
            <div className="card animate-scale-up" style={{
                width: '100%',
                maxWidth: '560px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '28px',
                position: 'relative',
                border: '1px solid var(--accent-primary)',
                boxShadow: '0 25px 50px -12px rgba(56, 189, 248, 0.25)'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(118, 133, 142, 0.22), rgba(250, 248, 244, 0.08))',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Target size={22} color="var(--accent-secondary)" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
                            Application Goal & Cadence
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            Set your target output pace to stay accountable and track momentum.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSave} style={{ display: 'grid', gap: '20px', marginTop: '16px' }}>
                    {/* 1. Cadence Selection */}
                    <div>
                        <label style={{ fontSize: '0.88rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                            1. Select Cadence
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            {CADENCE_OPTIONS.map(opt => {
                                const selected = cadence === opt.value;
                                return (
                                    <div
                                        key={opt.value}
                                        onClick={() => {
                                            setCadence(opt.value);
                                            // Set default target if currently default
                                            if (target === 10 || target === 40 || target === 3 || target === 100) {
                                                setTarget(opt.defaultTarget);
                                            }
                                        }}
                                        style={{
                                            padding: '12px 14px',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            background: selected ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-panel)',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '0.92rem', color: selected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                                {opt.label}
                                            </span>
                                            {selected && <CheckCircle2 size={16} color="var(--accent-primary)" />}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                            {opt.helper}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Target Number Input & Quick Presets */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.88rem', fontWeight: 'bold' }}>
                                2. Target Applications ({cadence})
                            </label>
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                                {target} applications
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                            <input
                                type="number"
                                min="1"
                                max="1000"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="input-field"
                                style={{ fontSize: '1.2rem', fontWeight: 'bold', width: '120px' }}
                                required
                            />
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {[3, 5, 10, 15, 25, 50].map(val => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => handlePresetTarget(val)}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            background: target == val ? 'var(--accent-primary)' : 'var(--glass-highlight)',
                                            color: target == val ? 'white' : 'var(--text-primary)',
                                            border: '1px solid var(--border-subtle)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 3. Cadence Strategy Questions */}
                    <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        display: 'grid',
                        gap: '12px'
                    }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sliders size={15} color="var(--accent-primary)" /> Accountability Questions
                        </div>

                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                Primary target role for this goal:
                            </label>
                            <input
                                type="text"
                                value={targetRole}
                                onChange={(e) => setTargetRole(e.target.value)}
                                placeholder="e.g. Senior Full Stack Engineer"
                                className="input-field"
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                                Hours per week dedicated to applying & prep:
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="number"
                                    min="1"
                                    max="80"
                                    value={hoursPerWeek}
                                    onChange={(e) => setHoursPerWeek(e.target.value)}
                                    className="input-field"
                                    style={{ width: '80px', fontSize: '0.9rem' }}
                                />
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    hours/week (~{Math.round((hoursPerWeek / Math.max(1, target)) * 10) / 10}h per application)
                                </span>
                            </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', marginTop: '4px' }}>
                            <input
                                type="checkbox"
                                checked={reminderEnabled}
                                onChange={(e) => setReminderEnabled(e.target.checked)}
                            />
                            <span>Include goal pacing in Morning Career Radar briefing</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                            style={{ fontSize: '0.88rem', padding: '9px 18px' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ fontSize: '0.88rem', padding: '9px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            {savedNotice ? (
                                <>
                                    <Check size={16} /> Saved!
                                </>
                            ) : (
                                <>
                                    <Check size={16} /> Save Goal
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
