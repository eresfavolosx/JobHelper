"use client";

import { useMemo, useState } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    ReferenceLine
} from 'recharts';
import { useUIStore } from '@/lib/uiStore';
import { useAppStore } from '@/lib/store';
import { getApplicationGoal } from '@/lib/goal-tracker';
import {
    calculateChartData,
    resolveGranularity,
    getGoalCadenceGranularity,
    getGranularityLabel
} from '@/lib/chart-utils';
import { Plus, Target, Sparkles, BarChart2 } from 'lucide-react';

const STORAGE_KEY_GRANULARITY = 'jobhelper_chart_granularity_mode';

function CustomChartTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;

    return (
        <div style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            fontSize: '0.85rem',
            minWidth: '180px'
        }}>
            <p style={{
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
                fontSize: '0.85rem'
            }}>
                {item.periodLabel || item.date}
            </p>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                color: 'var(--text-secondary)',
                marginBottom: '4px'
            }}>
                <span>Total Applications:</span>
                <strong style={{ color: 'var(--accent-primary)', fontSize: '0.95rem' }}>
                    {item.count}
                </strong>
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                color: 'var(--text-secondary)'
            }}>
                <span>Added in period:</span>
                <strong style={{
                    color: item.newJobs > 0 ? 'var(--success)' : 'var(--text-secondary)'
                }}>
                    {item.newJobs > 0 ? `+${item.newJobs}` : '0'}
                </strong>
            </div>
        </div>
    );
}

export default function ApplicationHistoryChart({ jobs }) {
    const openNewJobModal = useUIStore(s => s.openNewJobModal);
    const profile = useAppStore(s => s.profile);

    // Goal set by the user
    const goal = useMemo(() => getApplicationGoal(profile), [profile]);

    // Manual switcher state: 'auto' | 'daily' | 'weekly' | 'monthly'
    const [mode, setMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_GRANULARITY);
            if (saved && ['auto', 'daily', 'weekly', 'monthly'].includes(saved)) {
                return saved;
            }
        }
        return 'auto';
    });

    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_GRANULARITY, newMode);
        }
    };

    // Calculate effective granularity based on goal cadence (when in 'auto') or manual selection
    const autoGranularity = useMemo(() => getGoalCadenceGranularity(goal), [goal]);
    const effectiveGranularity = useMemo(() => {
        return resolveGranularity(mode, goal);
    }, [mode, goal]);

    const isAuto = mode === 'auto';

    // Aggregated time-series data
    const data = useMemo(() => {
        return calculateChartData(jobs, effectiveGranularity);
    }, [jobs, effectiveGranularity]);

    if (!jobs || jobs.length < 2) {
        return (
            <div
                className="card"
                style={{
                    marginTop: '20px',
                    height: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)'
                }}
            >
                <p>Add more jobs to see your application history graph!</p>
                <button
                    onClick={openNewJobModal}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={16} /> Add Application
                </button>
            </div>
        );
    }

    return (
        <div className="card" style={{ marginTop: '20px', padding: '24px' }}>
            {/* Header with Title, Auto-Sync Badge, and Manual Switcher */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                marginBottom: '20px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h3 style={{
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            color: 'var(--text-primary)',
                            margin: 0
                        }}>
                            Application History
                        </h3>
                        {isAuto ? (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontSize: '0.72rem',
                                    padding: '3px 9px',
                                    borderRadius: '9999px',
                                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                    color: 'var(--accent-primary)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    fontWeight: 600,
                                    letterSpacing: '0.01em'
                                }}
                                title={`Granularity automatically aligned with your ${goal.cadence} application goal (${goal.target} targets)`}
                            >
                                <Sparkles size={11} /> Auto: {getGranularityLabel(autoGranularity)} (Goal)
                            </span>
                        ) : (
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.72rem',
                                    padding: '3px 8px',
                                    borderRadius: '9999px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    fontWeight: 500
                                }}
                            >
                                <BarChart2 size={11} /> Manual ({getGranularityLabel(effectiveGranularity)})
                            </span>
                        )}
                    </div>
                    <p style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        margin: '4px 0 0 0'
                    }}>
                        Showing cumulative pipeline by {effectiveGranularity} intervals
                        {goal?.target ? ` · Goal: ${goal.target} applications / ${goal.cadence}` : ''}
                    </p>
                </div>

                {/* Manual Granularity Switcher Segmented Control */}
                <div
                    role="tablist"
                    aria-label="X-axis Granularity Switcher"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-subtle, rgba(255, 255, 255, 0.04))',
                        border: '1px solid var(--border-subtle)',
                        gap: '2px'
                    }}
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === 'auto'}
                        onClick={() => handleModeChange('auto')}
                        style={{
                            padding: '5px 11px',
                            fontSize: '0.75rem',
                            fontWeight: mode === 'auto' ? 600 : 500,
                            color: mode === 'auto' ? '#ffffff' : 'var(--text-secondary)',
                            backgroundColor: mode === 'auto' ? 'var(--accent-primary)' : 'transparent',
                            borderRadius: '7px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                        title={`Auto-switch x-axis based on ${goal.cadence} goal`}
                    >
                        <Target size={12} />
                        Auto ({getGranularityLabel(autoGranularity)})
                    </button>

                    {['daily', 'weekly', 'monthly'].map((gran) => {
                        const isSelected = mode === gran;
                        return (
                            <button
                                key={gran}
                                type="button"
                                role="tab"
                                aria-selected={isSelected}
                                onClick={() => handleModeChange(gran)}
                                style={{
                                    padding: '5px 11px',
                                    fontSize: '0.75rem',
                                    fontWeight: isSelected ? 600 : 500,
                                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                                    borderRadius: '7px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {getGranularityLabel(gran)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Area Chart with Responsive Container */}
            <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                        <XAxis
                            dataKey="date"
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        {goal?.cadence === 'total' && goal?.target ? (
                            <ReferenceLine
                                y={goal.target}
                                stroke="var(--warning, #f59e0b)"
                                strokeDasharray="4 4"
                                label={{
                                    value: `Target: ${goal.target}`,
                                    fill: 'var(--warning, #f59e0b)',
                                    fontSize: 11,
                                    position: 'insideTopRight'
                                }}
                            />
                        ) : null}
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="var(--accent-primary)"
                            fillOpacity={1}
                            fill="url(#colorCount)"
                            strokeWidth={3}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
