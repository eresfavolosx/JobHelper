"use client";

import { useMemo, useState, useRef, useEffect, useSyncExternalStore } from 'react';
import {
    Calendar,
    Clock,
    Timer,
    Activity,
    Sparkles,
    Search,
    Copy,
    Check,
    Download,
    AlertTriangle,
    AlertCircle,
    Zap,
    BarChart3,
    ArrowUpRight,
    X,
    Plus
} from 'lucide-react';
import { useUIStore } from '@/lib/uiStore';
import {
    GANTT_STAGE_META,
    GANTT_TIME_RANGES,
    GANTT_STATUS_FILTERS,
    GANTT_SORT_OPTIONS,
    buildGanttChartData,
    formatGanttInsightsMarkdown
} from '@/lib/gantt-utils';

const STORAGE_KEY_GANTT_VIEW = 'novujobs_gantt_view';
const STORAGE_KEY_GANTT_RANGE = 'novujobs_gantt_range';
const STORAGE_KEY_GANTT_STATUS = 'novujobs_gantt_status';

function subscribeReducedMotion(callback) {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    try {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', callback);
            return () => mq.removeEventListener('change', callback);
        } else if (typeof mq.addListener === 'function') {
            mq.addListener(callback);
            return () => mq.removeListener(callback);
        }
    } catch {
        /* Safari sandbox fallback */
    }
    return () => {};
}

function getReducedMotionSnapshot() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot() {
    return false;
}

export default function JobGanttChart({ jobs, compact = false }) {
    const openEditJobModal = useUIStore(s => s.openEditJobModal);
    const openNewJobModal = useUIStore(s => s.openNewJobModal);

    const prefersReducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot
    );

    const containerRef = useRef(null);
    const timelineSvgRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(900);

    // View: 'gantt' | 'insights'
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_GANTT_VIEW);
            if (saved === 'gantt' || saved === 'insights') return saved;
        }
        return 'gantt';
    });

    const [range, setRange] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_GANTT_RANGE);
            if (saved && GANTT_TIME_RANGES.some(r => r.id === saved)) return saved;
        }
        return 'all';
    });

    const [statusFilter, setStatusFilter] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_GANTT_STATUS);
            if (saved && GANTT_STATUS_FILTERS.some(f => f.id === saved)) return saved;
        }
        return 'all';
    });

    const [sortBy, setSortBy] = useState('newest');
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredItemId, setHoveredItemId] = useState(null);
    const [hoveredMilestone, setHoveredMilestone] = useState(null);
    const [copiedSummary, setCopiedSummary] = useState(false);

    // Observe container width
    useEffect(() => {
        if (!containerRef.current || typeof window === 'undefined') return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentRect?.width) {
                    setContainerWidth(Math.max(480, Math.floor(entry.contentRect.width)));
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_GANTT_VIEW, tab);
        }
    };

    const handleRangeChange = (newRange) => {
        setRange(newRange);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_GANTT_RANGE, newRange);
        }
    };

    const handleStatusFilterChange = (newFilter) => {
        setStatusFilter(newFilter);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_GANTT_STATUS, newFilter);
        }
    };

    // Calculate Gantt data & insights
    const ganttData = useMemo(() => {
        return buildGanttChartData(jobs, {
            range,
            statusFilter,
            searchQuery,
            sortBy,
            width: containerWidth
        });
    }, [jobs, range, statusFilter, searchQuery, sortBy, containerWidth]);

    const { items, columns, insights, todayPercent, hasData, totalVisible } = ganttData;

    // Copy Insights Summary
    const handleCopyInsights = async () => {
        const text = formatGanttInsightsMarkdown(insights);
        try {
            await navigator.clipboard.writeText(text);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2500);
        } catch (e) {
            console.error('Failed to copy Gantt insights:', e);
        }
    };

    // Export SVG
    const handleExportSvg = () => {
        if (!timelineSvgRef.current) return;
        try {
            const svgData = new XMLSerializer().serializeToString(timelineSvgRef.current);
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `job-pipeline-gantt-${range}-${Date.now()}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export Gantt SVG:', e);
        }
    };

    // Row heights & timeline sizing
    const rowHeight = compact ? 38 : 44;
    const headerHeight = 36;
    const timelineSvgHeight = Math.max(160, headerHeight + items.length * rowHeight + 16);
    const leftColWidth = containerWidth < 680 ? 180 : 260;
    const timelineWidth = Math.max(500, containerWidth - leftColWidth - 40);

    return (
        <section
            ref={containerRef}
            className="card"
            aria-label="Application Gantt Chart and Pipeline Velocity"
            style={{
                marginTop: compact ? '14px' : '20px',
                marginBottom: compact ? '16px' : '0',
                padding: compact ? '18px 20px' : '24px',
                color: 'var(--text-primary)',
                transition: prefersReducedMotion ? 'none' : 'all 0.2s ease'
            }}
        >
            {/* Top Toolbar */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '14px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-subtle)'
            }}>
                {/* Title & View Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{
                        padding: '8px',
                        borderRadius: '12px',
                        background: 'rgba(107, 126, 103, 0.16)',
                        border: '1px solid var(--accent-primary)',
                        color: 'var(--accent-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Timer size={20} aria-hidden="true" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                Application Timeline &amp; Velocity
                            </h3>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'var(--bg-panel)',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                                border: '1px solid var(--border-subtle)'
                            }}>
                                {totalVisible} {totalVisible === 1 ? 'role' : 'roles'}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                            Gantt swimlanes, milestone pacing, and stage bottleneck velocity diagnostics
                        </p>
                    </div>

                    {/* View Switcher Tabs */}
                    <div
                        role="tablist"
                        aria-label="View switcher"
                        style={{
                            display: 'inline-flex',
                            padding: '3px',
                            borderRadius: '10px',
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.76rem',
                            fontWeight: 600
                        }}
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'gantt'}
                            onClick={() => handleTabChange('gantt')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                background: activeTab === 'gantt' ? 'var(--bg-card)' : 'transparent',
                                color: activeTab === 'gantt' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                boxShadow: activeTab === 'gantt' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                                fontWeight: activeTab === 'gantt' ? 700 : 500,
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <Calendar size={13} aria-hidden="true" />
                            <span>Timeline Gantt</span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'insights'}
                            onClick={() => handleTabChange('insights')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                background: activeTab === 'insights' ? 'var(--bg-card)' : 'transparent',
                                color: activeTab === 'insights' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                boxShadow: activeTab === 'insights' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                                fontWeight: activeTab === 'insights' ? 700 : 500,
                                transition: 'all 0.15s ease',
                                position: 'relative'
                            }}
                        >
                            <Activity size={13} aria-hidden="true" />
                            <span>Velocity Insights</span>
                            {insights.ghostAlertCount + insights.followupCount > 0 && (
                                <span style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    background: '#f59e0b',
                                    display: 'inline-block',
                                    marginLeft: '2px'
                                }} />
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Action Tools: Time Range, Copy, SVG */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    {/* Time Range Pills */}
                    <div
                        role="group"
                        aria-label="Timeline time range"
                        style={{
                            display: 'inline-flex',
                            padding: '3px',
                            borderRadius: '10px',
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.74rem',
                            fontWeight: 600
                        }}
                    >
                        {GANTT_TIME_RANGES.map(r => (
                            <button
                                key={r.id}
                                type="button"
                                aria-pressed={range === r.id}
                                onClick={() => handleRangeChange(r.id)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: range === r.id ? 'var(--accent-primary)' : 'transparent',
                                    color: range === r.id ? '#ffffff' : 'var(--text-secondary)',
                                    fontWeight: range === r.id ? 700 : 500,
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Copy Insights Summary */}
                    <button
                        type="button"
                        onClick={handleCopyInsights}
                        aria-label="Copy Velocity Summary Markdown"
                        className="btn-secondary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '999px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {copiedSummary ? (
                            <>
                                <Check size={13} color="var(--success)" aria-hidden="true" />
                                <span style={{ color: 'var(--success)', fontWeight: 700 }}>Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy size={13} aria-hidden="true" />
                                <span>Copy Insights</span>
                            </>
                        )}
                    </button>

                    {/* Export SVG */}
                    {activeTab === 'gantt' && hasData && (
                        <button
                            type="button"
                            onClick={handleExportSvg}
                            aria-label="Download Gantt Chart as SVG"
                            className="btn-secondary"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '999px',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <Download size={13} aria-hidden="true" />
                            <span>Export SVG</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Secondary Filter & Search Bar */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                paddingTop: '14px',
                paddingBottom: '8px'
            }}>
                {/* Status / Category Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                    {GANTT_STATUS_FILTERS.map(f => (
                        <button
                            key={f.id}
                            type="button"
                            aria-pressed={statusFilter === f.id}
                            onClick={() => handleStatusFilterChange(f.id)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: statusFilter === f.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                background: statusFilter === f.id ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-card)',
                                color: statusFilter === f.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                transition: 'all 0.15s ease',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {f.label}
                            {f.id === 'alerts' && insights.alertsList.length > 0 && (
                                <span style={{
                                    padding: '1px 5px',
                                    borderRadius: '999px',
                                    fontSize: '0.66rem',
                                    fontWeight: 800,
                                    background: 'rgba(212, 163, 115, 0.25)',
                                    color: 'var(--warning)'
                                }}>
                                    {insights.alertsList.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search & Sort */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', minWidth: '180px' }}>
                        <Search size={13} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Filter roles or companies..."
                            aria-label="Filter roles in Gantt"
                            style={{
                                width: '100%',
                                padding: '5px 24px 5px 28px',
                                fontSize: '0.76rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-panel)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        aria-label="Sort Gantt swimlanes"
                        style={{
                            padding: '5px 10px',
                            fontSize: '0.76rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-panel)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {GANTT_SORT_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ marginTop: '14px' }}>
                {activeTab === 'gantt' ? (
                    /* ================= GANTT TIMELINE SWIMLANE VIEW ================= */
                    hasData ? (
                        <div style={{
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{
                                display: 'flex',
                                overflowX: 'auto',
                                WebkitOverflowScrolling: 'touch',
                                width: '100%'
                            }}>
                                {/* Left Sticky Role Column */}
                                <div style={{
                                    width: `${leftColWidth}px`,
                                    minWidth: `${leftColWidth}px`,
                                    borderRight: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-card)',
                                    flexShrink: 0,
                                    zIndex: 10,
                                    position: 'sticky',
                                    left: 0
                                }}>
                                    <div style={{
                                        height: `${headerHeight}px`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0 12px',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-panel)',
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        <span>Company &amp; Role</span>
                                        <span>Stage / Days</span>
                                    </div>
                                    <div>
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                style={{
                                                    height: `${rowHeight}px`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '0 12px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    background: hoveredItemId === item.id ? 'var(--bg-panel)' : 'transparent',
                                                    transition: 'background-color 0.15s ease'
                                                }}
                                                onClick={() => openEditJobModal && openEditJobModal(item.id)}
                                                onMouseEnter={() => setHoveredItemId(item.id)}
                                                onMouseLeave={() => setHoveredItemId(null)}
                                            >
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            fontWeight: 700,
                                                            fontSize: '0.78rem',
                                                            color: hoveredItemId === item.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {item.company}
                                                        </span>
                                                        {item.isAlert && (
                                                            <span
                                                                title={item.alertLabel}
                                                                style={{
                                                                    width: '6px',
                                                                    height: '6px',
                                                                    borderRadius: '50%',
                                                                    flexShrink: 0,
                                                                    background: item.alertType === 'ghost' ? '#ef4444' : '#f59e0b'
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                    <p style={{
                                                        fontSize: '0.7rem',
                                                        color: 'var(--text-secondary)',
                                                        margin: 0,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {item.role}
                                                    </p>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        color: item.stageColor,
                                                        backgroundColor: item.stageBg,
                                                        border: `1px solid ${item.stageBorder}`,
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.64rem',
                                                        fontWeight: 700
                                                    }}>
                                                        {item.shortStageLabel}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontFamily: 'monospace',
                                                        color: 'var(--text-secondary)'
                                                    }}>
                                                        {item.durationDays}d
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Horizontally Scrollable Timeline with SVG Swimlanes */}
                                <div style={{
                                    width: `${timelineWidth}px`,
                                    minWidth: `${timelineWidth}px`,
                                    background: 'var(--bg-app)',
                                    position: 'relative',
                                    flex: 1
                                }}>
                                    <svg
                                        ref={timelineSvgRef}
                                        width={timelineWidth}
                                        height={timelineSvgHeight}
                                        style={{
                                            display: 'block',
                                            width: `${timelineWidth}px`,
                                            height: `${timelineSvgHeight}px`,
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none'
                                        }}
                                        aria-label="Gantt chart swimlane graphic"
                                    >
                                        <defs>
                                            {/* Gradients per stage */}
                                            {Object.entries(GANTT_STAGE_META).map(([key, meta]) => (
                                                <linearGradient key={key} id={`gantt-grad-${key}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor={meta.color} stopOpacity="0.85" />
                                                    <stop offset="100%" stopColor={meta.color} stopOpacity="0.55" />
                                                </linearGradient>
                                            ))}
                                            <linearGradient id="today-marker-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                                                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" />
                                            </linearGradient>
                                        </defs>

                                        {/* Background Grid Header */}
                                        <rect
                                            x={0}
                                            y={0}
                                            width={timelineWidth}
                                            height={headerHeight}
                                            style={{ fill: 'var(--bg-panel)' }}
                                        />
                                        <line
                                            x1={0}
                                            y1={headerHeight}
                                            x2={timelineWidth}
                                            y2={headerHeight}
                                            style={{ stroke: 'var(--border-subtle)', strokeWidth: 1 }}
                                        />

                                        {/* Grid Columns & Date Labels */}
                                        {columns.map((col, idx) => {
                                            const x = (col.leftPct / 100) * timelineWidth;
                                            return (
                                                <g key={idx}>
                                                    {/* Vertical Grid Line */}
                                                    <line
                                                        x1={x}
                                                        y1={headerHeight}
                                                        x2={x}
                                                        y2={timelineSvgHeight}
                                                        style={{
                                                            stroke: 'var(--border-subtle)',
                                                            strokeWidth: 1,
                                                            strokeDasharray: '3 3',
                                                            opacity: 0.7
                                                        }}
                                                    />
                                                    {/* Header Tick Label */}
                                                    <text
                                                        x={x + 4}
                                                        y={headerHeight - 12}
                                                        fontSize={10}
                                                        style={{
                                                            fill: 'var(--text-secondary)',
                                                            fontWeight: 500,
                                                            fontFamily: 'sans-serif'
                                                        }}
                                                    >
                                                        {col.label}
                                                    </text>
                                                </g>
                                            );
                                        })}

                                        {/* Today Vertical Line Indicator */}
                                        {todayPercent >= 0 && todayPercent <= 100 && (() => {
                                            const todayX = (todayPercent / 100) * timelineWidth;
                                            return (
                                                <g>
                                                    <line
                                                        x1={todayX}
                                                        y1={headerHeight}
                                                        x2={todayX}
                                                        y2={timelineSvgHeight}
                                                        stroke="#ef4444"
                                                        strokeWidth={1.5}
                                                        strokeDasharray="4 2"
                                                    />
                                                    <rect
                                                        x={Math.max(4, todayX - 22)}
                                                        y={6}
                                                        width={44}
                                                        height={18}
                                                        rx={9}
                                                        fill="#ef4444"
                                                    />
                                                    <text
                                                        x={Math.max(26, todayX)}
                                                        y={19}
                                                        fontSize={9}
                                                        fontWeight={700}
                                                        fill="#ffffff"
                                                        textAnchor="middle"
                                                    >
                                                        TODAY
                                                    </text>
                                                </g>
                                            );
                                        })()}

                                        {/* Horizontal Row Bars */}
                                        {items.map((item, rowIdx) => {
                                            const y = headerHeight + rowIdx * rowHeight;
                                            const barY = y + 8;
                                            const barHeight = 28;
                                            const barX = (item.leftPct / 100) * timelineWidth;
                                            const barW = Math.max(24, (item.widthPct / 100) * timelineWidth);
                                            const isHovered = hoveredItemId === item.id;

                                            return (
                                                <g
                                                    key={item.id}
                                                    onMouseEnter={() => setHoveredItemId(item.id)}
                                                    onMouseLeave={() => setHoveredItemId(null)}
                                                    onClick={() => openEditJobModal && openEditJobModal(item.id)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {/* Row Alternating Highlight */}
                                                    {isHovered && (
                                                        <rect
                                                            x={0}
                                                            y={y}
                                                            width={timelineWidth}
                                                            height={rowHeight}
                                                            style={{ fill: 'var(--bg-panel)', opacity: 0.5 }}
                                                        />
                                                    )}

                                                    {/* Horizontal Guide Line */}
                                                    <line
                                                        x1={0}
                                                        y1={y + rowHeight}
                                                        x2={timelineWidth}
                                                        y2={y + rowHeight}
                                                        style={{ stroke: 'var(--border-subtle)', strokeWidth: 1, opacity: 0.5 }}
                                                    />

                                                    {/* Gantt Bar */}
                                                    <rect
                                                        x={barX}
                                                        y={barY}
                                                        width={barW}
                                                        height={barHeight}
                                                        rx={6}
                                                        fill={`url(#gantt-grad-${item.status})`}
                                                        stroke={item.stageBorder}
                                                        strokeWidth={isHovered ? 2 : 1}
                                                    />

                                                    {/* Inside Bar Label */}
                                                    {barW > 55 && (
                                                        <text
                                                            x={barX + 8}
                                                            y={barY + 18}
                                                            fontSize={11}
                                                            fontWeight={600}
                                                            fill="#ffffff"
                                                            fontFamily="sans-serif"
                                                            style={{ pointerEvents: 'none' }}
                                                        >
                                                            {item.shortStageLabel} · {item.durationDays}d
                                                        </text>
                                                    )}

                                                    {/* Milestone Markers */}
                                                    {item.positionedMilestones.map((m, mIdx) => {
                                                        const mx = (m.posPct / 100) * timelineWidth;
                                                        const my = barY + barHeight / 2;
                                                        const isMilestoneHovered = hoveredMilestone?.id === `${item.id}-${m.id}`;

                                                        return (
                                                            <g
                                                                key={mIdx}
                                                                onMouseEnter={(e) => {
                                                                    e.stopPropagation();
                                                                    setHoveredMilestone({
                                                                        id: `${item.id}-${m.id}`,
                                                                        label: m.label,
                                                                        date: new Date(m.dateMs).toLocaleDateString(),
                                                                        company: item.company,
                                                                        role: item.role
                                                                    });
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.stopPropagation();
                                                                    setHoveredMilestone(null);
                                                                }}
                                                            >
                                                                {m.type === 'applied' && (
                                                                    <circle
                                                                        cx={mx}
                                                                        cy={my}
                                                                        r={isMilestoneHovered ? 6 : 4.5}
                                                                        fill="#ffffff"
                                                                        stroke="#6B7E67"
                                                                        strokeWidth={2}
                                                                    />
                                                                )}
                                                                {m.type === 'interview' && (
                                                                    <polygon
                                                                        points={`${mx},${my - 5} ${mx + 5},${my} ${mx},${my + 5} ${mx - 5},${my}`}
                                                                        fill="#D4A373"
                                                                        stroke="#ffffff"
                                                                        strokeWidth={1.5}
                                                                    />
                                                                )}
                                                                {m.type === 'offer' && (
                                                                    <circle
                                                                        cx={mx}
                                                                        cy={my}
                                                                        r={isMilestoneHovered ? 7 : 5.5}
                                                                        fill="#10b981"
                                                                        stroke="#ffffff"
                                                                        strokeWidth={1.5}
                                                                    />
                                                                )}
                                                                {m.type === 'resolved' && (
                                                                    <rect
                                                                        x={mx - 4}
                                                                        y={my - 4}
                                                                        width={8}
                                                                        height={8}
                                                                        rx={2}
                                                                        fill={m.color}
                                                                        stroke="#ffffff"
                                                                        strokeWidth={1.5}
                                                                    />
                                                                )}
                                                            </g>
                                                        );
                                                    })}

                                                    {/* Alert Indicator on Bar */}
                                                    {item.isAlert && (
                                                        <g>
                                                            <circle
                                                                cx={barX + barW - 6}
                                                                cy={barY + 6}
                                                                r={4}
                                                                fill={item.alertType === 'ghost' ? '#ef4444' : '#f59e0b'}
                                                                stroke="#ffffff"
                                                                strokeWidth={1}
                                                            />
                                                        </g>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>
                            </div>

                            {/* Milestone Legend & Tips Footer */}
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                padding: '12px 16px',
                                background: 'var(--bg-panel)',
                                borderTop: '1px solid var(--border-subtle)',
                                fontSize: '0.74rem',
                                color: 'var(--text-secondary)'
                            }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>Milestone Legend:</strong>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', border: '2px solid #6B7E67', background: '#ffffff', display: 'inline-block' }} />
                                        Applied
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ width: '9px', height: '9px', transform: 'rotate(45deg)', background: '#D4A373', display: 'inline-block' }} />
                                        Interview Loop
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                        Offer Stage
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: '#ef4444', display: 'inline-block' }} />
                                        Terminal / Closed
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontWeight: 600 }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
                                        Stalled (≥10d)
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#f59e0b', fontWeight: 600 }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b' }} />
                                        Follow-Up (5–9d)
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Empty Filtered State */
                        <div style={{
                            padding: '48px 24px',
                            textAlign: 'center',
                            borderRadius: '12px',
                            border: '1px dashed var(--border-subtle)',
                            background: 'var(--bg-panel)'
                        }}>
                            <Clock size={36} color="var(--text-secondary)" style={{ margin: '0 auto 12px auto', opacity: 0.6 }} />
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                                No Applications Match Current Filters
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                                Try clearing your search query or selecting &quot;All Roles&quot; to see full timeline history.
                            </p>
                            {(!jobs || jobs.length === 0) ? (
                                <button
                                    type="button"
                                    onClick={() => openNewJobModal && openNewJobModal()}
                                    className="btn-primary"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '7px 14px',
                                        fontSize: '0.78rem',
                                        borderRadius: '8px'
                                    }}
                                >
                                    <Plus size={14} />
                                    <span>Add First Application</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRange('all');
                                        setStatusFilter('all');
                                        setSearchQuery('');
                                    }}
                                    className="btn-secondary"
                                    style={{
                                        padding: '7px 14px',
                                        fontSize: '0.78rem',
                                        borderRadius: '8px'
                                    }}
                                >
                                    Reset All Filters
                                </button>
                            )}
                        </div>
                    )
                ) : (
                    /* ================= VELOCITY & DIAGNOSTIC INSIGHTS VIEW ================= */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {/* 4 KPI Metric Cards */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                            gap: '12px'
                        }}>
                            {/* Card 1: Pipeline Velocity */}
                            <div style={{
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-panel)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Avg Cycle Duration</span>
                                    <Clock size={16} color="var(--accent-primary)" aria-hidden="true" />
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                    {insights.avgActiveCycleDays}
                                    <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '4px' }}>days active</span>
                                </div>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    Resolved roles average {insights.avgResolvedCycleDays}d to finish
                                </p>
                            </div>

                            {/* Card 2: Callback Velocity */}
                            <div style={{
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-panel)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Callback Velocity</span>
                                    <Zap size={16} color="#10b981" aria-hidden="true" />
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                    ~{insights.avgCallbackVelocityDays}
                                    <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '4px' }}>days</span>
                                </div>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    Average time to first recruiter screening
                                </p>
                            </div>

                            {/* Card 3: Follow-Up Radar */}
                            <div style={{
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-panel)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Action Radar</span>
                                    <AlertTriangle size={16} color="#f59e0b" aria-hidden="true" />
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                    {insights.followupCount + insights.ghostAlertCount}
                                    <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '4px' }}>roles</span>
                                </div>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    {insights.followupCount} follow-ups · {insights.ghostAlertCount} stalled
                                </p>
                            </div>

                            {/* Card 4: In-Flight Pipeline */}
                            <div style={{
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-panel)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Active In-Flight</span>
                                    <Activity size={16} color="var(--accent-secondary)" aria-hidden="true" />
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                    {insights.activeCount}
                                    <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '4px' }}>roles</span>
                                </div>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                    Out of {insights.totalTracked} total applications recorded
                                </p>
                            </div>
                        </div>

                        {/* Stage Duration Breakdown */}
                        <div style={{
                            padding: '18px 20px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-panel)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 3px 0', color: 'var(--text-primary)' }}>
                                        Stage Duration Distribution
                                    </h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                                        Average days applications spend in each recruitment phase
                                    </p>
                                </div>
                                <BarChart3 size={18} color="var(--text-secondary)" />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                                {insights.stageDistribution.map(stage => {
                                    const fillPercent = Math.min(100, Math.round((stage.avgDays / 30) * 100));
                                    return (
                                        <div key={stage.stage} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stage.color, flexShrink: 0 }} />
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stage.label}</span>
                                                    <span style={{ color: 'var(--text-secondary)' }}>({stage.count} {stage.count === 1 ? 'role' : 'roles'})</span>
                                                </div>
                                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {stage.avgDays} days avg
                                                </span>
                                            </div>
                                            <div style={{ width: '100%', height: '7px', borderRadius: '999px', background: 'var(--bg-card)', overflow: 'hidden' }}>
                                                <div
                                                    style={{
                                                        width: `${Math.max(4, fillPercent)}%`,
                                                        height: '100%',
                                                        borderRadius: '999px',
                                                        backgroundColor: stage.color,
                                                        transition: 'width 0.5s ease'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Follow-Up Radar & Attention Cards */}
                        {insights.alertsList.length > 0 && (
                            <div style={{
                                padding: '18px 20px',
                                borderRadius: '12px',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                background: 'rgba(245, 158, 11, 0.06)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <AlertCircle size={18} color="#f59e0b" />
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                        Pipeline Action Radar ({insights.alertsList.length} Roles Need Attention)
                                    </h4>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                                    {insights.alertsList.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => openEditJobModal && openEditJobModal(item.id)}
                                            style={{
                                                padding: '12px 14px',
                                                borderRadius: '10px',
                                                border: '1px solid var(--border-subtle)',
                                                background: 'var(--bg-card)',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        width: '7px',
                                                        height: '7px',
                                                        borderRadius: '50%',
                                                        background: item.alertType === 'ghost' ? '#ef4444' : '#f59e0b'
                                                    }} />
                                                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                        {item.company}
                                                    </strong>
                                                </div>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.64rem',
                                                    fontWeight: 700,
                                                    background: item.alertType === 'ghost' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(245, 158, 11, 0.18)',
                                                    color: item.alertType === 'ghost' ? '#ef4444' : '#f59e0b',
                                                    border: `1px solid ${item.alertType === 'ghost' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                                                }}>
                                                    {item.alertType === 'ghost' ? `Stalled (${item.alertDays}d)` : `Follow-Up (${item.alertDays}d)`}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                                                {item.role} · Current Stage: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.stageLabel}</span>
                                            </p>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontSize: '0.7rem',
                                                color: 'var(--accent-primary)',
                                                fontWeight: 600,
                                                paddingTop: '6px',
                                                borderTop: '1px solid var(--border-subtle)'
                                            }}>
                                                <span>Click to view role &amp; contacts</span>
                                                <ArrowUpRight size={13} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actionable Strategic Recommendations */}
                        {insights.actionableRecommendations?.length > 0 && (
                            <div style={{
                                padding: '18px 20px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-panel)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <Sparkles size={18} color="var(--accent-primary)" />
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                        Strategic Pipeline Recommendations
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {insights.actionableRecommendations.map((rec, rIdx) => {
                                        const toneBorder = rec.tone === 'warning'
                                            ? '#ef4444'
                                            : rec.tone === 'accent'
                                            ? '#f59e0b'
                                            : rec.tone === 'success'
                                            ? '#10b981'
                                            : 'var(--accent-primary)';
                                        const toneBg = rec.tone === 'warning'
                                            ? 'rgba(239, 68, 68, 0.08)'
                                            : rec.tone === 'accent'
                                            ? 'rgba(245, 158, 11, 0.08)'
                                            : rec.tone === 'success'
                                            ? 'rgba(16, 185, 129, 0.08)'
                                            : 'rgba(107, 126, 103, 0.08)';

                                        return (
                                            <div
                                                key={rec.id || rIdx}
                                                style={{
                                                    padding: '12px 14px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border-subtle)',
                                                    borderLeft: `4px solid ${toneBorder}`,
                                                    background: toneBg
                                                }}
                                            >
                                                <h5 style={{ fontSize: '0.78rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                                                    {rec.title}
                                                </h5>
                                                <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                                    {rec.description}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
