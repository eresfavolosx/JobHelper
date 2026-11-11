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
    Table,
    X,
    ArrowRight,
    ArrowDown,
    ChevronDown,
    ChevronUp,
    ListTree,
    Send,
    MessageSquare,
    Users,
    Briefcase,
    Layers
} from 'lucide-react';
import { useUIStore } from '@/lib/uiStore';
import { useAppStore } from '@/lib/store';
import { resolveCyclesFromJobs, filterJobsByCycle, getActiveCycle } from '@/lib/cycle-utils';
import {
    buildJobSankeyData,
    SANKEY_TIME_RANGES,
    formatPipelineSummaryMarkdown,
    classifyJobProgression,
    filterJobsForSankey
} from '@/lib/sankey-utils';

const STORAGE_KEY_SANKEY_MODE = 'novujobs_sankey_mode';
const STORAGE_KEY_SANKEY_RANGE = 'novujobs_sankey_range';
const STORAGE_KEY_SANKEY_FORMAT = 'novujobs_sankey_format';

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

    const rawJobs = useAppStore(state => state.jobs);
    const storeCycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const setSelectedCycleId = useAppStore(state => state.setSelectedCycleId);

    // Resolve search cycles and filter jobs
    const sourceJobs = useMemo(() => jobs || rawJobs || [], [jobs, rawJobs]);
    const cycles = useMemo(() => resolveCyclesFromJobs(rawJobs || sourceJobs, storeCycles), [rawJobs, sourceJobs, storeCycles]);
    const activeCycle = useMemo(() => getActiveCycle(cycles), [cycles]);
    const cycleFilteredJobs = useMemo(() => filterJobsByCycle(sourceJobs, cycles, selectedCycleId), [sourceJobs, cycles, selectedCycleId]);

    const prefersReducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot
    );

    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(860);

    const [layoutFormat, setLayoutFormat] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY_SANKEY_FORMAT);
            if (saved === 'flow' || saved === 'diagram') return saved;
        }
        return 'auto';
    });

    const isMobile = containerWidth < 700;
    const activeFormat = layoutFormat === 'auto' ? (isMobile ? 'flow' : 'diagram') : layoutFormat;

    const handleFormatChange = (fmt) => {
        setLayoutFormat(fmt);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(STORAGE_KEY_SANKEY_FORMAT, fmt); } catch { /* ignore */ }
        }
    };

    const [expandedStages, setExpandedStages] = useState({
        applied: false,
        screening: false,
        interview: false,
        offer: false,
        wishlist: false
    });

    const toggleStage = (stageKey) => {
        setExpandedStages(prev => ({ ...prev, [stageKey]: !prev[stageKey] }));
    };

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
                    setContainerWidth(Math.floor(entry.contentRect.width));
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

    const chartHeight = compact ? 420 : 480;
    const chartWidth = Math.max(1120, containerWidth);

    const sankey = useMemo(() => {
        return buildJobSankeyData(cycleFilteredJobs, {
            mode,
            range,
            width: chartWidth,
            height: chartHeight
        });
    }, [cycleFilteredJobs, mode, range, chartWidth, chartHeight]);

    // Categorized job roles per funnel stage for mobile cards inspection
    const stageRoles = useMemo(() => {
        if (!cycleFilteredJobs || !Array.isArray(cycleFilteredJobs)) {
            return { wishlist: [], applied: [], screening: [], interview: [], offer: [] };
        }
        const filtered = filterJobsForSankey(cycleFilteredJobs, { range });
        const wishlist = [];
        const applied = [];
        const screening = [];
        const interview = [];
        const offer = [];

        for (const job of filtered) {
            const prog = classifyJobProgression(job);
            if (prog.isWishlistOnly) {
                wishlist.push(job);
            } else {
                applied.push(job);
                if (prog.reachedScreening) screening.push(job);
                if (prog.reachedInterview) interview.push(job);
                if (prog.reachedOffer) offer.push(job);
            }
        }
        return { wishlist, applied, screening, interview, offer };
    }, [cycleFilteredJobs, range]);

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

    const renderMobileFlowCards = () => {
        const stageList = [
            {
                key: 'applied',
                title: '1. Applications Submitted',
                count: stats.totalApplied,
                subText: `${stats.activePipelineCount} active · ${stats.screeningReachedCount} advanced · ${stats.rejectedEarlyCount + stats.archivedEarlyCount} dropped early`,
                color: '#6B7E67',
                pct: 100,
                icon: Send,
                roles: stageRoles.applied,
                badge: '100% of pipeline',
                boardStage: 'applied'
            },
            {
                key: 'screening',
                title: '2. Initial Screening & Recruiter Calls',
                count: stats.screeningReachedCount,
                subText: `${stats.screeningActiveCount} active now · ${stats.interviewReachedCount} moved to interviews`,
                color: '#0ea5e9',
                pct: stats.rates.screeningRate,
                icon: MessageSquare,
                roles: stageRoles.screening,
                badge: `${stats.rates.screeningRate}% callback rate`,
                boardStage: 'screening'
            },
            {
                key: 'interview',
                title: '3. Technical & Team Interviews',
                count: stats.interviewReachedCount,
                subText: `${stats.interviewActiveCount} active loops · ${stats.offerReachedCount} reached offer`,
                color: '#D4A373',
                pct: stats.rates.interviewRate,
                icon: Users,
                roles: stageRoles.interview,
                badge: `${stats.rates.interviewRate}% of applied`,
                boardStage: 'interviewing'
            },
            {
                key: 'offer',
                title: '4. Job Offers & Outcomes',
                count: stats.offerReachedCount,
                subText: `${stats.acceptedCount} accepted 🎉 · ${stats.offerPendingCount} pending decision`,
                color: '#10b981',
                pct: stats.rates.offerRate,
                icon: Award,
                roles: stageRoles.offer,
                badge: `${stats.rates.offerRate}% win rate`,
                boardStage: 'offer'
            }
        ];

        const bridges = [
            {
                rate: `${stats.rates.screeningRate}% Callback Rate`,
                detail: `${stats.screeningReachedCount} of ${stats.totalApplied} reached screening · ${stats.rejectedEarlyCount + stats.archivedEarlyCount} dropped early`,
                color: '#0ea5e9'
            },
            {
                rate: `${stats.rates.screeningToInterviewRate}% Screen-to-Interview`,
                detail: `${stats.interviewReachedCount} of ${stats.screeningReachedCount} advanced to loops`,
                color: '#D4A373'
            },
            {
                rate: `${stats.rates.interviewToOfferRate}% Interview Win Rate`,
                detail: `${stats.offerReachedCount} won of ${stats.interviewReachedCount} interviewed`,
                color: '#10b981'
            }
        ];

        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    width: '100%'
                }}
            >
                {/* Optional Wishlist Card */}
                {stageRoles.wishlist.length > 0 && (
                    <div style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        marginBottom: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Briefcase size={16} color="var(--text-secondary)" />
                                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                    Wishlist (Saved Opportunities)
                                </strong>
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                                {stageRoles.wishlist.length} saved
                            </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Roles in research or waiting to be applied.
                        </p>
                    </div>
                )}

                {/* Progressive Flow Stage Cards */}
                {stageList.map((stg, idx) => {
                    const Icon = stg.icon;
                    const isExpanded = expandedStages[stg.key];
                    const bridge = bridges[idx];

                    return (
                        <div key={stg.key} style={{ display: 'flex', flexDirection: 'column' }}>
                            {/* The Stage Card */}
                            <div style={{
                                padding: '14px 16px',
                                borderRadius: '12px',
                                background: 'var(--bg-card)',
                                border: `1px solid ${isExpanded ? stg.color : 'var(--border-subtle)'}`,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                                transition: prefersReducedMotion ? 'none' : 'border-color 0.15s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <div style={{
                                            padding: '6px',
                                            borderRadius: '8px',
                                            backgroundColor: `rgba(${stg.color === '#6B7E67' ? '107, 126, 103' : stg.color === '#0ea5e9' ? '14, 165, 233' : stg.color === '#D4A373' ? '212, 163, 115' : '16, 185, 129'}, 0.16)`,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Icon size={16} color={stg.color} />
                                        </div>
                                        <div>
                                            <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                                {stg.title}
                                            </strong>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                                                {stg.subText}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: stg.color }}>
                                            {stg.count}
                                        </div>
                                        <span style={{
                                            fontSize: '0.68rem',
                                            padding: '2px 6px',
                                            borderRadius: '999px',
                                            background: 'var(--bg-panel)',
                                            color: 'var(--text-secondary)',
                                            fontWeight: 600
                                        }}>
                                            {stg.badge}
                                        </span>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div style={{
                                    width: '100%',
                                    height: '6px',
                                    borderRadius: '999px',
                                    backgroundColor: 'rgba(148, 163, 184, 0.16)',
                                    overflow: 'hidden',
                                    margin: '10px 0 8px 0'
                                }}>
                                    <div style={{
                                        width: `${Math.min(100, Math.max(stg.count > 0 ? 5 : 0, stg.pct))}%`,
                                        height: '100%',
                                        borderRadius: '999px',
                                        backgroundColor: stg.color,
                                        transition: prefersReducedMotion ? 'none' : 'width 0.35s ease'
                                    }} />
                                </div>

                                {/* Drawer Toggle & Board Link */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingTop: '4px'
                                }}>
                                    {stg.roles.length > 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleStage(stg.key)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                padding: '4px 0',
                                                fontSize: '0.74rem',
                                                fontWeight: 700,
                                                color: stg.color,
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <span>{isExpanded ? 'Hide Roles' : `Inspect ${stg.roles.length} ${stg.roles.length === 1 ? 'Role' : 'Roles'}`}</span>
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                            No active roles in this stage
                                        </span>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => handleJumpToStageOnBoard(stg.boardStage)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: '4px 0',
                                            fontSize: '0.72rem',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                        }}
                                    >
                                        <span>Board</span>
                                        <ExternalLink size={11} />
                                    </button>
                                </div>

                                {/* Expanded Roles Drawer */}
                                {isExpanded && stg.roles.length > 0 && (
                                    <div style={{
                                        marginTop: '10px',
                                        paddingTop: '10px',
                                        borderTop: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        {stg.roles.map(job => (
                                            <div
                                                key={job.id}
                                                onClick={() => openEditJobModal(job)}
                                                role="button"
                                                tabIndex={0}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '8px 10px',
                                                    borderRadius: '8px',
                                                    backgroundColor: 'var(--bg-panel)',
                                                    border: '1px solid var(--border-subtle)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                                                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{job.company}</strong>
                                                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {job.role || job.title || 'Role'}
                                                    </p>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                    {job.salary && (
                                                        <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '2px 5px', borderRadius: '4px' }}>
                                                            {job.salary}
                                                        </span>
                                                    )}
                                                    <ExternalLink size={12} color="var(--text-secondary)" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Downward Conversion Bridge */}
                            {bridge && idx < stageList.length - 1 && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: '6px 0'
                                }}>
                                    <div style={{ width: '2px', height: '10px', background: 'var(--border-subtle)' }} />
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 12px',
                                        borderRadius: '999px',
                                        backgroundColor: 'var(--bg-panel)',
                                        border: `1px solid ${bridge.color}`,
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        color: bridge.color,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}>
                                        <ArrowDown size={12} />
                                        <span>{bridge.rate}</span>
                                    </div>
                                    <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        {bridge.detail}
                                    </span>
                                    <div style={{ width: '2px', height: '10px', background: 'var(--border-subtle)' }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <section
            ref={containerRef}
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
                            <Layers size={11} aria-hidden="true" />
                            <span>
                                {selectedCycleId === 'all'
                                    ? `All Cycles · ${stats.totalTracked} Tracked · ${stats.totalApplied} Applied`
                                    : `${(cycles.find(c => c.id === selectedCycleId) || (selectedCycleId === 'active' ? activeCycle : null))?.name || 'Active Cycle'} · ${stats.totalTracked} Tracked · ${stats.totalApplied} Applied`}
                            </span>
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
                    {/* Search Cycle Selector */}
                    {cycles.length > 0 && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Layers size={13} color="var(--accent-primary)" />
                            <select
                                value={selectedCycleId === 'active' && activeCycle ? activeCycle.id : selectedCycleId}
                                onChange={e => setSelectedCycleId(e.target.value)}
                                aria-label="Filter Sankey by job search cycle"
                                style={{
                                    padding: '5px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="all" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                    All Cycles ({(rawJobs || sourceJobs).filter(j => j && j.status !== 'deleted').length})
                                </option>
                                {cycles.map(c => {
                                    const count = filterJobsByCycle(rawJobs || sourceJobs, cycles, c.id).length;
                                    return (
                                        <option key={c.id} value={c.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                            {c.name || `Cycle ${c.cycleNumber || 1}`} ({count})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {/* Layout View Format Switcher: Mobile Cards vs Diagram */}
                    <div
                        role="group"
                        aria-label="Sankey layout format"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: 'var(--bg-panel)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '3px',
                            gap: '2px'
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => handleFormatChange('flow')}
                            aria-pressed={activeFormat === 'flow'}
                            title="Mobile-optimized progressive flow cards"
                            style={{
                                border: 'none',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                fontWeight: activeFormat === 'flow' ? 700 : 500,
                                cursor: 'pointer',
                                backgroundColor: activeFormat === 'flow' ? 'var(--accent-primary)' : 'transparent',
                                color: activeFormat === 'flow' ? '#ffffff' : 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: prefersReducedMotion ? 'none' : 'all 0.15s ease'
                            }}
                        >
                            <ListTree size={13} aria-hidden="true" />
                            <span>Flow Cards</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFormatChange('diagram')}
                            aria-pressed={activeFormat === 'diagram'}
                            title="Full 5-column Sankey ribbon diagram"
                            style={{
                                border: 'none',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '0.75rem',
                                fontWeight: activeFormat === 'diagram' ? 700 : 500,
                                cursor: 'pointer',
                                backgroundColor: activeFormat === 'diagram' ? 'var(--accent-primary)' : 'transparent',
                                color: activeFormat === 'diagram' ? '#ffffff' : 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: prefersReducedMotion ? 'none' : 'all 0.15s ease'
                            }}
                        >
                            <GitBranch size={13} aria-hidden="true" />
                            <span>Diagram (SVG)</span>
                        </button>
                    </div>

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

            {/* 4 Key Conversion & Success Rate KPI Cards (2x2 grid on mobile) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: containerWidth < 540 ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(195px, 1fr))',
                gap: containerWidth < 540 ? '8px' : '12px',
                marginBottom: '18px'
            }}>
                {/* KPI 1: Callback / Screening Rate */}
                <div style={{
                    padding: containerWidth < 540 ? '10px 12px' : '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: containerWidth < 540 ? '0.7rem' : '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Callback Rate
                        </span>
                        <TrendingUp size={15} color="#0ea5e9" aria-hidden="true" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: containerWidth < 540 ? '1.35rem' : '1.55rem', fontWeight: 800, color: '#0ea5e9' }}>
                            {stats.rates.screeningRate}%
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            ({stats.screeningReachedCount}/{stats.totalApplied})
                        </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        Advancing past initial screen
                    </span>
                </div>

                {/* KPI 2: Interview Conversion Rate */}
                <div style={{
                    padding: containerWidth < 540 ? '10px 12px' : '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: containerWidth < 540 ? '0.7rem' : '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Interview Conversion
                        </span>
                        <Activity size={15} color="#D4A373" aria-hidden="true" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: containerWidth < 540 ? '1.35rem' : '1.55rem', fontWeight: 800, color: '#D4A373' }}>
                            {stats.rates.interviewRate}%
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            ({stats.interviewReachedCount} roles)
                        </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        {stats.screeningReachedCount > 0
                            ? `${stats.rates.screeningToInterviewRate}% of screened roles`
                            : `${stats.interviewActiveCount} active`}
                    </span>
                </div>

                {/* KPI 3: Offer Success Rate */}
                <div style={{
                    padding: containerWidth < 540 ? '10px 12px' : '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: containerWidth < 540 ? '0.7rem' : '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Offer Win Rate
                        </span>
                        <Award size={15} color="#10b981" aria-hidden="true" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: containerWidth < 540 ? '1.35rem' : '1.55rem', fontWeight: 800, color: '#10b981' }}>
                            {stats.rates.offerRate}%
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            ({stats.offerReachedCount} {stats.offerReachedCount === 1 ? 'offer' : 'offers'})
                        </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        {stats.interviewReachedCount > 0
                            ? `${stats.rates.interviewToOfferRate}% interview win rate`
                            : `${stats.acceptedCount} accepted`}
                    </span>
                </div>

                {/* KPI 4: Active Pipeline & Resolution */}
                <div style={{
                    padding: containerWidth < 540 ? '10px 12px' : '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: containerWidth < 540 ? '0.7rem' : '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Active Pipeline
                        </span>
                        <CheckCircle2 size={15} color="var(--accent-primary)" aria-hidden="true" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: containerWidth < 540 ? '1.35rem' : '1.55rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {stats.activePipelineCount}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            active ({stats.rates.activeRate}%)
                        </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        {stats.rejectedTotalCount} rejected · {stats.wishlistActiveCount} in wishlist
                    </span>
                </div>
            </div>

            {/* Step-by-Step Stage Conversion Funnel Strip (Horizontal swipe rail on mobile) */}
            <div
                style={{
                    display: containerWidth < 680 ? 'flex' : 'grid',
                    overflowX: containerWidth < 680 ? 'auto' : 'visible',
                    WebkitOverflowScrolling: 'touch',
                    gridTemplateColumns: containerWidth < 680 ? 'none' : 'repeat(auto-fit, minmax(135px, 1fr))',
                    gap: '8px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '18px',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box'
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
                            flex: containerWidth < 680 ? '0 0 135px' : '1',
                            paddingRight: idx < stats.stageFunnel.length - 1 ? '8px' : 0,
                            borderRight: idx < stats.stageFunnel.length - 1 && containerWidth >= 680 ? '1px solid var(--border-subtle)' : 'none'
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

            {/* Interactive View: Flow Cards or Full Diagram */}
            {activeFormat === 'flow' ? (
                renderMobileFlowCards()
            ) : (
                <div
                    style={{
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        borderRadius: '12px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        padding: '12px 8px 8px'
                    }}
                >
                    {isMobile && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            marginBottom: '8px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(107, 126, 103, 0.12)',
                            border: '1px solid rgba(107, 126, 103, 0.25)',
                            fontSize: '0.73rem',
                            color: 'var(--text-secondary)'
                        }}>
                            <span>👉 Swipe horizontally to view all 5 columns</span>
                        </div>
                    )}
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
                            return (
                                <text
                                    key={`col-header-${col.index}`}
                                    x={col.x}
                                    y={20}
                                    textAnchor="middle"
                                    fill="var(--text-secondary, #9DA7AE)"
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        fill: 'var(--text-secondary, #9DA7AE)',
                                        opacity: 0.9,
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
                                const labelX = node.labelX ?? (node.x1 + 10);
                                const textAnchor = node.textAnchor ?? 'start';
                                const labelY = node.labelY ?? (node.y0 + node.y1) / 2;

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
                                            rx={4}
                                            ry={4}
                                            fill={node.color}
                                            stroke={isHighlighted ? '#ffffff' : 'rgba(255,255,255,0.22)'}
                                            strokeWidth={isHighlighted ? 2 : 1}
                                        />
                                        {node.lines && node.lines.length > 1 ? (
                                            <>
                                                {node.lines.map((line, lIdx) => (
                                                    <text
                                                        key={lIdx}
                                                        x={labelX}
                                                        y={labelY - (node.lines.length === 2 ? 10 : 16) + lIdx * 14}
                                                        textAnchor={textAnchor}
                                                        stroke="var(--bg-card, #1c1d1f)"
                                                        strokeWidth={3.5}
                                                        strokeLinejoin="round"
                                                        fill="var(--text-primary, #FAF8F4)"
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            fill: 'var(--text-primary, #FAF8F4)',
                                                            pointerEvents: 'none',
                                                            fontFamily: 'system-ui, -apple-system, sans-serif',
                                                            paintOrder: 'stroke fill'
                                                        }}
                                                    >
                                                        {line}
                                                    </text>
                                                ))}
                                                <text
                                                    x={labelX}
                                                    y={labelY + (node.lines.length === 2 ? 18 : 22)}
                                                    textAnchor={textAnchor}
                                                    stroke="var(--bg-card, #1c1d1f)"
                                                    strokeWidth={3}
                                                    strokeLinejoin="round"
                                                    fill="var(--text-secondary, #9DA7AE)"
                                                    style={{
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                        fill: 'var(--text-secondary, #9DA7AE)',
                                                        pointerEvents: 'none',
                                                        fontFamily: 'system-ui, -apple-system, sans-serif',
                                                        paintOrder: 'stroke fill'
                                                    }}
                                                >
                                                    {node.value} ({node.pctOfTotal}%)
                                                </text>
                                            </>
                                        ) : (
                                            <>
                                                <text
                                                    x={labelX}
                                                    y={labelY - 2}
                                                    textAnchor={textAnchor}
                                                    stroke="var(--bg-card, #1c1d1f)"
                                                    strokeWidth={3.5}
                                                    strokeLinejoin="round"
                                                    fill="var(--text-primary, #FAF8F4)"
                                                    style={{
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        fill: 'var(--text-primary, #FAF8F4)',
                                                        pointerEvents: 'none',
                                                        fontFamily: 'system-ui, -apple-system, sans-serif',
                                                        paintOrder: 'stroke fill'
                                                    }}
                                                >
                                                    {node.lines?.[0] || node.label}
                                                </text>
                                                <text
                                                    x={labelX}
                                                    y={labelY + 12}
                                                    textAnchor={textAnchor}
                                                    stroke="var(--bg-card, #1c1d1f)"
                                                    strokeWidth={3}
                                                    strokeLinejoin="round"
                                                    fill="var(--text-secondary, #9DA7AE)"
                                                    style={{
                                                        fontSize: '10px',
                                                        fontWeight: 600,
                                                        fill: 'var(--text-secondary, #9DA7AE)',
                                                        pointerEvents: 'none',
                                                        fontFamily: 'system-ui, -apple-system, sans-serif',
                                                        paintOrder: 'stroke fill'
                                                    }}
                                                >
                                                    {node.value} ({node.pctOfTotal}%)
                                                </text>
                                            </>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                </div>
            )}

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
                    WebkitOverflowScrolling: 'touch',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box'
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
