"use client";

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { filterJobsByCycle, calculateCycleStats } from '@/lib/cycle-utils';
import { Award, CheckCircle2, Sparkles, X, ArrowRight, Layers, Zap, Building2, Briefcase, Calendar, TrendingUp } from 'lucide-react';

export default function OfferAcceptedCycleModal() {
    const celebration = useAppStore(state => state.offerCelebrationModal);
    const closeCelebration = useAppStore(state => state.closeOfferCelebrationModal);
    const setSelectedCycleId = useAppStore(state => state.setSelectedCycleId);
    const rawJobs = useAppStore(state => state.jobs);
    const cycles = useAppStore(state => state.cycles);

    const cycle = celebration?.cycle;
    const nextCycle = celebration?.nextCycle;
    const acceptedJob = celebration?.acceptedJob;

    const stats = useMemo(() => {
        if (!cycle) return null;
        const cycleJobs = filterJobsByCycle(rawJobs, cycles, cycle.id);
        return calculateCycleStats(cycle, cycleJobs);
    }, [cycle, rawJobs, cycles]);

    if (!celebration || !celebration.isOpen || !cycle) {
        return null;
    }

    const company = acceptedJob?.company || cycle.acceptedCompany || 'Company';
    const role = acceptedJob?.role || acceptedJob?.title || cycle.acceptedRole || 'Position';
    const salary = acceptedJob?.salary;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-cycle-title"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '16px'
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) closeCelebration();
            }}
        >
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '540px',
                    borderRadius: '16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-medium)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                    padding: '28px 24px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    overflow: 'hidden'
                }}
            >
                {/* Decorative celebratory top bar */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '6px',
                    background: 'linear-gradient(90deg, #22c55e, #3b82f6, #ec4899, #eab308)'
                }} />

                {/* Close Button */}
                <button
                    type="button"
                    onClick={closeCelebration}
                    aria-label="Close celebration modal"
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                        display: 'inline-flex'
                    }}
                >
                    <X size={18} />
                </button>

                {/* Header Icon & Title */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(59, 130, 246, 0.2))',
                        border: '2px solid #22c55e',
                        color: '#22c55e',
                        marginBottom: '4px'
                    }}>
                        <Award size={36} />
                    </div>

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#16a34a',
                        background: 'rgba(34, 197, 94, 0.12)',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <Sparkles size={12} />
                        <span>Search Cycle Completed!</span>
                    </div>

                    <h2
                        id="offer-cycle-title"
                        style={{
                            fontSize: '1.45rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            margin: 0,
                            lineHeight: 1.25
                        }}
                    >
                        Offer Accepted at {company}! 🎉
                    </h2>

                    <p style={{
                        fontSize: '0.92rem',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        maxWidth: '440px'
                    }}>
                        Congratulations on accepting the <strong>{role}</strong> offer{salary ? ` with compensation of ${salary}` : ''}! Your active search cycle has been gracefully closed with full conversion metrics preserved.
                    </p>
                </div>

                {/* Cycle Retrospective Metrics Card */}
                {stats && (
                    <div style={{
                        borderRadius: '12px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        padding: '16px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid var(--border-subtle)'
                        }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                {cycle.name || `Cycle ${cycle.cycleNumber}`} Performance
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {stats.durationDays} day search
                            </span>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ padding: '8px 4px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {stats.applied}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    Applications
                                </div>
                            </div>
                            <div style={{ padding: '8px 4px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                    {stats.screening + stats.interviewing + stats.offers}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    Interviews ({stats.interviewRate}%)
                                </div>
                            </div>
                            <div style={{ padding: '8px 4px', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>
                                    {stats.offers}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    Offers ({stats.offerRate}%)
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Next Cycle Notice */}
                {nextCycle && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        fontSize: '0.82rem',
                        color: 'var(--text-primary)'
                    }}>
                        <Zap size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span>
                            <strong>{nextCycle.name || `Cycle ${nextCycle.cycleNumber}`} (Active)</strong> has been initialized for you. All new opportunities will track under this fresh cycle.
                        </span>
                    </div>
                )}

                {/* Modal Action Buttons */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '4px'
                }}>
                    {nextCycle && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCycleId(nextCycle.id);
                                closeCelebration();
                            }}
                            className="btn-primary"
                            style={{
                                width: '100%',
                                padding: '10px 16px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                borderRadius: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            <Zap size={15} />
                            <span>Switch to Fresh {nextCycle.name || `Cycle ${nextCycle.cycleNumber}`}</span>
                        </button>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCycleId(cycle.id);
                                closeCelebration();
                            }}
                            className="btn-secondary"
                            style={{
                                padding: '9px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '0.82rem',
                                borderRadius: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
                            <span>View Closed Cycle</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCycleId('all');
                                closeCelebration();
                            }}
                            className="btn-secondary"
                            style={{
                                padding: '9px 12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '0.82rem',
                                borderRadius: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            <Layers size={14} />
                            <span>View All Cycles</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
