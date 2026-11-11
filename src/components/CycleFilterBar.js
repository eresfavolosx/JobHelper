"use client";

import { useState, useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import {
    resolveCyclesFromJobs,
    getActiveCycle,
    filterJobsByCycle,
    calculateCycleStats,
    detectSearchActivitySpikes
} from '@/lib/cycle-utils';
import {
    CheckCircle2,
    Zap,
    Plus,
    Layers,
    X,
    SlidersHorizontal,
    Briefcase,
    TrendingUp,
    History,
    Trash2,
    Power,
    Scissors
} from 'lucide-react';

const DISMISSED_SPIKES_KEY = 'novujobs_dismissed_spike_ids_v1';

function toInputDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export default function CycleFilterBar({ className = '', style = {} }) {
    const rawJobs = useAppStore(state => state.jobs);
    const storeCycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const jobSearchMode = useAppStore(state => state.jobSearchMode);
    const transitionLog = useAppStore(state => state.transitionLog);
    const setSelectedCycleId = useAppStore(state => state.setSelectedCycleId);
    const startNewCycle = useAppStore(state => state.startNewCycle);
    const splitCycleAtDate = useAppStore(state => state.splitCycleAtDate);
    const updateCyclePeriod = useAppStore(state => state.updateCyclePeriod);
    const setJobSearchMode = useAppStore(state => state.setJobSearchMode);
    const logJobLossAndStartSearch = useAppStore(state => state.logJobLossAndStartSearch);
    const deleteTransitionEvent = useAppStore(state => state.deleteTransitionEvent);

    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newCycleName, setNewCycleName] = useState('');
    const [showModeCyclePrompt, setShowModeCyclePrompt] = useState(false);

    // Drawer / Manager state: null | 'job_loss' | 'periods' | 'history'
    const [activePanel, setActivePanel] = useState(null);

    // Job loss / search start form
    const [lossDate, setLossDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [lossCompany, setLossCompany] = useState('');
    const [lossRole, setLossRole] = useState('');
    const [lossCycleName, setLossCycleName] = useState('');
    const [lossNote, setLossNote] = useState('');

    // Split / Edit Period form
    const [splitDateInput, setSplitDateInput] = useState('2026-10-02');
    const [splitNameInput, setSplitNameInput] = useState('');
    const [editingCycleId, setEditingCycleId] = useState('');
    const [editName, setEditName] = useState('');
    const [editStartDate, setEditStartDate] = useState('');
    const [editEndDate, setEditEndDate] = useState('');

    const [dismissedSpikeIds, setDismissedSpikeIds] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem(DISMISSED_SPIKES_KEY);
                if (raw) return new Set(JSON.parse(raw));
            } catch { /* ignore */ }
        }
        return new Set();
    });

    const inputRef = useRef(null);

    const cycles = useMemo(() => {
        return resolveCyclesFromJobs(rawJobs, storeCycles);
    }, [rawJobs, storeCycles]);

    const activeCycle = useMemo(() => getActiveCycle(cycles), [cycles]);

    // Automatically detect activity spikes following dormancy gaps
    const detectedSpikes = useMemo(() => {
        const spikes = detectSearchActivitySpikes(rawJobs, cycles);
        return spikes.filter(s => !dismissedSpikeIds.has(s.id));
    }, [rawJobs, cycles, dismissedSpikeIds]);

    const topSpike = detectedSpikes[0] || null;

    // Compute job counts per cycle for badges
    const cycleCounts = useMemo(() => {
        const counts = { all: (rawJobs || []).filter(j => j && j.status !== 'deleted').length };
        for (const cycle of cycles) {
            const filtered = filterJobsByCycle(rawJobs, cycles, cycle.id);
            counts[cycle.id] = filtered.length;
        }
        return counts;
    }, [rawJobs, cycles]);

    const handleCreateNewCycle = (e) => {
        e.preventDefault();
        const trimmed = newCycleName.trim();
        const nextNum = (activeCycle?.cycleNumber || cycles.length || 0) + 1;
        const name = trimmed || `Search Cycle ${nextNum}`;
        startNewCycle(name);
        setNewCycleName('');
        setIsCreatingNew(false);
        setShowModeCyclePrompt(false);
    };

    const handleDismissSpike = (spikeId) => {
        const next = new Set(dismissedSpikeIds).add(spikeId);
        setDismissedSpikeIds(next);
        try {
            localStorage.setItem(DISMISSED_SPIKES_KEY, JSON.stringify(Array.from(next)));
        } catch { /* ignore */ }
    };

    const handleApplySpikeSplit = (spike) => {
        if (!spike) return;
        splitCycleAtDate(spike.suggestedStartDate, {
            name: `Search (${spike.dayLabel})`,
            triggerType: 'activity_spike',
            notes: spike.reason
        });
        handleDismissSpike(spike.id);
    };

    const handleToggleJobSearchMode = () => {
        const nextMode = !jobSearchMode;
        setJobSearchMode(nextMode);
        if (nextMode) {
            setShowModeCyclePrompt(true);
        } else {
            setShowModeCyclePrompt(false);
        }
    };

    const handleOpenPanel = (tab) => {
        if (activePanel === tab) {
            setActivePanel(null);
            return;
        }
        if (tab === 'periods' && cycles.length > 0) {
            const target = (selectedCycleId && selectedCycleId !== 'all' && selectedCycleId !== 'active'
                ? cycles.find(c => c.id === selectedCycleId)
                : activeCycle) || cycles[cycles.length - 1];
            if (target) {
                setEditingCycleId(target.id);
                setEditName(target.name || '');
                setEditStartDate(toInputDate(target.startedAt));
                setEditEndDate(toInputDate(target.endedAt));
            }
            if (topSpike) {
                setSplitDateInput(topSpike.dayStr);
                setSplitNameInput(`Search (${topSpike.dayLabel})`);
            }
        }
        setActivePanel(tab);
    };

    const handleSelectCycleToEdit = (cId) => {
        setEditingCycleId(cId);
        const target = cycles.find(c => c.id === cId);
        if (target) {
            setEditName(target.name || '');
            setEditStartDate(toInputDate(target.startedAt));
            setEditEndDate(toInputDate(target.endedAt));
        }
    };

    const handleSaveEditedPeriod = (e) => {
        e.preventDefault();
        if (!editingCycleId) return;
        updateCyclePeriod(editingCycleId, {
            name: editName.trim() || undefined,
            startedAt: editStartDate || undefined,
            endedAt: editEndDate || null
        });
        setActivePanel(null);
    };

    const handleManualSplitSubmit = (e) => {
        e.preventDefault();
        if (!splitDateInput) return;
        splitCycleAtDate(splitDateInput, {
            name: splitNameInput.trim() || undefined,
            triggerType: 'manual',
            notes: `Manually split cycle starting ${splitDateInput}`
        });
        setSplitNameInput('');
        setActivePanel(null);
    };

    const handleLogJobLossSubmit = (e) => {
        e.preventDefault();
        logJobLossAndStartSearch({
            date: lossDate,
            company: lossCompany,
            role: lossRole,
            cycleName: lossCycleName,
            note: lossNote
        });
        setLossCompany('');
        setLossRole('');
        setLossCycleName('');
        setLossNote('');
        setShowModeCyclePrompt(false);
        setActivePanel(null);
    };

    if (!cycles || cycles.length === 0) return null;

    // Current selected cycle object
    const currentCycleObj = selectedCycleId === 'all'
        ? null
        : (selectedCycleId === 'active' ? activeCycle : (cycles.find(c => c.id === selectedCycleId) || activeCycle));

    const currentStats = currentCycleObj ? calculateCycleStats(currentCycleObj, filterJobsByCycle(rawJobs, cycles, currentCycleObj.id)) : null;

    return (
        <section
            aria-label="Job Search Cycles"
            className={`cycle-filter-container ${className}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                ...style
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0
            }}>
                {/* Header label & Active cycle summary */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, maxWidth: '100%', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: 'var(--accent-primary)',
                        flexShrink: 0
                    }}>
                        <Layers size={15} />
                    </div>
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                    }}>
                        Search Cycles
                    </span>

                    {currentCycleObj && currentStats && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: currentCycleObj.status === 'completed' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: currentCycleObj.status === 'completed' ? '#16a34a' : 'var(--accent-primary)',
                            fontWeight: 500,
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                            {currentCycleObj.status === 'completed' ? (
                                <>
                                    <CheckCircle2 size={12} />
                                    <span>Closed · {currentStats.durationDays}d · {currentStats.acceptedCompany || 'Accepted'}</span>
                                </>
                            ) : (
                                <>
                                    <Zap size={12} />
                                    <span>Active · Day {currentStats.durationDays} · {currentStats.applied} applied</span>
                                </>
                            )}
                        </span>
                    )}
                </div>

                {/* Right Controls: Search Mode Toggle + Manage/Log Job Loss + Start New Cycle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Job Search Mode Toggle */}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={jobSearchMode}
                        onClick={handleToggleJobSearchMode}
                        title={jobSearchMode
                            ? 'Job Search Mode is ON. Click to pause (Employed / Standby).'
                            : 'Currently in Standby / Employed mode. Click to activate Job Search Mode.'}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '999px',
                            border: jobSearchMode
                                ? '1px solid rgba(16, 185, 129, 0.45)'
                                : '1px solid var(--border-subtle)',
                            background: jobSearchMode
                                ? 'rgba(16, 185, 129, 0.14)'
                                : 'var(--bg-card)',
                            color: jobSearchMode ? '#10b981' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Power size={12} />
                        <span>{jobSearchMode ? 'Search Mode: ON' : 'Standby Mode'}</span>
                    </button>

                    {/* Log Job Loss / Edit Periods Drawer Button */}
                    <button
                        type="button"
                        onClick={() => handleOpenPanel('job_loss')}
                        aria-expanded={activePanel !== null}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: activePanel ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                            background: activePanel ? 'rgba(107, 126, 103, 0.16)' : 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer'
                        }}
                        title="Log a job loss, edit cycle start/end dates, or split a period"
                    >
                        <SlidersHorizontal size={12} />
                        <span>Log Transition / Edit</span>
                    </button>

                    {/* New Cycle Button */}
                    {!isCreatingNew ? (
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreatingNew(true);
                                setTimeout(() => inputRef.current?.focus(), 50);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.74rem',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                border: '1px dashed var(--border-medium)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            title="Start a new job search cohort/cycle manually"
                        >
                            <Plus size={13} />
                            <span>Start New Cycle</span>
                        </button>
                    ) : (
                        <form
                            onSubmit={handleCreateNewCycle}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={newCycleName}
                                onChange={(e) => setNewCycleName(e.target.value)}
                                placeholder={`Cycle ${(activeCycle?.cycleNumber || cycles.length) + 1} Name...`}
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--accent-primary)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    width: '150px'
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: 'var(--accent-primary)',
                                    color: '#ffffff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 500
                                }}
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCreatingNew(false);
                                    setNewCycleName('');
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'inline-flex'
                                }}
                                aria-label="Cancel new cycle"
                            >
                                <X size={14} />
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* Quick Prompt after Manually Toggling Search Mode ON */}
            {showModeCyclePrompt && (
                <div
                    role="status"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: '0.78rem'
                    }}
                >
                    <span style={{ color: 'var(--text-primary)' }}>
                        <strong>Job Search Mode activated.</strong> Would you like to open a fresh Search Cycle starting today?
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            type="button"
                            onClick={() => {
                                startNewCycle(undefined, {
                                    triggerType: 'manual_toggle',
                                    notes: 'Activated Job Search Mode & opened fresh cycle'
                                });
                                setShowModeCyclePrompt(false);
                            }}
                            style={{
                                fontSize: '0.74rem',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: '#10b981',
                                color: '#fff',
                                border: 'none',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Open Fresh Cycle
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowModeCyclePrompt(false)}
                            style={{
                                fontSize: '0.74rem',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-subtle)',
                                cursor: 'pointer'
                            }}
                        >
                            Keep Current
                        </button>
                    </div>
                </div>
            )}

            {/* Automatic Activity Spike Suggestion Banner */}
            {topSpike && (
                <div
                    role="region"
                    aria-label="Detected Activity Spike Suggestion"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(59, 130, 246, 0.08))',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        fontSize: '0.78rem'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 240px' }}>
                        <TrendingUp size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', lineHeight: 1.35 }}>
                            <strong>Activity Spike Detected ({topSpike.dayLabel}):</strong> {topSpike.reason}. Split into a new current search period?
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={() => handleApplySpikeSplit(topSpike)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: '#f59e0b',
                                color: '#111827',
                                border: 'none',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            <Scissors size={12} />
                            <span>Split at {topSpike.dayLabel}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSplitDateInput(topSpike.dayStr);
                                setSplitNameInput(`Search (${topSpike.dayLabel})`);
                                handleOpenPanel('periods');
                            }}
                            style={{
                                fontSize: '0.74rem',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-subtle)',
                                cursor: 'pointer'
                            }}
                        >
                            Adjust Date
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDismissSpike(topSpike.id)}
                            aria-label="Dismiss spike suggestion"
                            title="Dismiss suggestion"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '3px',
                                display: 'inline-flex'
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Expandable Management Drawer (Log Job Loss / Edit & Split Periods / Transition History) */}
            {activePanel && (
                <div
                    role="region"
                    aria-label="Manage Search Mode, Job Loss Log & Periods"
                    style={{
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {[
                                { id: 'job_loss', label: 'Log Job Loss / New Search', icon: Briefcase },
                                { id: 'periods', label: 'Edit / Split Period Dates', icon: Scissors },
                                { id: 'history', label: `Transition Log (${(transitionLog || []).length})`, icon: History }
                            ].map(tab => {
                                const TabIcon = tab.icon;
                                const isTabActive = activePanel === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => handleOpenPanel(tab.id)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '4px 10px',
                                            borderRadius: '7px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            border: isTabActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                            background: isTabActive ? 'rgba(107, 126, 103, 0.16)' : 'transparent',
                                            color: isTabActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <TabIcon size={13} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => setActivePanel(null)}
                            aria-label="Close panel"
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {activePanel === 'job_loss' && (
                        <form onSubmit={handleLogJobLossSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', alignItems: 'end' }}>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                <span>Transition / Search Start Date</span>
                                <input
                                    type="date"
                                    value={lossDate}
                                    onChange={(e) => setLossDate(e.target.value)}
                                    required
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                <span>Previous Company (Optional)</span>
                                <input
                                    type="text"
                                    value={lossCompany}
                                    onChange={(e) => setLossCompany(e.target.value)}
                                    placeholder="e.g. Former Employer"
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                <span>New Cycle Name (Optional)</span>
                                <input
                                    type="text"
                                    value={lossCycleName}
                                    onChange={(e) => setLossCycleName(e.target.value)}
                                    placeholder="e.g. Current Search (Oct 2026)"
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                />
                            </label>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                <span>Note / Context (Optional)</span>
                                <input
                                    type="text"
                                    value={lossNote}
                                    onChange={(e) => setLossNote(e.target.value)}
                                    placeholder="e.g. Layoff / Role ended, restarting search"
                                    style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                />
                            </label>
                            <button
                                type="submit"
                                style={{
                                    padding: '7px 12px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    background: 'var(--accent-primary)',
                                    color: '#ffffff',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Activate Search &amp; Open Cycle
                            </button>
                        </form>
                    )}

                    {activePanel === 'periods' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Split Active Cycle at Specific Date */}
                            <form onSubmit={handleManualSplitSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', alignItems: 'end', paddingBottom: '10px', borderBottom: '1px dashed var(--border-subtle)' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                    <span>Split Current Period Starting On</span>
                                    <input
                                        type="date"
                                        value={splitDateInput}
                                        onChange={(e) => setSplitDateInput(e.target.value)}
                                        required
                                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                    />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                    <span>New Active Cycle Label</span>
                                    <input
                                        type="text"
                                        value={splitNameInput}
                                        onChange={(e) => setSplitNameInput(e.target.value)}
                                        placeholder="e.g. Current Search (Oct 2026)"
                                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                    />
                                </label>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '7px 12px',
                                        borderRadius: '7px',
                                        border: 'none',
                                        background: '#f59e0b',
                                        color: '#111827',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Split Period &amp; Reassign Jobs
                                </button>
                            </form>

                            {/* Edit Existing Cycle Dates/Name */}
                            <form onSubmit={handleSaveEditedPeriod} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', alignItems: 'end' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                    <span>Edit Existing Cycle</span>
                                    <select
                                        value={editingCycleId}
                                        onChange={(e) => handleSelectCycleToEdit(e.target.value)}
                                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                    >
                                        {cycles.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name || `Cycle ${c.cycleNumber}`} ({c.status})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                    <span>Cycle Name</span>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                    />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                    <span>Start Date</span>
                                    <input
                                        type="date"
                                        value={editStartDate}
                                        onChange={(e) => setEditStartDate(e.target.value)}
                                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                    />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                    <span>End Date (Blank if Active)</span>
                                    <input
                                        type="date"
                                        value={editEndDate}
                                        onChange={(e) => setEditEndDate(e.target.value)}
                                        style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
                                    />
                                </label>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '7px 12px',
                                        borderRadius: '7px',
                                        border: 'none',
                                        background: 'var(--accent-primary)',
                                        color: '#ffffff',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Save Period Dates
                                </button>
                            </form>
                        </div>
                    )}

                    {activePanel === 'history' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                            {(!transitionLog || transitionLog.length === 0) ? (
                                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '6px 0' }}>
                                    No transition events logged yet. Use &ldquo;Log Job Loss / New Search&rdquo; or toggle Search Mode to track career periods.
                                </p>
                            ) : (
                                transitionLog.map(evt => (
                                    <div
                                        key={evt.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                            padding: '6px 10px',
                                            borderRadius: '7px',
                                            background: 'var(--bg-secondary)',
                                            fontSize: '0.76rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, color: evt.type === 'job_loss' ? '#f59e0b' : 'var(--accent-primary)' }}>
                                                    {evt.type === 'job_loss'
                                                        ? 'Role Transition / Job Loss'
                                                        : evt.type === 'activity_spike'
                                                            ? 'Activity Spike Detected'
                                                            : evt.type === 'search_paused'
                                                                ? 'Search Paused (Standby)'
                                                                : 'Started Active Search'}
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                    · {toInputDate(evt.date)}
                                                </span>
                                                {evt.company && (
                                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                        · {evt.company}
                                                    </span>
                                                )}
                                            </div>
                                            {evt.note && (
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                                                    {evt.note}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => deleteTransitionEvent(evt.id)}
                                            aria-label="Delete transition log entry"
                                            title="Remove entry"
                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Horizontal Scrollable Pills */}
            <div
                role="tablist"
                aria-label="Filter applications by search cycle"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    paddingBottom: '2px',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box'
                }}
            >
                {/* All Cycles Pill */}
                <button
                    type="button"
                    role="tab"
                    aria-selected={selectedCycleId === 'all'}
                    onClick={() => setSelectedCycleId('all')}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: selectedCycleId === 'all' ? 600 : 500,
                        border: selectedCycleId === 'all'
                            ? '1px solid var(--accent-primary)'
                            : '1px solid var(--border-subtle)',
                        background: selectedCycleId === 'all'
                            ? 'var(--accent-primary)'
                            : 'var(--bg-card)',
                        color: selectedCycleId === 'all'
                            ? '#ffffff'
                            : 'var(--text-primary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                    }}
                >
                    <Layers size={13} />
                    <span>All Cycles</span>
                    <span style={{
                        padding: '1px 6px',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        background: selectedCycleId === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                        color: selectedCycleId === 'all' ? '#ffffff' : 'var(--text-secondary)'
                    }}>
                        {cycleCounts.all || 0}
                    </span>
                </button>

                {/* Individual Cycles */}
                {cycles.map((cycle) => {
                    const isSelected = selectedCycleId === cycle.id || (selectedCycleId === 'active' && activeCycle?.id === cycle.id);
                    const isCompleted = cycle.status === 'completed';
                    const count = cycleCounts[cycle.id] || 0;

                    return (
                        <button
                            key={cycle.id}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => setSelectedCycleId(cycle.id)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '999px',
                                fontSize: '0.78rem',
                                fontWeight: isSelected ? 600 : 500,
                                border: isSelected
                                    ? (isCompleted ? '1px solid #16a34a' : '1px solid var(--accent-primary)')
                                    : '1px solid var(--border-subtle)',
                                background: isSelected
                                    ? (isCompleted ? '#16a34a' : 'var(--accent-primary)')
                                    : 'var(--bg-card)',
                                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                transition: 'all 0.15s ease'
                            }}
                            title={isCompleted
                                ? `Completed cycle (${toInputDate(cycle.startedAt)} – ${toInputDate(cycle.endedAt) || 'Closed'}) · ${count} jobs`
                                : `Active search cycle (Started ${toInputDate(cycle.startedAt)}) · ${count} jobs`}
                        >
                            {isCompleted ? (
                                <CheckCircle2 size={13} style={{ color: isSelected ? '#ffffff' : '#16a34a' }} />
                            ) : (
                                <Zap size={13} style={{ color: isSelected ? '#ffffff' : '#f59e0b' }} />
                            )}
                            <span>
                                {cycle.name || `Cycle ${cycle.cycleNumber}`}
                                {cycle.acceptedCompany ? ` · ${cycle.acceptedCompany}` : (isCompleted ? '' : ' (Active)')}
                            </span>
                            <span style={{
                                padding: '1px 6px',
                                borderRadius: '999px',
                                fontSize: '0.7rem',
                                background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
                                color: isSelected ? '#ffffff' : 'var(--text-secondary)'
                            }}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
