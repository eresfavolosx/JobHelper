"use client";
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, Calendar, CheckCircle, Compass, Plus, Search, Building2, Timer, GitBranch, TrendingUp, BarChart3 } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Onboarding from '@/components/Onboarding';
import GoalTrackerWidget from '@/components/GoalTrackerWidget';
import AiSafetyBadge from '@/components/AiSafetyBadge';
import JobSettingsBanner from '@/components/JobSettingsBanner';
import CycleFilterBar from '@/components/CycleFilterBar';
import { filterJobsByCycle } from '@/lib/cycle-utils';
import { isOwner } from '@/lib/subscription';
import { extractJobFacets } from '@/lib/job-search';

const emptySubscribe = () => () => {};

export default function Home() {
    // ⚡ Bolt: Use specific selector instead of destructuring the whole store to prevent
    // unnecessary re-renders when other state (like profile) changes
    const rawJobs = useAppStore(state => state.jobs);
    const cycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const jobs = useMemo(() => filterJobsByCycle(rawJobs, cycles, selectedCycleId), [rawJobs, cycles, selectedCycleId]);
    const openNewJobModal = useUIStore(state => state.openNewJobModal);
    const openGlobalSearch = useUIStore(state => state.openGlobalSearch);
    const setBoardFilters = useUIStore(state => state.setBoardFilters);
    const router = useRouter();
    const { user, loading } = useAuth();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [showSetupGuide, setShowSetupGuide] = useState(false);

    useEffect(() => {
        // Clear any potential legacy auth flags that might conflict
        if (typeof window !== 'undefined') {
            localStorage.removeItem('is_authenticated');
        }
    }, []);

    // Separate effect for auth redirect - only runs once when auth state is settled
    useEffect(() => {
        if (!loading && !user && mounted) {
            // Use window.location for static export compatibility
            window.location.href = '/login';
        }
    }, [loading, user, mounted]);

    const stats = useMemo(() => {
        if (!jobs) return { total: 0, interviewing: 0, offers: 0 };
        let activeTotal = 0;
        let interviewing = 0;
        let offers = 0;
        for (let i = 0; i < jobs.length; i++) {
            if (!jobs[i] || jobs[i].status === 'deleted') continue;
            activeTotal++;
            const status = jobs[i].status;
            if (status === 'interviewing') interviewing++;
            else if (status === 'offer' || status === 'accepted') offers++;
        }
        return { total: activeTotal, interviewing, offers };
    }, [jobs]);

    const facets = useMemo(() => extractJobFacets(jobs), [jobs]);

    if (!mounted || loading) return null; // Prevent hydration mismatch and show nothing while checking auth
    if (!user) return null; // Don't render anything if not authenticated (redirect is happening)

    const isNewUser = !jobs || stats.total === 0;

    return (
        <div className="container">
            {isNewUser && (
                <div style={{ marginBottom: '20px' }}>
                    <Onboarding />
                </div>
            )}
            <header style={{
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '12px',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box'
            }}>
                <div style={{ minWidth: 0, maxWidth: '100%' }}>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0, lineHeight: 1.2 }}>Dashboard</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                        Welcome back. Here is your application progress and active job settings.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', maxWidth: '100%' }}>
                    <button
                        type="button"
                        onClick={() => openGlobalSearch()}
                        className="btn-secondary"
                        style={{ padding: '9px 14px', fontSize: '0.84rem', borderRadius: '10px' }}
                        title="Search tracked roles by company, role title, location, salary, or notes (⌘K)"
                    >
                        <Search size={16} color="var(--accent-primary)" />
                        <span>Find Roles</span>
                        <kbd style={{
                            fontSize: '0.68rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            fontFamily: 'inherit'
                        }}>
                            ⌘K
                        </kbd>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowSetupGuide(prev => !prev)}
                        className="btn-secondary"
                        style={{ padding: '9px 14px', fontSize: '0.84rem', borderRadius: '10px' }}
                        title="Open interactive setup wizard to update role filters, goals, or add a role"
                    >
                        <Compass size={16} color="var(--accent-primary)" />
                        <span>{showSetupGuide ? 'Hide Setup Guide' : 'Quick Setup & Guide'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={openNewJobModal}
                        className="btn-primary"
                        style={{ padding: '9px 16px', fontSize: '0.84rem', borderRadius: '10px' }}
                    >
                        <Plus size={16} />
                        <span>Log Application</span>
                    </button>
                </div>
            </header>

            {showSetupGuide && (
                <Onboarding
                    isCollapsible={true}
                    onDismiss={() => setShowSetupGuide(false)}
                />
            )}

            {/* Search Cycles Selector */}
            <CycleFilterBar style={{ marginBottom: '16px' }} />

            {/* Full-Width Job Search & Target Settings Bar */}
            <JobSettingsBanner showGoalSummary={false} />

            {/* Quick Company & Role Finder Strip on Dashboard */}
            {facets.companies.length > 0 && (
                <div
                    className="card"
                    style={{
                        padding: '12px 14px',
                        marginBottom: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box'
                    }}
                >
                    <div
                        className="hide-scrollbar"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            flex: '1 1 auto',
                            minWidth: 0,
                            maxWidth: '100%'
                        }}
                    >
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            flexShrink: 0
                        }}>
                            <Building2 size={14} color="var(--accent-primary)" />
                            Companies:
                        </span>
                        {facets.companies.slice(0, 8).map(comp => (
                            <button
                                key={comp.key}
                                type="button"
                                onClick={() => {
                                    setBoardFilters({
                                        boardCompanyFilter: comp.name,
                                        boardSearchQuery: '',
                                        boardStageFilter: 'all',
                                        boardLocationFilter: 'all',
                                        boardQuickFilter: 'all'
                                    });
                                    router.push('/kanban');
                                }}
                                title={`View ${comp.count} tracked ${comp.count === 1 ? 'role' : 'roles'} at ${comp.name} on the Board`}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <span>{comp.name}</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                    {comp.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => openGlobalSearch()}
                        style={{
                            padding: '5px 11px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: 'rgba(107, 126, 103, 0.16)',
                            border: '1px solid var(--accent-primary)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            flexShrink: 0
                        }}
                    >
                        <Search size={12} color="var(--accent-primary)" />
                        <span>Search All Parameters</span>
                    </button>
                </div>
            )}

            {/* Optional, compact and dismissible Anthropic Fellows banner for platform owner */}
            {isOwner(user) && <AiSafetyBadge variant="dashboard-card" />}

            <div className="dashboard-stats-grid">
                <Link
                    href="/kanban"
                    className="card interactive-card"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Briefcase size={24} color="var(--accent-primary)" />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Applications</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.total}</p>
                </Link>

                <Link
                    href="/kanban#interviewing"
                    className="card interactive-card"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Calendar size={24} color="var(--warning)" style={{ minWidth: '24px' }} />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Interviews</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.interviewing}</p>
                </Link>

                <Link
                    href="/kanban#offer"
                    className="card interactive-card"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <CheckCircle size={24} color="var(--success)" style={{ minWidth: '24px' }} />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Offers</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.offers}</p>
                </Link>

                <Link
                    href="/insights"
                    className="card interactive-card"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <BarChart3 size={24} color="var(--accent-primary)" style={{ minWidth: '24px' }} />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Insights</h3>
                    </div>
                    <p className="dashboard-insights-cta">
                        Charts &amp; analysis &rarr;
                    </p>
                </Link>
            </div>

            {/* Application Output Goal & Cadence Command Center */}
            <GoalTrackerWidget />

            {/* Shortcuts into the consolidated Insights hub */}
            <div className="dashboard-insights-strip">
                {[
                    { href: '/insights#pipeline', icon: GitBranch, label: 'Pipeline Flow' },
                    { href: '/insights#timeline', icon: Timer, label: 'Timeline' },
                    { href: '/insights#benchmarks', icon: TrendingUp, label: 'Benchmarks' },
                    { href: '/insights#overview', icon: BarChart3, label: 'History & KPIs' }
                ].map(item => {
                    const Icon = item.icon;
                    return (
                        <Link key={item.href} href={item.href} className="card interactive-card dashboard-insights-link">
                            <Icon size={18} color="var(--accent-primary)" aria-hidden="true" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
