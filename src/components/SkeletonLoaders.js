"use client";
import { SKELETON_PRESETS, createSkeletonProgressProps } from '@/lib/skeleton-config';

export function SkeletonBlock({
    width = '100%',
    height = '16px',
    borderRadius = '8px',
    style = {},
    className = '',
}) {
    return (
        <div
            aria-hidden="true"
            className={`skeleton-block ${className}`.trim()}
            style={{ width, height, borderRadius, flexShrink: 0, ...style }}
        />
    );
}

function SkeletonBusyRegion({ label, children, style = {}, className = '' }) {
    const progressProps = createSkeletonProgressProps(label);
    return (
        <div aria-busy="true" className={className} style={style}>
            <progress {...progressProps} />
            {children}
        </div>
    );
}

export function AppShellSkeleton({ label = SKELETON_PRESETS.appShell.label }) {
    return (
        <SkeletonBusyRegion
            label={label}
            style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                background: 'var(--bg-app)',
                zIndex: 9999,
                padding: '20px',
                gap: '24px',
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}
        >
            <div
                aria-hidden="true"
                className="desktop-only"
                style={{
                    width: SKELETON_PRESETS.appShell.sidebarWidth,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    padding: '16px',
                    borderRadius: '18px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                }}
            >
                <SkeletonBlock width="140px" height="28px" />
                <SkeletonBlock width="100%" height="40px" borderRadius="12px" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                    {[0, 1, 2, 3, 4].map((idx) => (
                        <SkeletonBlock key={idx} width="100%" height="36px" borderRadius="10px" />
                    ))}
                </div>
            </div>

            <div aria-hidden="true" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <SkeletonBlock width="240px" height="32px" />
                    <SkeletonBlock width="130px" height="38px" borderRadius="999px" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                    {Array.from({ length: SKELETON_PRESETS.appShell.statCards }).map((_, idx) => (
                        <div key={idx} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <SkeletonBlock width="55%" height="14px" />
                            <SkeletonBlock width="40%" height="28px" />
                        </div>
                    ))}
                </div>
                <div className="card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <SkeletonBlock width="200px" height="22px" />
                    <SkeletonBlock width="100%" height="180px" borderRadius="12px" />
                </div>
            </div>
        </SkeletonBusyRegion>
    );
}

export function DashboardSkeleton({ label = SKELETON_PRESETS.dashboard.label }) {
    return (
        <SkeletonBusyRegion label={label} className="container" style={{ paddingTop: '8px', paddingBottom: '32px' }}>
            <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <SkeletonBlock width="220px" height="32px" />
                        <SkeletonBlock width="300px" height="16px" />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <SkeletonBlock width="120px" height="40px" borderRadius="12px" />
                        <SkeletonBlock width="130px" height="40px" borderRadius="12px" />
                    </div>
                </div>

                <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {Array.from({ length: SKELETON_PRESETS.dashboard.statPills }).map((_, idx) => (
                        <SkeletonBlock key={idx} width="120px" height="32px" borderRadius="999px" />
                    ))}
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <SkeletonBlock width="180px" height="20px" />
                    <SkeletonBlock width="100%" height="14px" borderRadius="999px" />
                    <SkeletonBlock width="65%" height="14px" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {Array.from({ length: SKELETON_PRESETS.dashboard.quickCards }).map((_, idx) => (
                        <div key={idx} className="card" style={{ padding: '20px', minHeight: '132px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <SkeletonBlock width="42px" height="42px" borderRadius="12px" />
                            <SkeletonBlock width="70%" height="18px" />
                            <SkeletonBlock width="90%" height="14px" />
                        </div>
                    ))}
                </div>
            </div>
        </SkeletonBusyRegion>
    );
}

export function KanbanSkeleton({ label = SKELETON_PRESETS.kanban.label }) {
    return (
        <SkeletonBusyRegion label={label} className="kanban-board-container" style={{ padding: '12px 0' }}>
            <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <SkeletonBlock width="210px" height="30px" />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <SkeletonBlock width="110px" height="38px" borderRadius="10px" />
                        <SkeletonBlock width="110px" height="38px" borderRadius="10px" />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                    {Array.from({ length: SKELETON_PRESETS.kanban.columns }).map((_, colIdx) => (
                        <div key={colIdx} className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <SkeletonBlock width="110px" height="20px" />
                                <SkeletonBlock width="32px" height="22px" borderRadius="999px" />
                            </div>
                            {Array.from({ length: SKELETON_PRESETS.kanban.cardsPerColumn }).map((__, cardIdx) => (
                                <div key={cardIdx} style={{ padding: '12px', borderRadius: '10px', background: 'var(--glass-panel)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <SkeletonBlock width="75%" height="16px" />
                                    <SkeletonBlock width="55%" height="13px" />
                                    <SkeletonBlock width="45%" height="12px" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </SkeletonBusyRegion>
    );
}

export function InsightsSkeleton({ label = SKELETON_PRESETS.insights.label }) {
    return (
        <SkeletonBusyRegion label={label} className="insights-page" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <SkeletonBlock width="42px" height="42px" borderRadius="12px" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <SkeletonBlock width="140px" height="26px" />
                            <SkeletonBlock width="240px" height="14px" />
                        </div>
                    </div>
                    <SkeletonBlock width="120px" height="38px" borderRadius="12px" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
                    {Array.from({ length: SKELETON_PRESETS.insights.kpiCards }).map((_, idx) => (
                        <div key={idx} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <SkeletonBlock width="60%" height="13px" />
                            <SkeletonBlock width="45%" height="28px" />
                            <SkeletonBlock width="75%" height="12px" />
                        </div>
                    ))}
                </div>

                <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <SkeletonBlock width="210px" height="20px" />
                    <SkeletonBlock width="100%" height={SKELETON_PRESETS.insights.chartHeight} borderRadius="14px" />
                </div>
            </div>
        </SkeletonBusyRegion>
    );
}

export function RecommendationsSkeleton({
    count = SKELETON_PRESETS.recommendations.defaultCount,
    label = SKELETON_PRESETS.recommendations.label,
}) {
    return (
        <SkeletonBusyRegion label={label}>
            <div
                aria-hidden="true"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))',
                    gap: '20px',
                }}
            >
                {Array.from({ length: count }).map((_, idx) => (
                    <div
                        key={idx}
                        className="card"
                        style={{
                            padding: '22px',
                            minHeight: SKELETON_PRESETS.recommendations.cardMinHeight,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <SkeletonBlock width="96px" height="22px" borderRadius="999px" />
                                <SkeletonBlock width="85%" height="20px" />
                                <SkeletonBlock width="65%" height="13px" />
                            </div>
                            <SkeletonBlock width="58px" height="32px" borderRadius="12px" />
                        </div>
                        <SkeletonBlock width="100%" height="78px" borderRadius="10px" />
                        <SkeletonBlock width="92%" height="14px" />
                        <SkeletonBlock width="76%" height="14px" />
                        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '12px' }}>
                            <SkeletonBlock width="50%" height="38px" borderRadius="10px" />
                            <SkeletonBlock width="50%" height="38px" borderRadius="10px" />
                        </div>
                    </div>
                ))}
            </div>
        </SkeletonBusyRegion>
    );
}

export function ProfileSkeleton({ label = SKELETON_PRESETS.profile.label }) {
    return (
        <SkeletonBusyRegion label={label} className="container" style={{ maxWidth: '920px', paddingTop: '12px', paddingBottom: '40px' }}>
            <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <SkeletonBlock width="64px" height="64px" borderRadius="50%" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                        <SkeletonBlock width="220px" height="26px" />
                        <SkeletonBlock width="280px" height="15px" />
                    </div>
                </div>
                {Array.from({ length: SKELETON_PRESETS.profile.sections }).map((_, idx) => (
                    <div key={idx} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <SkeletonBlock width="190px" height="22px" />
                        <SkeletonBlock width="100%" height="44px" borderRadius="10px" />
                        <SkeletonBlock width="100%" height="44px" borderRadius="10px" />
                        <SkeletonBlock width="150px" height="38px" borderRadius="10px" />
                    </div>
                ))}
            </div>
        </SkeletonBusyRegion>
    );
}

export function CareerCoachSkeleton({ label = SKELETON_PRESETS.careerCoach.label }) {
    return (
        <SkeletonBusyRegion label={label} style={{ padding: '16px 0' }}>
            <div aria-hidden="true" style={{ display: 'grid', gap: '16px' }}>
                {Array.from({ length: SKELETON_PRESETS.careerCoach.strategyCards }).map((_, idx) => (
                    <div
                        key={idx}
                        style={{
                            padding: '16px',
                            borderRadius: '12px',
                            background: 'var(--glass-highlight)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                        }}
                    >
                        <SkeletonBlock width="140px" height="20px" borderRadius="999px" />
                        <SkeletonBlock width="80%" height="16px" />
                        <SkeletonBlock width="100%" height="14px" />
                        <SkeletonBlock width="92%" height="14px" />
                    </div>
                ))}
            </div>
        </SkeletonBusyRegion>
    );
}
