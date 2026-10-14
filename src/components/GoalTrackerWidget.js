"use client";
import React, { useState } from 'react';
import { Target, Sliders, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { calculateGoalProgress, DEFAULT_GOAL } from '@/lib/goal-tracker';
import GoalCustomizationModal from './GoalCustomizationModal';

export default function GoalTrackerWidget() {
    const jobs = useAppStore(state => state.jobs);
    const profile = useAppStore(state => state.profile);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const goal = profile?.applicationGoal || DEFAULT_GOAL;
    const progress = calculateGoalProgress(jobs, goal);

    const paceColors = {
        completed: { bg: 'rgba(82, 150, 97, 0.15)', border: 'rgba(82, 150, 97, 0.4)', text: 'var(--success)', icon: CheckCircle2 },
        on_track: { bg: 'rgba(94, 135, 110, 0.15)', border: 'rgba(94, 135, 110, 0.4)', text: 'var(--accent-primary)', icon: TrendingUp },
        behind: { bg: 'rgba(212, 163, 115, 0.15)', border: 'rgba(212, 163, 115, 0.4)', text: 'var(--warning)', icon: AlertCircle }
    };

    const currentPaceStyle = paceColors[progress.pace] || paceColors.on_track;
    const PaceIcon = currentPaceStyle.icon;

    return (
        <>
            <div className="card" style={{
                padding: '24px',
                marginTop: '24px',
                marginBottom: '24px',
                position: 'relative',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)'
            }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(118, 133, 142, 0.25), rgba(250, 248, 244, 0.06))',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Target size={20} color="var(--accent-secondary)" />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {goal.targetRole ? `Focus: ${goal.targetRole} • ` : ''}
                                {progress.cycleTimeRemaining}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Pace Badge */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            background: currentPaceStyle.bg,
                            border: `1px solid ${currentPaceStyle.border}`,
                            color: currentPaceStyle.text,
                            fontSize: '0.78rem',
                            fontWeight: 'bold'
                        }}>
                            <PaceIcon size={14} />
                            <span>
                                {progress.pace === 'completed' ? 'Goal Reached 🎉' : progress.pace === 'on_track' ? 'On Track 🚀' : 'Behind Pace ⏳'}
                            </span>
                        </div>

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
                                / {progress.target} applications
                            </span>
                        </div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: progress.percentage >= 100 ? '#10b981' : 'var(--accent-primary)' }}>
                            {progress.percentage}%
                        </span>
                    </div>

                    {/* Glowing Progress bar */}
                    <div style={{
                        width: '100%',
                        height: '12px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
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
                    gap: '6px'
                }}>
                    <span>{progress.paceMessage}</span>
                    {progress.remaining > 0 ? (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            {progress.remaining} application{progress.remaining > 1 ? 's' : ''} to reach {progress.target}
                        </span>
                    ) : (
                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.78rem' }}>
                            Target achieved for this cycle! Keep going!
                        </span>
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
