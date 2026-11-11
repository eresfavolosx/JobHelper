"use client";

import { useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Clock,
    Activity
} from 'lucide-react';
import {
    TREND_WINDOW_OPTIONS,
    computeMetricsTrendAnalysis
} from '@/lib/trend-analytics';

const STATUS_BADGE = {
    improving: {
        bg: 'rgba(78, 135, 82, 0.14)',
        border: 'rgba(78, 135, 82, 0.36)',
        color: '#22c55e',
        icon: TrendingUp
    },
    declining: {
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.34)',
        color: '#ef4444',
        icon: TrendingDown
    },
    steady: {
        bg: 'rgba(148, 163, 184, 0.12)',
        border: 'rgba(148, 163, 184, 0.28)',
        color: 'var(--text-secondary)',
        icon: Minus
    },
    insufficient: {
        bg: 'var(--glass-highlight)',
        border: 'var(--border-subtle)',
        color: 'var(--text-secondary)',
        icon: Clock
    }
};

function Sparkline({ values = [], strokeColor }) {
    if (!Array.isArray(values) || values.length < 2) {
        return null;
    }

    const numeric = values.map(v => (typeof v === 'number' && !isNaN(v) ? v : 0));
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const span = max - min || 1;
    const width = 100;
    const height = 26;
    const padY = 3;

    const points = numeric
        .map((val, idx) => {
            const x = numeric.length === 1 ? width / 2 : (idx / (numeric.length - 1)) * width;
            const normY = (val - min) / span;
            const y = height - padY - normY * (height - padY * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{ display: 'block', marginTop: '8px', overflow: 'visible' }}
        >
            <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}

function WeeklyTrendTooltip({ active, payload, label, chartMode }) {
    if (!active || !payload || !payload.length) return null;
    const week = payload[0]?.payload;
    if (!week) return null;

    return (
        <div style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
            fontSize: '0.78rem',
            minWidth: '165px'
        }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Week of {label} ({week.applied} applied)
            </div>
            {chartMode === 'rates' && (
                <div style={{ display: 'grid', gap: '3px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span>Callback / Screen:</span>
                        <strong style={{ color: '#0ea5e9' }}>{week.screeningRate}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span>Interview Rate:</span>
                        <strong style={{ color: '#22c55e' }}>{week.interviewRate}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span>Resume Reject:</span>
                        <strong style={{ color: '#ef4444' }}>{week.earlyRejectionRate}%</strong>
                    </div>
                </div>
            )}
            {chartMode === 'volume' && (
                <div style={{ display: 'grid', gap: '3px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span>Applications:</span>
                        <strong style={{ color: 'var(--accent-primary)' }}>{week.applied}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span>Reached Screen+:</span>
                        <strong style={{ color: '#0ea5e9' }}>{week.screening}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                        <span>Reached Interview:</span>
                        <strong style={{ color: '#22c55e' }}>{week.interviewing}</strong>
                    </div>
                </div>
            )}
            {chartMode === 'speed' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: 'var(--text-secondary)' }}>
                    <span>Avg Response Time:</span>
                    <strong style={{ color: '#f59e0b' }}>
                        {week.avgCallbackDays !== null ? `${week.avgCallbackDays}d` : 'No callbacks'}
                    </strong>
                </div>
            )}
        </div>
    );
}

export default function MetricsTrendPanel({ jobs = [] }) {
    const [windowId, setWindowId] = useState('14d');
    const [chartMode, setChartMode] = useState('rates');

    const analysis = useMemo(() => {
        return computeMetricsTrendAnalysis(jobs, { windowId });
    }, [jobs, windowId]);

    const { window: windowOption, recentStats, priorStats, weeklySeries, metrics, summary } = analysis;

    const verdictStyle = summary.tone === 'positive'
        ? { bg: 'rgba(78, 135, 82, 0.15)', border: 'rgba(78, 135, 82, 0.4)', color: '#22c55e' }
        : summary.tone === 'warning'
            ? { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' }
            : { bg: 'var(--glass-highlight)', border: 'var(--border-subtle)', color: 'var(--text-secondary)' };

    return (
        <section
            aria-label="Recent Metrics Trend and Momentum"
            className="card"
            style={{
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                minWidth: 0
            }}
        >
            {/* Header Row: Title + Verdict Pill + Window Selector */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: '1 1 240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Activity size={18} color="var(--accent-primary)" aria-hidden="true" />
                        <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Recent Metric Trends
                        </h3>
                        <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 9px',
                            borderRadius: '999px',
                            background: verdictStyle.bg,
                            border: `1px solid ${verdictStyle.border}`,
                            color: verdictStyle.color
                        }}>
                            {summary.verdict}
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {summary.headline}
                    </p>
                </div>

                {/* Comparison Window Switcher */}
                <div
                    role="group"
                    aria-label="Comparison time window"
                    style={{
                        display: 'inline-flex',
                        padding: '3px',
                        borderRadius: '9px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        gap: '2px',
                        flexShrink: 0
                    }}
                >
                    {TREND_WINDOW_OPTIONS.map(opt => {
                        const isSelected = windowId === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => setWindowId(opt.id)}
                                title={opt.label}
                                style={{
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: isSelected ? 700 : 500,
                                    background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                            >
                                {opt.shortLabel}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Cohort Context Strip */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)'
            }}>
                <span>
                    Comparing <strong style={{ color: 'var(--text-primary)' }}>Last {windowOption.days}d ({recentStats.appliedCount} apps)</strong> vs <strong style={{ color: 'var(--text-primary)' }}>Prior {windowOption.days}d ({priorStats.appliedCount} apps)</strong>
                </span>
                <span style={{ display: 'inline-flex', gap: '10px', flexWrap: 'wrap' }}>
                    {summary.counts.improving > 0 && (
                        <strong style={{ color: '#22c55e' }}>{summary.counts.improving} improving</strong>
                    )}
                    {summary.counts.declining > 0 && (
                        <strong style={{ color: '#ef4444' }}>{summary.counts.declining} watching</strong>
                    )}
                    {summary.counts.steady > 0 && (
                        <span>{summary.counts.steady} steady</span>
                    )}
                </span>
            </div>

            {/* Responsive 6-Metric Scorecard Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
                gap: '12px'
            }}>
                {metrics.map(metric => {
                    const badge = STATUS_BADGE[metric.status] || STATUS_BADGE.steady;
                    const StatusIcon = badge.icon;
                    const sparkColor = metric.status === 'improving'
                        ? '#22c55e'
                        : metric.status === 'declining'
                            ? '#ef4444'
                            : 'var(--accent-primary)';

                    return (
                        <article
                            key={metric.id}
                            style={{
                                padding: '12px 14px',
                                borderRadius: '10px',
                                background: 'var(--bg-panel)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                minWidth: 0
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                <h4 style={{
                                    margin: 0,
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {metric.label}
                                </h4>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: '999px',
                                    background: badge.bg,
                                    border: `1px solid ${badge.border}`,
                                    color: badge.color,
                                    flexShrink: 0
                                }}>
                                    <StatusIcon size={11} aria-hidden="true" />
                                    <span>{metric.statusLabel}</span>
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                                    {metric.recentFormatted}
                                </span>
                                {metric.delta !== null && (
                                    <span style={{
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        color: badge.color
                                    }}>
                                        {metric.deltaFormatted}
                                    </span>
                                )}
                            </div>

                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                                Prior {windowOption.shortLabel}: <strong>{metric.priorFormatted}</strong> · {metric.description}
                            </p>

                            <Sparkline values={metric.sparkline} strokeColor={sparkColor} />
                        </article>
                    );
                })}
            </div>

            {/* Interactive Weekly Trajectory Chart */}
            {weeklySeries.length >= 2 && (
                <div style={{
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    minWidth: 0
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px'
                    }}>
                        <div>
                            <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Week-by-Week Trajectory
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                Track how your rates, volume, and response speed evolved week over week
                            </p>
                        </div>

                        <div
                            role="group"
                            aria-label="Chart metric view"
                            style={{
                                display: 'inline-flex',
                                padding: '2px',
                                borderRadius: '8px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-subtle)',
                                gap: '2px'
                            }}
                        >
                            {[
                                { id: 'rates', label: 'Rates (%)' },
                                { id: 'volume', label: 'Volume' },
                                { id: 'speed', label: 'Speed (d)' }
                            ].map(modeBtn => {
                                const active = chartMode === modeBtn.id;
                                return (
                                    <button
                                        key={modeBtn.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setChartMode(modeBtn.id)}
                                        style={{
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '4px 9px',
                                            fontSize: '0.72rem',
                                            fontWeight: active ? 700 : 500,
                                            background: active ? 'var(--bg-card)' : 'transparent',
                                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {modeBtn.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '215px', minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={weeklySeries} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                                <XAxis
                                    dataKey="weekLabel"
                                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                                    axisLine={false}
                                    tickLine={false}
                                    unit={chartMode === 'rates' ? '%' : chartMode === 'speed' ? 'd' : ''}
                                />
                                <Tooltip content={<WeeklyTrendTooltip chartMode={chartMode} />} />

                                {chartMode === 'rates' && (
                                    <>
                                        <Line
                                            type="monotone"
                                            dataKey="screeningRate"
                                            name="Callback / Screen %"
                                            stroke="#0ea5e9"
                                            strokeWidth={2.5}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="interviewRate"
                                            name="Interview %"
                                            stroke="#22c55e"
                                            strokeWidth={2.5}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="earlyRejectionRate"
                                            name="Resume Reject %"
                                            stroke="#ef4444"
                                            strokeWidth={2}
                                            strokeDasharray="4 3"
                                            dot={{ r: 2.5 }}
                                        />
                                    </>
                                )}

                                {chartMode === 'volume' && (
                                    <>
                                        <Bar
                                            dataKey="applied"
                                            name="Applied"
                                            fill="rgba(107, 126, 103, 0.35)"
                                            radius={[4, 4, 0, 0]}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="screening"
                                            name="Screen+"
                                            stroke="#0ea5e9"
                                            strokeWidth={2.5}
                                            dot={{ r: 3 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="interviewing"
                                            name="Interview+"
                                            stroke="#22c55e"
                                            strokeWidth={2.5}
                                            dot={{ r: 3 }}
                                        />
                                    </>
                                )}

                                {chartMode === 'speed' && (
                                    <Line
                                        type="monotone"
                                        dataKey="avgCallbackDays"
                                        name="Avg Callback Days"
                                        stroke="#f59e0b"
                                        strokeWidth={2.5}
                                        connectNulls
                                        dot={{ r: 3.5 }}
                                        activeDot={{ r: 5 }}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </section>
    );
}
