"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { BarChart3, LayoutGrid, GitBranch, Timer, TrendingUp, Plus, Send, MessageSquare, Award, CalendarDays } from 'lucide-react';
import JobSankeyChart from '@/components/JobSankeyChart';
import JobGanttChart from '@/components/JobGanttChart';
import MarketBenchmarkView from '@/components/MarketBenchmarkView';
import ApplicationHistoryChart from '@/components/ApplicationHistoryChart';
import MetricsTrendPanel from '@/components/MetricsTrendPanel';
import CycleFilterBar from '@/components/CycleFilterBar';
import { InsightsSkeleton } from '@/components/SkeletonLoaders';
import { filterJobsByCycle, calculateCycleStats, resolveCyclesFromJobs, getActiveCycle } from '@/lib/cycle-utils';

const emptySubscribe = () => () => {};

const INSIGHT_TABS = [
    { id: 'overview', label: 'Overview', short: 'Overview', icon: LayoutGrid },
    { id: 'pipeline', label: 'Pipeline Flow', short: 'Pipeline', icon: GitBranch },
    { id: 'timeline', label: 'Timeline', short: 'Timeline', icon: Timer },
    { id: 'benchmarks', label: 'Benchmarks', short: 'Benchmarks', icon: TrendingUp }
];

const TAB_IDS = new Set(INSIGHT_TABS.map(t => t.id));

function readHashTab() {
    if (typeof window === 'undefined') return 'overview';
    const hash = window.location.hash.replace('#', '');
    return TAB_IDS.has(hash) ? hash : 'overview';
}

function KpiCard({ icon: Icon, label, value, hint, color }) {
    return (
        <div className="card insights-kpi">
            <div className="insights-kpi-head">
                <Icon size={16} color={color} aria-hidden="true" />
                <span>{label}</span>
            </div>
            <div className="insights-kpi-value" style={{ color }}>{value}</div>
            {hint && <div className="insights-kpi-hint">{hint}</div>}
        </div>
    );
}

export default function InsightsPage() {
    const { user, loading } = useAuth();
    const rawJobs = useAppStore(state => state.jobs);
    const storeCycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const openNewJobModal = useUIStore(state => state.openNewJobModal);
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    const [activeTab, setActiveTab] = useState(() => readHashTab());

    useEffect(() => {
        const onHash = () => setActiveTab(readHashTab());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);

    useEffect(() => {
        if (mounted && !loading && !user) {
            window.location.href = '/login';
        }
    }, [mounted, loading, user]);

    const selectTab = useCallback((id) => {
        setActiveTab(id);
        try {
            window.history.replaceState(null, '', `#${id}`);
        } catch { /* ignore */ }
        const main = document.querySelector('.main-content');
        if (main && main.scrollTop > 0) {
            main.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    const cycles = useMemo(() => resolveCyclesFromJobs(rawJobs, storeCycles), [rawJobs, storeCycles]);
    const jobs = useMemo(() => filterJobsByCycle(rawJobs, cycles, selectedCycleId), [rawJobs, cycles, selectedCycleId]);

    const overview = useMemo(() => {
        const visible = jobs.filter(j => j && j.status !== 'archived');
        let cycle = selectedCycleId === 'active' ? getActiveCycle(cycles) : cycles.find(c => c.id === selectedCycleId);
        if (!cycle) {
            const earliest = visible.reduce((min, j) => {
                const d = j.appliedAt || j.dateAdded || j.createdAt;
                return d && d < min ? d : min;
            }, new Date().toISOString());
            cycle = { startedAt: earliest, endedAt: null, status: 'active' };
        }
        return calculateCycleStats(cycle, visible);
    }, [jobs, cycles, selectedCycleId]);

    if (!mounted || loading) {
        return <InsightsSkeleton />;
    }

    const interviews = overview.screening + overview.interviewing + overview.offers;

    return (
        <div className="insights-page">
            <header className="insights-header">
                <div className="insights-title-wrap">
                    <div className="insights-title-icon">
                        <BarChart3 size={20} color="var(--accent-primary)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h1 className="insights-title">Insights</h1>
                        <p className="insights-subtitle">All your charts and analysis in one place.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => openNewJobModal()}
                    className="btn-primary insights-add-btn"
                >
                    <Plus size={15} />
                    <span>Log Application</span>
                </button>
            </header>

            <CycleFilterBar />

            {/* Sticky segmented tab bar */}
            <nav className="insights-tabs" role="tablist" aria-label="Insight views">
                {INSIGHT_TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`insights-tab-${tab.id}`}
                            aria-selected={isActive}
                            aria-controls={`insights-panel-${tab.id}`}
                            className={`insights-tab ${isActive ? 'active' : ''}`}
                            onClick={() => selectTab(tab.id)}
                        >
                            <Icon size={16} aria-hidden="true" />
                            <span className="insights-tab-label-full">{tab.label}</span>
                            <span className="insights-tab-label-short">{tab.short}</span>
                        </button>
                    );
                })}
            </nav>

            <section
                id={`insights-panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`insights-tab-${activeTab}`}
                className="insights-panel"
            >
                {activeTab === 'overview' && (
                    <>
                        <div className="insights-kpi-grid">
                            <KpiCard
                                icon={Send}
                                label="Applied"
                                value={overview.applied}
                                hint={`${overview.wishlist} in wishlist`}
                                color="var(--accent-primary)"
                            />
                            <KpiCard
                                icon={MessageSquare}
                                label="Interview rate"
                                value={`${overview.interviewRate}%`}
                                hint={`${interviews} reached screening+`}
                                color="var(--warning)"
                            />
                            <KpiCard
                                icon={Award}
                                label="Offer rate"
                                value={`${overview.offerRate}%`}
                                hint={`${overview.offers} offer${overview.offers === 1 ? '' : 's'}`}
                                color="var(--success)"
                            />
                            <KpiCard
                                icon={CalendarDays}
                                label="Search length"
                                value={`${overview.durationDays}d`}
                                hint={overview.rejected ? `${overview.rejected} rejected` : 'No rejections yet'}
                                color="var(--text-primary)"
                            />
                        </div>

                        <div className="insights-shortcuts">
                            {INSIGHT_TABS.filter(t => t.id !== 'overview').map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        className="card interactive-card insights-shortcut"
                                        onClick={() => selectTab(tab.id)}
                                    >
                                        <Icon size={18} color="var(--accent-primary)" aria-hidden="true" />
                                        <span>{tab.label}</span>
                                        <span aria-hidden="true" className="insights-shortcut-arrow">&rarr;</span>
                                    </button>
                                );
                            })}
                        </div>

                        <MetricsTrendPanel jobs={jobs} />

                        <ApplicationHistoryChart jobs={jobs} />
                    </>
                )}

                {activeTab === 'pipeline' && <JobSankeyChart jobs={jobs} compact={false} />}
                {activeTab === 'timeline' && <JobGanttChart jobs={jobs} compact={false} />}
                {activeTab === 'benchmarks' && <MarketBenchmarkView jobs={jobs} compact={false} />}
            </section>
        </div>
    );
}
