"use client";

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
    TrendingUp,
    Award,
    CheckCircle2,
    Activity,
    Copy,
    Check,
    Download,
    Sparkles,
    Calendar,
    Target,
    Layers,
    ArrowUpRight,
    ArrowDownRight,
    AlertTriangle,
    BarChart2,
    SlidersHorizontal,
    Compass
} from 'lucide-react';
import {
    INDUSTRY_BENCHMARK_PROFILES,
    TRENDS_TIME_RANGES,
    computeBenchmarkAnalytics,
    formatBenchmarkSummaryMarkdown
} from '@/lib/benchmark-analytics';

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

export default function MarketBenchmarkView({ jobs, compact = false }) {
    const prefersReducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot
    );

    const [benchmarkProfile, setBenchmarkProfile] = useState('tech_general');
    const [range, setRange] = useState('all');
    const [copiedSummary, setCopiedSummary] = useState(false);

    // Compute all benchmark metrics, deltas, and trends
    const analytics = useMemo(() => {
        return computeBenchmarkAnalytics(jobs, {
            benchmarkProfile,
            range
        });
    }, [jobs, benchmarkProfile, range]);

    const {
        benchmark,
        totalApplied,
        totalTracked,
        interviewCount,
        offerCount,
        userRates,
        benchmarkRates,
        deltas,
        tiers,
        weeklyTrends,
        sourceComparison,
        arrangementComparison,
        recommendations,
        hasData
    } = analytics;

    // Copy formatted Markdown summary
    const handleCopySummary = async () => {
        const text = formatBenchmarkSummaryMarkdown(analytics);
        try {
            await navigator.clipboard.writeText(text);
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2500);
        } catch (err) {
            console.error('[Benchmark] Failed to copy summary:', err);
        }
    };

    // Download CSV report
    const handleDownloadCSV = () => {
        const rows = [
            ['Metric', 'Your Candidate Rate', 'Industry Benchmark', 'Delta'],
            ['Screening Callback Rate', `${userRates.screeningRate}%`, `${benchmarkRates.screeningRate}%`, `${deltas.screeningRate}%`],
            ['Screening to Interview Rate', `${userRates.screeningToInterviewRate}%`, `${benchmarkRates.screeningToInterviewRate}%`, `${deltas.screeningToInterviewRate}%`],
            ['Interview to Offer Rate', `${userRates.interviewToOfferRate}%`, `${benchmarkRates.interviewToOfferRate}%`, `${deltas.interviewToOfferRate}%`],
            ['Overall Success Rate', `${userRates.overallOfferRate}%`, `${benchmarkRates.overallOfferRate}%`, `${deltas.overallOfferRate}%`],
            ['', '', '', ''],
            ['Channel / Source', 'Applications', 'Interviews', 'Interview Rate (%)'],
            ...sourceComparison.map(s => [s.source, s.applied, s.interviews, `${s.interviewRate}%`])
        ];

        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `novujobs-market-benchmark-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <section
            className="card"
            aria-label="Market Trends and Industry Benchmark Comparison"
            style={{
                marginTop: compact ? '14px' : '20px',
                marginBottom: compact ? '16px' : '0',
                padding: compact ? '18px 20px' : '24px',
                color: 'var(--text-primary)',
                transition: prefersReducedMotion ? 'none' : 'all 0.2s ease'
            }}
        >
            {/* Header: Title & Benchmark Profile Controls */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '14px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-subtle)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        <BarChart2 size={22} aria-hidden="true" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                Market Trends &amp; Industry Benchmark Rates
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
                                {totalApplied} Applications Analyzed
                            </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                            Comparing your funnel velocity, conversion rates, and channel ROI against market standards
                        </p>
                    </div>
                </div>

                {/* Right Action Tools: Benchmark Selector, Time Range & Export */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    {/* Benchmark Profile Dropdown */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <SlidersHorizontal size={13} color="var(--accent-primary)" />
                        <select
                            value={benchmarkProfile}
                            onChange={e => setBenchmarkProfile(e.target.value)}
                            aria-label="Select industry benchmark profile"
                            style={{
                                padding: '5px 10px',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                borderRadius: '8px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-panel)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {Object.values(INDUSTRY_BENCHMARK_PROFILES).map(p => (
                                <option key={p.id} value={p.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Time Range Pills */}
                    <div
                        role="group"
                        aria-label="Trends time range"
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
                        {TRENDS_TIME_RANGES.map(r => (
                            <button
                                key={r.id}
                                type="button"
                                aria-pressed={range === r.id}
                                onClick={() => setRange(r.id)}
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

                    {/* Copy Summary */}
                    <button
                        type="button"
                        onClick={handleCopySummary}
                        aria-label="Copy Benchmark Summary to Clipboard"
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
                                <span>Copy Summary</span>
                            </>
                        )}
                    </button>

                    {/* CSV Download */}
                    <button
                        type="button"
                        onClick={handleDownloadCSV}
                        aria-label="Download CSV report"
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
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Profile Context Banner */}
            <div style={{
                marginTop: '12px',
                marginBottom: '18px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(107, 126, 103, 0.08)',
                border: '1px solid rgba(107, 126, 103, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Compass size={15} color="var(--accent-primary)" />
                    <span>
                        Benchmark Baseline: <strong style={{ color: 'var(--text-primary)' }}>{benchmark.label}</strong> — {benchmark.description}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.72rem' }}>
                    <span>Target Cycle: <strong style={{ color: 'var(--text-primary)' }}>{benchmark.rates.avgCycleDays}d</strong></span>
                    <span>Expected Callback: <strong style={{ color: 'var(--text-primary)' }}>~{benchmark.rates.avgCallbackDays}d</strong></span>
                </div>
            </div>

            {/* 4 Core Comparative Funnel Benchmark Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                gap: '14px',
                marginBottom: '22px'
            }}>
                {/* Metric 1: Screening Callback Rate */}
                <BenchmarkCard
                    title="Screening Callback Rate"
                    subtitle="Applications advancing to first recruiter call"
                    userRate={userRates.screeningRate}
                    benchmarkRate={benchmarkRates.screeningRate}
                    delta={deltas.screeningRate}
                    tier={tiers.screening}
                    icon={TrendingUp}
                    accentColor="#0ea5e9"
                />

                {/* Metric 2: Screening to Interview Conversion */}
                <BenchmarkCard
                    title="Screening → Interview"
                    subtitle="Screened candidates advancing to interview loop"
                    userRate={userRates.screeningToInterviewRate}
                    benchmarkRate={benchmarkRates.screeningToInterviewRate}
                    delta={deltas.screeningToInterviewRate}
                    tier={tiers.screeningToInterview}
                    icon={Activity}
                    accentColor="#D4A373"
                />

                {/* Metric 3: Interview to Offer Conversion */}
                <BenchmarkCard
                    title="Interview → Offer Win Rate"
                    subtitle="Completed loops converting to job offers"
                    userRate={userRates.interviewToOfferRate}
                    benchmarkRate={benchmarkRates.interviewToOfferRate}
                    delta={deltas.interviewToOfferRate}
                    tier={tiers.interviewToOffer}
                    icon={Award}
                    accentColor="#10b981"
                />

                {/* Metric 4: Net Application to Offer Success */}
                <BenchmarkCard
                    title="Overall Offer Success Rate"
                    subtitle="Net offers per total applications submitted"
                    userRate={userRates.overallOfferRate}
                    benchmarkRate={benchmarkRates.overallOfferRate}
                    delta={deltas.overallOfferRate}
                    tier={tiers.overallOffer}
                    icon={CheckCircle2}
                    accentColor="var(--accent-primary)"
                />
            </div>

            {/* Two Column Grid: Weekly Trends & Channel ROI Matrix */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                gap: '16px',
                marginBottom: '20px'
            }}>
                {/* Left Panel: Historical Weekly Volume & Velocity Trajectory */}
                <div style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-panel)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 3px 0', color: 'var(--text-primary)' }}>
                                Weekly Application Velocity &amp; Pace
                            </h4>
                            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0 }}>
                                Week-over-week application submissions and rolling 4-week pace
                            </p>
                        </div>
                        <Calendar size={18} color="var(--accent-primary)" />
                    </div>

                    {weeklyTrends.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '6px' }}>
                            {weeklyTrends.slice(-6).map((week) => {
                                const maxWeek = Math.max(...weeklyTrends.map(w => w.applied), 5);
                                const barWidth = Math.min(100, Math.round((week.applied / maxWeek) * 100));

                                return (
                                    <div key={week.weekKey} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>{week.weekLabel}</strong>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                                                    {week.applied} {week.applied === 1 ? 'app' : 'apps'} · {week.interviewed} loops
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {week.wowGrowthPct !== 0 && (
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        color: week.wowGrowthPct > 0 ? '#10b981' : '#ef4444',
                                                        display: 'inline-flex',
                                                        alignItems: 'center'
                                                    }}>
                                                        {week.wowGrowthPct > 0 ? '+' : ''}{week.wowGrowthPct}% WoW
                                                    </span>
                                                )}
                                                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {week.rollingAvg} avg/wk
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress Bar Container */}
                                        <div style={{
                                            width: '100%',
                                            height: '7px',
                                            borderRadius: '999px',
                                            background: 'var(--bg-card)',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                width: `${Math.max(5, barWidth)}%`,
                                                height: '100%',
                                                borderRadius: '999px',
                                                background: 'var(--accent-gradient)',
                                                transition: 'width 0.4s ease'
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            Log applications to start tracking your weekly application velocity trajectory.
                        </div>
                    )}
                </div>

                {/* Right Panel: Channel / Source ROI Performance Matrix */}
                <div style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-panel)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 3px 0', color: 'var(--text-primary)' }}>
                                Channel &amp; Source ROI Matrix
                            </h4>
                            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0 }}>
                                Conversion effectiveness by job portal, ATS, and network source
                            </p>
                        </div>
                        <Layers size={18} color="var(--accent-primary)" />
                    </div>

                    {sourceComparison.length > 0 ? (
                        <div style={{
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Channel</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Applied</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Interviews</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Interview %</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Offers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sourceComparison.map((s, idx) => (
                                        <tr
                                            key={s.source}
                                            style={{
                                                borderBottom: idx < sourceComparison.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                                background: idx === 0 ? 'rgba(107, 126, 103, 0.08)' : 'transparent'
                                            }}
                                        >
                                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {s.source}
                                                {idx === 0 && s.interviews > 0 && (
                                                    <span style={{
                                                        marginLeft: '6px',
                                                        padding: '1px 5px',
                                                        borderRadius: '999px',
                                                        fontSize: '0.62rem',
                                                        fontWeight: 800,
                                                        background: 'rgba(16, 185, 129, 0.2)',
                                                        color: '#10b981'
                                                    }}>
                                                        Top ROI
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{s.applied}</td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.interviews}</td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: s.interviewRate >= benchmarkRates.screeningRate ? '#10b981' : 'var(--text-secondary)' }}>
                                                {s.interviewRate}%
                                            </td>
                                            <td style={{ padding: '8px 10px', fontWeight: 700, color: s.offers > 0 ? '#10b981' : 'var(--text-secondary)' }}>
                                                {s.offers}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            Add source tags or job links to see which application channels produce the highest callback rate.
                        </div>
                    )}
                </div>
            </div>

            {/* Strategic Benchmark Recommendations */}
            {recommendations.length > 0 && (
                <div style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-panel)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Sparkles size={18} color="var(--accent-primary)" />
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            Data-Backed Pipeline Recommendations
                        </h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {recommendations.map(rec => {
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
                                    key={rec.id}
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-subtle)',
                                        borderLeft: `4px solid ${toneBorder}`,
                                        background: toneBg
                                    }}
                                >
                                    <h5 style={{ fontSize: '0.8rem', fontWeight: 700, margin: '0 0 3px 0', color: 'var(--text-primary)' }}>
                                        {rec.title}
                                    </h5>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                                        {rec.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}

/**
 * Visual Comparative Benchmark Metric Card with dual target bar
 */
function BenchmarkCard({
    title,
    subtitle,
    userRate,
    benchmarkRate,
    delta,
    tier,
    icon: Icon,
    accentColor
}) {
    const isOutperforming = tier === 'outperforming';
    const isOnTrack = tier === 'on_track';

    const deltaSign = delta > 0 ? '+' : '';
    const deltaColor = isOutperforming
        ? '#10b981'
        : isOnTrack
        ? 'var(--accent-primary)'
        : '#ef4444';

    const tierLabel = isOutperforming
        ? 'Outperforming'
        : isOnTrack
        ? 'On Track'
        : 'Lagging Benchmark';

    const tierBg = isOutperforming
        ? 'rgba(16, 185, 129, 0.16)'
        : isOnTrack
        ? 'rgba(107, 126, 103, 0.18)'
        : 'rgba(239, 68, 68, 0.16)';

    // Scale progress bars to max 100%
    const userBarWidth = Math.min(100, Math.max(userRate > 0 ? 5 : 0, userRate));
    const benchmarkMarkerPos = Math.min(100, benchmarkRate);

    return (
        <div style={{
            padding: '16px 18px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-panel)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {title}
                </span>
                <Icon size={16} color={accentColor} aria-hidden="true" />
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        {userRate}%
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        vs {benchmarkRate}% avg
                    </span>
                </div>

                <span style={{
                    padding: '2px 7px',
                    borderRadius: '999px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: tierBg,
                    color: deltaColor,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                }}>
                    {delta > 0 ? <ArrowUpRight size={11} /> : delta < 0 ? <ArrowDownRight size={11} /> : null}
                    {deltaSign}{delta}%
                </span>
            </div>

            {/* Dual Meter: Candidate vs Benchmark Marker */}
            <div style={{ position: 'relative', marginTop: '4px', marginBottom: '2px' }}>
                <div style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '999px',
                    background: 'var(--bg-card)',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    <div style={{
                        width: `${userBarWidth}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: accentColor,
                        transition: 'width 0.4s ease'
                    }} />
                </div>

                {/* Benchmark Target Marker Pin */}
                <div
                    title={`Industry Benchmark: ${benchmarkRate}%`}
                    style={{
                        position: 'absolute',
                        left: `${benchmarkMarkerPos}%`,
                        top: '-3px',
                        bottom: '-3px',
                        width: '2px',
                        background: '#ffffff',
                        boxShadow: '0 0 4px rgba(0,0,0,0.6)',
                        transform: 'translateX(-50%)'
                    }}
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                <span>{subtitle}</span>
                <span style={{ fontWeight: 700, color: deltaColor }}>{tierLabel}</span>
            </div>
        </div>
    );
}
