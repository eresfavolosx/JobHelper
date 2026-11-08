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
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', callback);
    return () => mq.removeEventListener('change', callback);
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
            aria-label="Application Gantt Chart and Pipeline Velocity"
            className={`w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 md:p-6 shadow-sm text-[var(--foreground)] ${
                prefersReducedMotion ? '' : 'transition-all'
            }`}
        >
            {/* Top Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
                {/* Title & View Switcher */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--primary)]/15 to-[var(--secondary)]/15 text-[var(--primary)] border border-[var(--primary)]/20 shadow-xs">
                        <Timer className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold tracking-tight">Application Timeline & Velocity</h2>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--muted)] text-[var(--muted-foreground)]">
                                {totalVisible} {totalVisible === 1 ? 'role' : 'roles'}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                            Gantt swimlanes, milestone pacing, and stage bottleneck velocity diagnostics
                        </p>
                    </div>

                    {/* View Switcher Tabs */}
                    <div
                        role="tablist"
                        aria-label="View switcher"
                        className="inline-flex p-1 rounded-xl bg-[var(--muted)]/60 border border-[var(--border)] text-xs font-medium ml-0 lg:ml-2"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'gantt'}
                            onClick={() => handleTabChange('gantt')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                activeTab === 'gantt'
                                    ? 'bg-[var(--card)] text-[var(--foreground)] font-semibold shadow-xs'
                                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Timeline Gantt</span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'insights'}
                            onClick={() => handleTabChange('insights')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative ${
                                activeTab === 'insights'
                                    ? 'bg-[var(--card)] text-[var(--foreground)] font-semibold shadow-xs'
                                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                            }`}
                        >
                            <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Velocity Insights</span>
                            {insights.ghostAlertCount + insights.followupCount > 0 && (
                                <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-[var(--card)]" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Action Tools: Time Range, Status, Copy, SVG */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Time Range Pills */}
                    <div
                        role="group"
                        aria-label="Timeline time range"
                        className="inline-flex p-1 rounded-xl bg-[var(--muted)]/60 border border-[var(--border)] text-xs font-medium"
                    >
                        {GANTT_TIME_RANGES.map(r => (
                            <button
                                key={r.id}
                                type="button"
                                aria-pressed={range === r.id}
                                onClick={() => handleRangeChange(r.id)}
                                className={`px-2.5 py-1 rounded-lg transition-all ${
                                    range === r.id
                                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs'
                                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-all shadow-xs"
                    >
                        {copiedSummary ? (
                            <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-all shadow-xs"
                        >
                            <Download className="w-3.5 h-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
                            <span className="hidden sm:inline">Export SVG</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Secondary Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-2">
                {/* Status / Category Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {GANTT_STATUS_FILTERS.map(f => (
                        <button
                            key={f.id}
                            type="button"
                            aria-pressed={statusFilter === f.id}
                            onClick={() => handleStatusFilterChange(f.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                                statusFilter === f.id
                                    ? 'bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--primary)] font-semibold'
                                    : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
                            }`}
                        >
                            {f.label}
                            {f.id === 'alerts' && insights.alertsList.length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                                    {insights.alertsList.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search & Sort */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-48">
                        <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)] absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Filter roles or companies..."
                            aria-label="Filter roles in Gantt"
                            className="w-full pl-8 pr-7 py-1 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        aria-label="Sort Gantt swimlanes"
                        className="py-1 px-2.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                    >
                        {GANTT_SORT_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="mt-4">
                {activeTab === 'gantt' ? (
                    /* ================= GANTT TIMELINE SWIMLANE VIEW ================= */
                    hasData ? (
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden shadow-xs">
                            <div className="flex overflow-x-auto min-w-full">
                                {/* Left Sticky Role Column */}
                                <div
                                    style={{ width: `${leftColWidth}px`, minWidth: `${leftColWidth}px` }}
                                    className="border-r border-[var(--border)] bg-[var(--card)] shrink-0 z-10"
                                >
                                    <div
                                        style={{ height: `${headerHeight}px` }}
                                        className="flex items-center justify-between px-3 border-b border-[var(--border)] bg-[var(--muted)]/50 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider"
                                    >
                                        <span>Company & Role</span>
                                        <span>Stage / Days</span>
                                    </div>
                                    <div className="divide-y divide-[var(--border)]">
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                style={{ height: `${rowHeight}px` }}
                                                onClick={() => openEditJobModal && openEditJobModal(item.id)}
                                                onMouseEnter={() => setHoveredItemId(item.id)}
                                                onMouseLeave={() => setHoveredItemId(null)}
                                                className={`flex items-center justify-between px-3 cursor-pointer group transition-colors ${
                                                    hoveredItemId === item.id ? 'bg-[var(--muted)]/80' : 'hover:bg-[var(--muted)]/40'
                                                }`}
                                            >
                                                <div className="truncate pr-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-xs text-[var(--foreground)] truncate group-hover:text-[var(--primary)] transition-colors">
                                                            {item.company}
                                                        </span>
                                                        {item.isAlert && (
                                                            <span
                                                                title={item.alertLabel}
                                                                className={`w-2 h-2 rounded-full shrink-0 ${
                                                                    item.alertType === 'ghost' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                                                                }`}
                                                            />
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                                                        {item.role}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0 flex items-center gap-1.5">
                                                    <span
                                                        style={{
                                                            color: item.stageColor,
                                                            backgroundColor: item.stageBg,
                                                            borderColor: item.stageBorder
                                                        }}
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold border"
                                                    >
                                                        {item.shortStageLabel}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                                                        {item.durationDays}d
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right Horizontally Scrollable Timeline with SVG Swimlanes */}
                                <div
                                    style={{ width: `${timelineWidth}px`, minWidth: `${timelineWidth}px` }}
                                    className="relative flex-1 bg-[var(--background)] overflow-hidden"
                                >
                                    <svg
                                        ref={timelineSvgRef}
                                        width={timelineWidth}
                                        height={timelineSvgHeight}
                                        className="w-full select-none"
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
                                            fill="var(--card)"
                                            className="border-b border-[var(--border)]"
                                        />
                                        <line
                                            x1={0}
                                            y1={headerHeight}
                                            x2={timelineWidth}
                                            y2={headerHeight}
                                            stroke="var(--border)"
                                            strokeWidth={1}
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
                                                        stroke="var(--border)"
                                                        strokeWidth={1}
                                                        strokeDasharray="3 3"
                                                        opacity={0.6}
                                                    />
                                                    {/* Header Tick Label */}
                                                    <text
                                                        x={x + 4}
                                                        y={headerHeight - 12}
                                                        fontSize={10}
                                                        fill="var(--muted-foreground)"
                                                        fontWeight={500}
                                                        fontFamily="sans-serif"
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
                                                    className="cursor-pointer"
                                                >
                                                    {/* Row Alternating Highlight */}
                                                    {isHovered && (
                                                        <rect
                                                            x={0}
                                                            y={y}
                                                            width={timelineWidth}
                                                            height={rowHeight}
                                                            fill="var(--muted)"
                                                            opacity={0.4}
                                                        />
                                                    )}

                                                    {/* Horizontal Guide Line */}
                                                    <line
                                                        x1={0}
                                                        y1={y + rowHeight}
                                                        x2={timelineWidth}
                                                        y2={y + rowHeight}
                                                        stroke="var(--border)"
                                                        strokeWidth={1}
                                                        opacity={0.4}
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
                                                        className="transition-all"
                                                        filter={isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' : undefined}
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
                                                            className="pointer-events-none drop-shadow-xs"
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
                            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--card)] border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                                <div className="flex flex-wrap items-center gap-4">
                                    <span className="font-semibold text-[var(--foreground)]">Milestone Legend:</span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full border-2 border-[#6B7E67] bg-white inline-block" />
                                        Applied
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rotate-45 bg-[#D4A373] inline-block" />
                                        Interview Loop
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] inline-block" />
                                        Offer Stage
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-xs bg-[#ef4444] inline-block" />
                                        Terminal / Closed
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1 text-red-500 font-medium">
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        Stalled (≥10d)
                                    </span>
                                    <span className="flex items-center gap-1 text-amber-500 font-medium">
                                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                                        Follow-Up (5–9d)
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Empty Filtered State */
                        <div className="p-12 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]">
                            <Clock className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-3 opacity-60" />
                            <h3 className="text-base font-semibold">No Applications Match Current Filters</h3>
                            <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto mt-1 mb-4">
                                Try clearing your search query or selecting &quot;All Roles&quot; to see full timeline history.
                            </p>
                            {(!jobs || jobs.length === 0) ? (
                                <button
                                    type="button"
                                    onClick={() => openNewJobModal && openNewJobModal()}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-sm transition-opacity"
                                >
                                    <Plus className="w-3.5 h-3.5" />
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
                                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-sm transition-opacity"
                                >
                                    Reset All Filters
                                </button>
                            )}
                        </div>
                    )
                ) : (
                    /* ================= VELOCITY & DIAGNOSTIC INSIGHTS VIEW ================= */
                    <div className="space-y-6">
                        {/* 4 KPI Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {/* Card 1: Pipeline Velocity */}
                            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xs">
                                <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
                                    <span className="text-xs font-medium">Avg Cycle Duration</span>
                                    <Clock className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
                                </div>
                                <div className="text-2xl font-bold font-mono tracking-tight text-[var(--foreground)]">
                                    {insights.avgActiveCycleDays}
                                    <span className="text-xs font-normal text-[var(--muted-foreground)] ml-1">days active</span>
                                </div>
                                <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                                    Resolved roles average {insights.avgResolvedCycleDays}d to finish
                                </p>
                            </div>

                            {/* Card 2: Callback Velocity */}
                            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xs">
                                <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
                                    <span className="text-xs font-medium">Callback Velocity</span>
                                    <Zap className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                                </div>
                                <div className="text-2xl font-bold font-mono tracking-tight text-[var(--foreground)]">
                                    ~{insights.avgCallbackVelocityDays}
                                    <span className="text-xs font-normal text-[var(--muted-foreground)] ml-1">days</span>
                                </div>
                                <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                                    Average time to first recruiter screening
                                </p>
                            </div>

                            {/* Card 3: Follow-Up Radar */}
                            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xs">
                                <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
                                    <span className="text-xs font-medium">Action Radar</span>
                                    <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
                                </div>
                                <div className="text-2xl font-bold font-mono tracking-tight text-[var(--foreground)]">
                                    {insights.followupCount + insights.ghostAlertCount}
                                    <span className="text-xs font-normal text-[var(--muted-foreground)] ml-1">roles</span>
                                </div>
                                <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                                    {insights.followupCount} follow-ups · {insights.ghostAlertCount} stalled
                                </p>
                            </div>

                            {/* Card 4: In-Flight Pipeline */}
                            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xs">
                                <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
                                    <span className="text-xs font-medium">Active In-Flight</span>
                                    <Activity className="w-4 h-4 text-[var(--secondary)]" aria-hidden="true" />
                                </div>
                                <div className="text-2xl font-bold font-mono tracking-tight text-[var(--foreground)]">
                                    {insights.activeCount}
                                    <span className="text-xs font-normal text-[var(--muted-foreground)] ml-1">roles</span>
                                </div>
                                <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                                    Out of {insights.totalTracked} total applications recorded
                                </p>
                            </div>
                        </div>

                        {/* Stage Duration Breakdown */}
                        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xs">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-sm font-bold">Stage Duration Distribution</h3>
                                    <p className="text-xs text-[var(--muted-foreground)]">
                                        Average days applications spend in each recruitment phase
                                    </p>
                                </div>
                                <BarChart3 className="w-4 h-4 text-[var(--muted-foreground)]" />
                            </div>

                            <div className="space-y-3 pt-2">
                                {insights.stageDistribution.map(stage => {
                                    // Scale to max 30 days
                                    const fillPercent = Math.min(100, Math.round((stage.avgDays / 30) * 100));
                                    return (
                                        <div key={stage.stage} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        style={{ backgroundColor: stage.color }}
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                    />
                                                    <span className="font-medium text-[var(--foreground)]">{stage.label}</span>
                                                    <span className="text-[var(--muted-foreground)]">({stage.count} {stage.count === 1 ? 'role' : 'roles'})</span>
                                                </div>
                                                <span className="font-mono font-semibold text-[var(--foreground)]">
                                                    {stage.avgDays} days avg
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                                                <div
                                                    style={{
                                                        width: `${Math.max(4, fillPercent)}%`,
                                                        backgroundColor: stage.color
                                                    }}
                                                    className="h-full rounded-full transition-all duration-500"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Follow-Up Radar & Attention Cards */}
                        {insights.alertsList.length > 0 && (
                            <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-xs">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertCircle className="w-4 h-4 text-amber-500" />
                                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                        Pipeline Action Radar ({insights.alertsList.length} Roles Need Attention)
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {insights.alertsList.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => openEditJobModal && openEditJobModal(item.id)}
                                            className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`w-2 h-2 rounded-full ${
                                                            item.alertType === 'ghost' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                                                        }`}
                                                    />
                                                    <span className="font-semibold text-xs text-[var(--foreground)] group-hover:text-[var(--primary)]">
                                                        {item.company}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        item.alertType === 'ghost'
                                                            ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
                                                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                    }`}
                                                >
                                                    {item.alertType === 'ghost' ? `Stalled (${item.alertDays}d)` : `Follow-Up (${item.alertDays}d)`}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--muted-foreground)] mb-2">
                                                {item.role} · Current Stage: <span className="font-medium text-[var(--foreground)]">{item.stageLabel}</span>
                                            </p>
                                            <div className="flex items-center justify-between text-[11px] text-[var(--primary)] font-medium pt-1 border-t border-[var(--border)]">
                                                <span>Click to view role & recruiter contacts</span>
                                                <ArrowUpRight className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actionable Strategic Recommendations */}
                        {insights.actionableRecommendations?.length > 0 && (
                            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xs">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                                    <h3 className="text-sm font-bold">Strategic Pipeline Recommendations</h3>
                                </div>
                                <div className="space-y-2.5">
                                    {insights.actionableRecommendations.map((rec, rIdx) => {
                                        const toneStyles = {
                                            warning: 'border-l-4 border-l-red-500 bg-red-500/5 text-red-950 dark:text-red-200',
                                            accent: 'border-l-4 border-l-amber-500 bg-amber-500/5 text-amber-950 dark:text-amber-200',
                                            success: 'border-l-4 border-l-emerald-500 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200',
                                            info: 'border-l-4 border-l-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]'
                                        };
                                        return (
                                            <div
                                                key={rec.id || rIdx}
                                                className={`p-3.5 rounded-r-xl border border-[var(--border)] ${
                                                    toneStyles[rec.tone] || toneStyles.info
                                                }`}
                                            >
                                                <h4 className="text-xs font-bold mb-0.5">{rec.title}</h4>
                                                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
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
