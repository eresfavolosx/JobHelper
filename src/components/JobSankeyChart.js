"use client";

import { useMemo, useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
    GitBranch,
    TrendingUp,
    Award,
    CheckCircle2,
    Activity,
    Copy,
    Check,
    Download,
    ExternalLink,
    Sparkles,
    Table,
    X,
    ArrowRight
} from 'lucide-react';
import { useUIStore } from '@/lib/uiStore';
import {
    buildJobSankeyData,
    SANKEY_TIME_RANGES,
    formatPipelineSummaryMarkdown
} from '@/lib/sankey-utils';

const STORAGE_KEY_SANKEY_MODE = 'novujobs_sankey_mode';
const STORAGE_KEY_SANKEY_RANGE = 'novujobs_sankey_range';

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

export default function JobSankeyChart({ jobs, compact = false }) {
    const router = useRouter();
    const openEditJobModal = useUIStore(s => s.openEditJobModal);
    const openNewJobModal = useUIStore(s => s.openNewJobModal);
    const setBoardFilters = useUIStore(s => s.setBoardFilters);

    const prefersReducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot
    );

    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(860);

    const [mode, setMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_SANKEY_MODE);
            if (saved === 'funnel' || saved === 'direct') return saved;
        }
        return 'funnel';
    });

    const [range, setRange] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_SANKEY_RANGE);
            if (saved && SANKEY_TIME_RANGES.some(r => r.id === saved)) return saved;
        }
        return 'all';
    });

    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [hoveredLinkId, setHoveredLinkId] = useState(null);
    const [selectedSelection, setSelectedSelection] = useState(null); // { type: 'node'|'link', id: string }
    const [showTable, setShowTable] = useState(false);
    const [copiedSummary, setCopiedSummary] = useState(false);

    useEffect(() => {
        if (!containerRef.current || typeof window === 'undefined') return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentRect?.width) {
                    setContainerWidth(Math.max(540, Math.floor(entry.contentRect.width)));
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const handleModeChange = (nextMode) => {
        setMode(nextMode);
        setSelectedSelection(null);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(STORAGE_KEY_SANKEY_MODE, nextMode); } catch { /* ignore */ }
        }
    };

    const handleRangeChange = (nextRange) => {
        setRange(nextRange);
        setSelectedSelection(null);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(STORAGE_KEY_SANKEY_RANGE, nextRange); } catch { /* ignore */ }
        }
    };

    const chartHeight = compact ? 330 : 390;

    const sankey = useMemo(() => {
        return buildJobSankeyData(jobs, {
            mode,
            range,
            width: containerWidth,
            height: chartHeight
        });
    }, [jobs, mode, range, containerWidth, chartHeight]);

    const { stats, nodes, links, columns } = sankey;

    // Resolve active inspection target (selected or hovered node/link)
    const activeDetail = useMemo(() => {
        if (hoveredLinkId) {
            const link = links.find(l => l.id === hoveredLinkId);
            if (link) {
                return {
                    type: 'link',
                    id: link.id,
                    title: `${link.sourceLabel} → ${link.targetLabel}`,
                    count: link.value,
                    conversionPct: link.conversionPct,
                    totalPct: link.totalPct,
                    color: link.targetColor,
                    jobs: link.jobs,
                    boardStage: null
                };
            }
        }
        if (hoveredNodeId) {
            const node = nodes.find(n => n.id === hoveredNodeId);
            if (node) {
                return {
                    type: 'node',
                    id: node.id,
                    title: node.label,
                    count: node.value,
                    conversionPct: node.pctOfApplied,
                    totalPct: node.pctOfTotal,
                    color: node.color,
                    jobs: node.jobs,
                    boardStage: node.boardStage
                };
            }
        }
        if (selectedSelection) {
            if (selectedSelection.type === 'link') {
                const link = links.find(l => l.id === selectedSelection.id);
                if (link) {
                    return {
                        type: 'link',
                        id: link.id,
                        title: `${link.sourceLabel} → ${link.targetLabel}`,
                        count: link.value,
                        conversionPct: link.conversionPct,
                        totalPct: link.totalPct,
                        color: link.targetColor,
                        jobs: link.jobs,
                        boardStage: null,
                        pinned: true
                    };
                }
            } else {
                const node = nodes.find(n => n.id === selectedSelection.id);
                if (node) {
                    return {
                        type: 'node',
                        id: node.id,
                        title: node.label,
                        count: node.value,
                        conversionPct: node.pctOfApplied,
                        totalPct: node.pctOfTotal,
                        color: node.color,
                        jobs: node.jobs,
                        boardStage: node.boardStage,
                        pinned: true
                    };
                }
            }
        }
        return null;
    }, [hoveredLinkId, hoveredNodeId, selectedSelection, links, nodes]);

    const handleCopySummary = async () => {
        const md = formatPipelineSummaryMarkdown(stats);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(md);
                setCopiedSummary(true);
                setTimeout(() => setCopiedSummary(false), 2200);
            }
        } catch {
            // ignore clipboard errors
        }
    };

    const handleExportSvg = () => {
        if (!svgRef.current) return;
        try {
            const serializer = new XMLSerializer();
            const rawSvg = serializer.serializeToString(svgRef.current);
            const blob = new Blob([rawSvg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const linkEl = document.createElement('a');
            linkEl.href = url;
            linkEl.download = `novujobs-pipeline-sankey-${new Date().toISOString().slice(0, 10)}.svg`;
            document.body.appendChild(linkEl);
            linkEl.click();
            document.body.removeChild(linkEl);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[Sankey] Failed to export SVG:', err);
        }
    };

    const handleJumpToStageOnBoard = (boardStage) => {
        if (!boardStage) return;
        setBoardFilters({
            boardStageFilter: boardStage,
            boardCompanyFilter: 'all',
            boardLocationFilter: 'all',
            boardQuickFilter: 'all',
            boardSearchQuery: ''
        });
        router.push('/kanban');
    };

    if (!jobs || stats.totalTracked === 0) {
        return (
            <section
                className="card"
                aria-label="Job Pipeline Sankey and Conversion Analytics"
                style={{
                    marginTop: '20px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    textAlign: 'center',
                    minHeight: '220px'
                }}
            >
                <GitBranch size={28} color="var(--accent-primary)" aria-hidden="true" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                    Job Pipeline Sankey &amp; Conversion Stats
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', maxWidth: '460px', margin: 0 }}>
                    Log your first job applications to visualize how opportunities flow across Wishlist, Applied, Screening, Interviews, and Offers.
                </p>
                <button
                    type="button"
                    onClick={() => openNewJobModal('applied')}
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.84rem', borderRadius: '10px' }}
                >
                    Log First Application
                </button>
            </section>
        );
    }

    return (
        <section
            className="card"
            aria-label="Job Search Pipeline Sankey Diagram and Conversion Statistics"
            style={{
                marginTop: compact ? '14px' : '20px',
                marginBottom: compact ? '16px' : '0',
                padding: compact ? '18px 20px' : '24px'
            }}
        >
            {/* Header Bar: Title, Mode Switcher, Time Filter, & Export Actions */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '14px',
                marginBottom: '18px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <GitBranch size={20} color="var(--accent-primary)" aria-hidden="true" />
                        <h3 style={{
                            fontSize: '1.15rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            margin: 0
                        }}>
                            Pipeline Flow Sankey &amp; Success Rate Analytics
                        </h3>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.72rem',
                            padding: '3px 9px',
                            borderRadius: '9999px',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: 'var(--success)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            fontWeight: 700
                        }}>
                            <Sparkles size={11} aria-hidden="true" />
                            {stats.totalTracked} Tracked · {stats.totalApplied} Applied
                        </span>
                    </div>
                    <p style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        marginTop: '4px',
                        marginBottom: 0
                    }}>
                        Interactive conversion flow across your job search stages. Hover or click any stage or ribbon to inspect roles and conversion rates.
                    </p>
                </div>

                {/* Controls Cluster */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap'
                }}>
                    {/* View Mode Switcher */}
                    <div
                        role="group"
                        aria-label="Sankey flow mode"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '3px',
                            gap: '2px'
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => handleModeChange('funnel')}
                            aria-pressed={mode === 'funnel'}
                            title="Progressive multi-stage conversion funnel"
                            style={{
                                border: 'none',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                fontWeight: mode === 'funnel' ? 700 : 500,
                                cursor: 'pointer',
                                backgroundColor: mode === 'funnel' ? 'var(--accent-primary)' : 'transparent',
                                color: mode === 'funnel' ? '#ffffff' : 'var(--text-secondary)',
                                transition: prefersReducedMotion ? 'none' : 'all 0.15s ease'
                            }}
                        >
                            Conversion Funnel
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeChange('direct')}
                            aria-pressed={mode === 'direct'}
                            title="Direct breakdown by current Kanban stage"
                            style={{
                                border: 'none',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                fontWeight: mode === 'direct' ? 700 : 500,
                                cursor: 'pointer',
                                backgroundColor: mode === 'direct' ? 'var(--accent-primary)' : 'transparent',
                                color: mode === 'direct' ? '#ffffff' : 'var(--text-secondary)',
                                transition: prefersReducedMotion ? 'none' : 'all 0.15s ease'
                            }}
                        >
                            Stage Breakdown
                        </button>
                    </div>

                    {/* Time Horizon Filter */}
                    <div
                        role="group"
                        aria-label="Sankey time range"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '3px',
                            gap: '2px'
                        }}
                    >
                        {SANKEY_TIME_RANGES.map(item => {
                            const active = range === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleRangeChange(item.id)}
                                    aria-pressed={active}
                                    style={{
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '5px 8px',
                                        fontSize: '0.74rem',
                                        fontWeight: active ? 700 : 500,
                                        cursor: 'pointer',
                                        backgroundColor: active ? 'rgba(59, 130, 246, 0.16)' : 'transparent',
                                        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Table Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowTable(prev => !prev)}
                        aria-pressed={showTable}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px' }}
                        title="Toggle tabular conversion breakdown"
                    >
                        <Table size={14} aria-hidden="true" />
                        <span>{showTable ? 'Hide Table' : 'Stats Table'}</span>
                    </button>

                    {/* Copy Summary */}
                    <button
                        type="button"
                        onClick={handleCopySummary}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px' }}
                        title="Copy pipeline conversion summary to clipboard"
                    >
                        {copiedSummary ? <Check size={14} color="var(--success)" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                        <span>{copiedSummary ? 'Copied!' : 'Copy Stats'}</span>
                    </button>

                    {/* Export SVG */}
                    <button
                        type="button"
                        onClick={handleExportSvg}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px' }}
                        title="Download Sankey chart as SVG vector image"
                    >
                        <Download size={14} aria-hidden="true" />
                        <span>Export SVG</span>
                    </button>
                </div>
            </div>

            {/* 4 Key Conversion & Success Rate KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
                gap: '12px',
                marginBottom: '18px'
            }}>
                {/* KPI 1: Callback / Screening Rate */}
                <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Callback / Screening Rate
                        </span>
                        <TrendingUp size={15} color="#0ea5e9" aria-hidden="true" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0ea5e9' }}>
                            {stats.rates.screeningRate}%
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            ({stats.screeningReachedCount} of {stats.totalApplied} applied)
                        </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Applications advancing past initial resume screen
                    </span>
                </div>

                {/* KPI 2: Interview Conversion Rate */}
                <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Interview Conversion
                        </span>
                        <Activity size={15} color="#D4A373" aria-hidden="true" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.55rem', fontWeight: 800, color: '#D4A373' }}>
                            {stats.rates.interviewRate}%
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            ({stats.interviewReachedCount} interviewed)
                        </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {stats.screeningReachedCount > 0
                            ? `${stats.rates.screeningToInterviewRate}% of screened roles reached interviews`
                            : `${stats.interviewActiveCount} active interviews right now`}
                    </span>
                </div>

                {/* KPI 3: Offer Success Rate */}
                <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Offer Success Rate
                        </span>
                        <Award size={15} color="#10b981" aria-hidden="true" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.55rem', fontWeight: 800, color: '#10b981' }}>
                            {stats.rates.offerRate}%
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            ({stats.offerReachedCount} {stats.offerReachedCount === 1 ? 'offer' : 'offers'})
                        </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {stats.interviewReachedCount > 0
                            ? `${stats.rates.interviewToOfferRate}% interview-to-offer win rate`
                            : `${stats.acceptedCount} accepted · ${stats.offerPendingCount} pending`}
                    </span>
                </div>

                {/* KPI 4: Active Pipeline & Resolution */}
                <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Active Pipeline vs. Closed
                        </span>
                        <CheckCircle2 size={15} color="var(--accent-primary)" aria-hidden="true" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {stats.activePipelineCount}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            active ({stats.rates.activeRate}% of applied)
                        </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {stats.rejectedTotalCount} rejected ({stats.rates.rejectionRate}%) · {stats.wishlistActiveCount} in wishlist
                    </span>
                </div>
            </div>

            {/* Step-by-Step Stage Conversion Funnel Strip */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                    gap: '8px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '18px'
                }}
                aria-label="Stage-by-stage conversion funnel"
            >
                {stats.stageFunnel.map((stage, idx) => (
                    <div
                        key={stage.id}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                            paddingRight: idx < stats.stageFunnel.length - 1 ? '8px' : 0,
                            borderRight: idx < stats.stageFunnel.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span style={{
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                <span style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '999px',
                                    backgroundColor: stage.color,
                                    display: 'inline-block'
                                }} />
                                {stage.label}
                            </span>
                            <strong style={{ fontSize: '0.88rem', color: stage.color }}>
                                {stage.count}
                            </strong>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '5px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(148, 163, 184, 0.16)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(100, Math.max(stage.count > 0 ? 6 : 0, stage.pctOfApplied))}%`,
                                height: '100%',
                                borderRadius: '999px',
                                backgroundColor: stage.color,
                                transition: prefersReducedMotion ? 'none' : 'width 0.35s ease'
                            }} />
                        </div>
                        <span style={{ fontSize: '0.69rem', color: 'var(--text-secondary)' }}>
                            {stage.stepLabel}
                        </span>
                    </div>
                ))}
            </div>

            {/* Interactive SVG Sankey Diagram */}
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    padding: '12px 8px 8px'
                }}
            >
                <svg
                    ref={svgRef}
                    width={sankey.width}
                    height={sankey.height}
                    viewBox={`0 0 ${sankey.width} ${sankey.height}`}
                    role="img"
                    aria-label={`Sankey diagram showing ${stats.totalTracked} tracked job opportunities across ${columns.length} pipeline stages`}
                    style={{
                        display: 'block',
                        minWidth: '540px',
                        width: `${sankey.width}px`,
                        height: `${sankey.height}px`,
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                    }}
                >
                    <defs>
                        {links.map((link, idx) => (
                            <linearGradient
                                key={`grad-${link.id}-${idx}`}
                                id={`sankey-grad-${idx}`}
                                x1="0%"
                                y1="0%"
                                x2="100%"
                                y2="0%"
                            >
                                <stop offset="0%" stopColor={link.sourceColor} stopOpacity="0.65" />
                                <stop offset="100%" stopColor={link.targetColor} stopOpacity="0.65" />
                            </linearGradient>
                        ))}
                    </defs>

                    {/* Column Stage Headers */}
                    {columns.map(col => {
                        const isFirst = col.index === 0;
                        const isLast = col.index === columns.length - 1;
                        const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                        const labelX = isFirst ? col.x - 8 : isLast ? col.x + 8 : col.x;
                        return (
                            <text
                                key={`col-header-${col.index}`}
                                x={labelX}
                                y={18}
                                textAnchor={anchor}
                                fill="var(--text-secondary, #9DA7AE)"
                                style={{
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    fill: 'var(--text-secondary, #9DA7AE)',
                                    opacity: 0.85,
                                    fontFamily: 'system-ui, -apple-system, sans-serif'
                                }}
                            >
                                {col.title}
                            </text>
                        );
                    })}

                    {/* Cubic-Bézier Flow Ribbons */}
                    <g>
                        {links.map((link, idx) => {
                            const isSelected = selectedSelection?.type === 'link' && selectedSelection.id === link.id;
                            const isHovered = hoveredLinkId === link.id;
                            const isConnectedToNode =
                                hoveredNodeId && (link.source === hoveredNodeId || link.target === hoveredNodeId);
                            const isConnectedToSelectedNode =
                                selectedSelection?.type === 'node' &&
                                (link.source === selectedSelection.id || link.target === selectedSelection.id);

                            const anyHighlightActive = Boolean(hoveredLinkId || hoveredNodeId || selectedSelection);
                            const isHighlighted = isHovered || isSelected || isConnectedToNode || isConnectedToSelectedNode;
                            const opacity = anyHighlightActive
                                ? (isHighlighted ? 0.88 : 0.16)
                                : 0.52;

                            return (
                                <path
                                    key={link.id}
                                    d={link.ribbonPath}
                                    fill={`url(#sankey-grad-${idx})`}
                                    stroke={isHighlighted ? link.targetColor : 'none'}
                                    strokeWidth={isHighlighted ? 1 : 0}
                                    opacity={opacity}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`${link.sourceLabel} to ${link.targetLabel}: ${link.value} ${link.value === 1 ? 'opportunity' : 'opportunities'} (${link.conversionPct}%)`}
                                    style={{
                                        cursor: 'pointer',
                                        outline: 'none',
                                        transition: prefersReducedMotion ? 'none' : 'opacity 0.18s ease'
                                    }}
                                    onMouseEnter={() => setHoveredLinkId(link.id)}
                                    onMouseLeave={() => setHoveredLinkId(null)}
                                    onFocus={() => setHoveredLinkId(link.id)}
                                    onBlur={() => setHoveredLinkId(null)}
                                    onClick={() => {
                                        setSelectedSelection(prev =>
                                            prev?.type === 'link' && prev.id === link.id
                                                ? null
                                                : { type: 'link', id: link.id }
                                        );
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedSelection(prev =>
                                                prev?.type === 'link' && prev.id === link.id
                                                    ? null
                                                    : { type: 'link', id: link.id }
                                            );
                                        }
                                    }}
                                >
                                    <title>{`${link.sourceLabel} → ${link.targetLabel}: ${link.value} (${link.conversionPct}% step conversion · ${link.totalPct}% of total)`}</title>
                                </path>
                            );
                        })}
                    </g>

                    {/* Stage Nodes & Labels */}
                    <g>
                        {nodes.map(node => {
                            const isSelected = selectedSelection?.type === 'node' && selectedSelection.id === node.id;
                            const isHovered = hoveredNodeId === node.id;
                            const isHighlighted = isSelected || isHovered;
                            const isRightSide = node.colIndex === sankey.numCols - 1 && sankey.numCols > 1;
                            const labelX = isRightSide ? node.x0 - 8 : node.x1 + 8;
                            const textAnchor = isRightSide ? 'end' : 'start';
                            const centerY = (node.y0 + node.y1) / 2;

                            return (
                                <g
                                    key={node.id}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`${node.label}: ${node.value} ${node.value === 1 ? 'opportunity' : 'opportunities'} (${node.pctOfTotal}% of tracked)`}
                                    style={{ cursor: 'pointer', outline: 'none' }}
                                    onMouseEnter={() => setHoveredNodeId(node.id)}
                                    onMouseLeave={() => setHoveredNodeId(null)}
                                    onFocus={() => setHoveredNodeId(node.id)}
                                    onBlur={() => setHoveredNodeId(null)}
                                    onClick={() => {
                                        setSelectedSelection(prev =>
                                            prev?.type === 'node' && prev.id === node.id
                                                ? null
                                                : { type: 'node', id: node.id }
                                        );
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedSelection(prev =>
                                                prev?.type === 'node' && prev.id === node.id
                                                    ? null
                                                    : { type: 'node', id: node.id }
                                            );
                                        }
                                    }}
                                >
                                    <title>{`${node.label}: ${node.value} (${node.pctOfTotal}% of tracked)`}</title>
                                    <rect
                                        x={node.x0}
                                        y={node.y0}
                                        width={node.x1 - node.x0}
                                        height={node.height}
                                        rx={5}
                                        ry={5}
                                        fill={node.color}
                                        stroke={isHighlighted ? '#ffffff' : 'rgba(255,255,255,0.22)'}
                                        strokeWidth={isHighlighted ? 2 : 1}
                                    />
                                    <text
                                        x={labelX}
                                        y={centerY - 2}
                                        textAnchor={textAnchor}
                                        fill="var(--text-primary, #FAF8F4)"
                                        style={{
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            fill: 'var(--text-primary, #FAF8F4)',
                                            pointerEvents: 'none',
                                            fontFamily: 'system-ui, -apple-system, sans-serif'
                                        }}
                                    >
                                        {node.label}
                                    </text>
                                    <text
                                        x={labelX}
                                        y={centerY + 12}
                                        textAnchor={textAnchor}
                                        fill="var(--text-secondary, #9DA7AE)"
                                        style={{
                                            fontSize: '10.5px',
                                            fontWeight: 600,
                                            fill: 'var(--text-secondary, #9DA7AE)',
                                            pointerEvents: 'none',
                                            fontFamily: 'system-ui, -apple-system, sans-serif'
                                        }}
                                    >
                                        {node.value} ({node.pctOfTotal}%)
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </svg>
            </div>

            {/* Interactive Flow / Node Inspector Panel (when hovering or clicking a node/ribbon) */}
            {activeDetail && (
                <div
                    role="region"
                    aria-live="polite"
                    aria-label="Selected Sankey Stage Details"
                    style={{
                        marginTop: '14px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: 'var(--bg-card)',
                        border: `1px solid ${activeDetail.color || 'var(--accent-primary)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '999px',
                                backgroundColor: activeDetail.color || 'var(--accent-primary)'
                            }} />
                            <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                {activeDetail.title}
                            </strong>
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'rgba(59, 130, 246, 0.14)',
                                color: 'var(--accent-primary)'
                            }}>
                                {activeDetail.count} {activeDetail.count === 1 ? 'role' : 'roles'} · {activeDetail.conversionPct}% conversion · {activeDetail.totalPct}% of total
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {activeDetail.boardStage && (
                                <button
                                    type="button"
                                    onClick={() => handleJumpToStageOnBoard(activeDetail.boardStage)}
                                    className="btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '0.74rem', borderRadius: '8px' }}
                                >
                                    <span>Open Stage on Board</span>
                                    <ExternalLink size={12} aria-hidden="true" />
                                </button>
                            )}
                            {selectedSelection && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedSelection(null)}
                                    aria-label="Clear stage selection"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '4px'
                                    }}
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Matching Job Role Pills */}
                    {Array.isArray(activeDetail.jobs) && activeDetail.jobs.length > 0 && (
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            maxHeight: '115px',
                            overflowY: 'auto'
                        }}>
                            {activeDetail.jobs.slice(0, 18).map(job => (
                                <button
                                    key={job.id}
                                    type="button"
                                    onClick={() => openEditJobModal(job)}
                                    title={`Inspect or edit ${job.role || job.title || 'Role'} at ${job.company || 'Company'}`}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '999px',
                                        fontSize: '0.74rem',
                                        fontWeight: 600,
                                        backgroundColor: 'var(--bg-panel)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <span style={{ fontWeight: 700 }}>{job.company || 'Company'}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>·</span>
                                    <span style={{
                                        maxWidth: '180px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {job.role || job.title || 'Role'}
                                    </span>
                                </button>
                            ))}
                            {activeDetail.jobs.length > 18 && (
                                <span style={{
                                    fontSize: '0.73rem',
                                    color: 'var(--text-secondary)',
                                    alignSelf: 'center',
                                    paddingLeft: '4px'
                                }}>
                                    +{activeDetail.jobs.length - 18} more
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Accessible Tabular Conversion Breakdown (Toggled via Stats Table button) */}
            {showTable && (
                <div style={{
                    marginTop: '14px',
                    overflowX: 'auto',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)'
                }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.8rem',
                        textAlign: 'left'
                    }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '10px 12px' }}>Flow Transition (Source → Target)</th>
                                <th style={{ padding: '10px 12px' }}>Opportunities</th>
                                <th style={{ padding: '10px 12px' }}>Step Conversion</th>
                                <th style={{ padding: '10px 12px' }}>% of Total Tracked</th>
                            </tr>
                        </thead>
                        <tbody>
                            {links.map(link => (
                                <tr key={`row-${link.id}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <span>{link.sourceLabel}</span>
                                            <ArrowRight size={13} color="var(--text-secondary)" aria-hidden="true" />
                                            <span style={{ color: link.targetColor }}>{link.targetLabel}</span>
                                        </span>
                                    </td>
                                    <td style={{ padding: '9px 12px', fontWeight: 700 }}>{link.value}</td>
                                    <td style={{ padding: '9px 12px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                        {link.conversionPct}%
                                    </td>
                                    <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>
                                        {link.totalPct}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Diagnostic Insights Footer */}
            {stats.insights.length > 0 && (
                <div style={{
                    marginTop: '14px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {stats.insights.map((item, idx) => (
                            <p
                                key={idx}
                                style={{
                                    margin: 0,
                                    fontSize: '0.78rem',
                                    color: item.tone === 'success'
                                        ? 'var(--success)'
                                        : item.tone === 'accent'
                                            ? 'var(--accent-primary)'
                                            : 'var(--text-secondary)',
                                    fontWeight: item.tone === 'success' ? 600 : 500
                                }}
                            >
                                • {item.text}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
