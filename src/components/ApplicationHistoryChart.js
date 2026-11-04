"use client";

import { useMemo, useState, useRef, useEffect } from 'react';
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
import { getApplicationGoal, isSubmittedApplication, parseJobDate } from '@/lib/goal-tracker';
import {
    calculateChartData,
    resolveGranularity,
    getGoalCadenceGranularity,
    getGranularityLabel,
    CHART_TIME_RANGES
} from '@/lib/chart-utils';
import { Plus, Target, Sparkles, BarChart2 } from 'lucide-react';

const STORAGE_KEY_GRANULARITY = 'jobhelper_chart_granularity_mode';
const STORAGE_KEY_RANGE = 'jobhelper_chart_range';

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
    const scrollContainerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);

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

    // Time horizon range state: '7d' | '14d' | '30d' | '90d' | 'all'
    const [range, setRange] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_RANGE);
            if (saved && ['7d', '14d', '30d', '90d', 'all'].includes(saved)) {
                return saved;
            }
        }
        return 'all';
    });

    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_GRANULARITY, newMode);
        }
    };

    const handleRangeChange = (newRange) => {
        setRange(newRange);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_RANGE, newRange);
        }
    };

    // Calculate effective granularity based on goal cadence (when in 'auto') or manual selection
    const autoGranularity = useMemo(() => getGoalCadenceGranularity(goal), [goal]);
    const effectiveGranularity = useMemo(() => {
        return resolveGranularity(mode, goal);
    }, [mode, goal]);

    const isAuto = mode === 'auto';

    // Aggregated time-series data with range filter applied.
    // Uses the same rules as the goal tracker: only submitted applications, dated by
    // their application date (status changes never count as new applications).
    const submittedJobs = useMemo(
        () => (Array.isArray(jobs) ? jobs.filter(isSubmittedApplication) : []),
        [jobs]
    );
    const data = useMemo(() => {
        return calculateChartData(submittedJobs, effectiveGranularity, { range, getDate: parseJobDate });
    }, [submittedJobs, effectiveGranularity, range]);

    // Track scroll container width with ResizeObserver
    useEffect(() => {
        if (!scrollContainerRef.current || typeof window === 'undefined') return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect?.width) {
                    setContainerWidth(Math.floor(entry.contentRect.width));
                }
            }
        });
        observer.observe(scrollContainerRef.current);
        return () => observer.disconnect();
    }, []);

    // Daily mode needs at least 46px per day to guarantee zero label clipping and un-skipped dates on any screen
    const minTickWidth = effectiveGranularity === 'daily' ? 46 : effectiveGranularity === 'weekly' ? 64 : 80;
    const computedChartWidth = Math.max(containerWidth || 600, (data?.length || 0) * minTickWidth);
    const isScrollable = computedChartWidth > (containerWidth || 600);

    // Auto-scroll to latest date on render or when data changes so the user is positioned on the most recent day
    useEffect(() => {
        if (scrollContainerRef.current && isScrollable) {
            scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
    }, [data.length, isScrollable, range]);

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
            {/* Header with Title, Auto-Sync Badge, Range Filter, and Granularity Switcher */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginBottom: '18px'
            }}>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px'
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
                            {range !== 'all' ? ` · Last ${range.replace('d', ' days')}` : ' · Full history'}
                            {goal?.target ? ` · Goal: ${goal.target} applications / ${goal.cadence}` : ''}
                        </p>
                    </div>

                    {/* Filter Controls: Range & Granularity */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', maxWidth: '100%' }}>
                        {/* Time Horizon Range Filter */}
                        <div
                            role="tablist"
                            aria-label="Time Horizon Range Filter"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--bg-subtle, rgba(255, 255, 255, 0.04))',
                                border: '1px solid var(--border-subtle)',
                                gap: '2px',
                                overflowX: 'auto',
                                maxWidth: '100%'
                            }}
                        >
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0 6px', textTransform: 'uppercase' }}>
                                Range:
                            </span>
                            {CHART_TIME_RANGES.map((rng) => {
                                const isSelected = range === rng.id;
                                return (
                                    <button
                                        key={rng.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        onClick={() => handleRangeChange(rng.id)}
                                        title={rng.title}
                                        style={{
                                            padding: '4px 9px',
                                            fontSize: '0.72rem',
                                            fontWeight: isSelected ? 600 : 500,
                                            color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                            backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                                            borderRadius: '7px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {rng.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Granularity Switcher Segmented Control */}
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
                                gap: '2px',
                                overflowX: 'auto',
                                maxWidth: '100%'
                            }}
                        >
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0 6px', textTransform: 'uppercase' }}>
                                Interval:
                            </span>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'auto'}
                                onClick={() => handleModeChange('auto')}
                                style={{
                                    padding: '4px 9px',
                                    fontSize: '0.72rem',
                                    fontWeight: mode === 'auto' ? 600 : 500,
                                    color: mode === 'auto' ? '#ffffff' : 'var(--text-secondary)',
                                    backgroundColor: mode === 'auto' ? 'var(--accent-primary)' : 'transparent',
                                    borderRadius: '7px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                }}
                                title={`Auto-switch x-axis based on ${goal.cadence} goal`}
                            >
                                <Target size={11} />
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
                                            padding: '4px 9px',
                                            fontSize: '0.72rem',
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
                </div>
            </div>

            {/* Scrollable Container for Area Chart */}
            <div
                ref={scrollContainerRef}
                style={{
                    width: '100%',
                    overflowX: isScrollable ? 'auto' : 'hidden',
                    overflowY: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    borderRadius: '8px',
                    paddingBottom: '4px'
                }}
                tabIndex={0}
                aria-label="Application history timeline graph"
            >
                <div style={{ width: isScrollable ? `${computedChartWidth}px` : '100%', height: '320px', minWidth: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{
                                top: 10,
                                right: 30,
                                left: 0,
                                bottom: effectiveGranularity === 'daily' && data.length > 7 ? 20 : 5,
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
                                interval={0}
                                stroke="var(--text-secondary)"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                angle={effectiveGranularity === 'daily' && data.length > 7 ? -35 : 0}
                                textAnchor={effectiveGranularity === 'daily' && data.length > 7 ? 'end' : 'middle'}
                                height={effectiveGranularity === 'daily' && data.length > 7 ? 48 : 30}
                                dy={effectiveGranularity === 'daily' && data.length > 7 ? 4 : 0}
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
                                strokeWidth={2.5}
                                dot={{
                                    r: data.length <= 40 ? 3.5 : 2.5,
                                    fill: 'var(--accent-primary)',
                                    stroke: 'var(--bg-card)',
                                    strokeWidth: 1.5
                                }}
                                activeDot={{
                                    r: 6,
                                    fill: 'var(--accent-primary)',
                                    stroke: '#ffffff',
                                    strokeWidth: 2
                                }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Scroll Indicator & Granularity Status */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '10px',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)'
            }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'inline-block' }} />
                    {effectiveGranularity === 'daily'
                        ? `Displaying every single day without skipping (${data.length} days plotted)`
                        : `Displaying ${data.length} consecutive ${effectiveGranularity} intervals`}
                </span>
                {isScrollable && (
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        ↔ Scroll horizontally to view full timeline
                    </span>
                )}
            </div>
        </div>
    );
}
