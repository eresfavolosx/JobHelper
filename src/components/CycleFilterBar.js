"use client";

import { useState, useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { resolveCyclesFromJobs, getActiveCycle, filterJobsByCycle, calculateCycleStats } from '@/lib/cycle-utils';
import { CheckCircle2, Zap, Plus, Layers, Calendar, ChevronRight, X, Sparkles, Building2, Flag } from 'lucide-react';

export default function CycleFilterBar({ className = '', style = {} }) {
    const rawJobs = useAppStore(state => state.jobs);
    const storeCycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const setSelectedCycleId = useAppStore(state => state.setSelectedCycleId);
    const startNewCycle = useAppStore(state => state.startNewCycle);

    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newCycleName, setNewCycleName] = useState('');
    const inputRef = useRef(null);

    const cycles = useMemo(() => {
        return resolveCyclesFromJobs(rawJobs, storeCycles);
    }, [rawJobs, storeCycles]);

    const activeCycle = useMemo(() => getActiveCycle(cycles), [cycles]);

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
    };

    if (!cycles || cycles.length === 0) return null;

    // Current selected cycle object
    const currentCycleObj = selectedCycleId === 'all'
        ? null
        : cycles.find(c => c.id === selectedCycleId) || activeCycle;

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
                gap: '10px',
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
                            fontSize: '0.75rem',
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
                    const isSelected = selectedCycleId === cycle.id;
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
                                ? `Completed cycle · Offer accepted at ${cycle.acceptedCompany || 'Company'} (${count} jobs)`
                                : `Active search cycle (${count} jobs)`}
                        >
                            {isCompleted ? (
                                <CheckCircle2 size={13} style={{ color: isSelected ? '#ffffff' : '#16a34a' }} />
                            ) : (
                                <Zap size={13} style={{ color: isSelected ? '#ffffff' : '#f59e0b' }} />
                            )}
                            <span>
                                {cycle.name || `Cycle ${cycle.cycleNumber}`}
                                {cycle.acceptedCompany ? ` · ${cycle.acceptedCompany}` : (isCompleted ? ' · Offer' : ' (Active)')}
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
