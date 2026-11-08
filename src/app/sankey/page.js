"use client";

import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { GitBranch, Timer, Columns, Plus, LayoutDashboard, Search } from 'lucide-react';
import JobSankeyChart from '@/components/JobSankeyChart';

const emptySubscribe = () => () => {};

export default function SankeyPage() {
    const { user, loading } = useAuth();
    const jobs = useAppStore(state => state.jobs);
    const openNewJobModal = useUIStore(state => state.openNewJobModal);
    const openGlobalSearch = useUIStore(state => state.openGlobalSearch);

    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    useEffect(() => {
        if (mounted && !loading && !user) {
            window.location.href = '/login';
        }
    }, [mounted, loading, user]);

    if (!mounted || loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Page Header */}
            <header style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--border-subtle)'
            }}>
                <div>
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
                            <GitBranch size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                                Pipeline Flow &amp; Conversion Sankey
                            </h1>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                                Interactive cubic-Bézier flow ribbons, conversion rates, and funnel stage breakdowns
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick Action Navigation */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    <Link
                        href="/"
                        className="btn-secondary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 13px',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}
                    >
                        <LayoutDashboard size={14} />
                        <span>Dashboard</span>
                    </Link>

                    <Link
                        href="/kanban"
                        className="btn-secondary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 13px',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}
                    >
                        <Columns size={14} />
                        <span>Board</span>
                    </Link>

                    <Link
                        href="/gantt"
                        className="btn-secondary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 13px',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}
                    >
                        <Timer size={14} />
                        <span>Timeline &amp; Gantt</span>
                    </Link>

                    <button
                        type="button"
                        onClick={() => openGlobalSearch()}
                        className="btn-secondary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 13px',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 600
                        }}
                    >
                        <Search size={14} />
                        <span>Find Roles</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => openNewJobModal()}
                        className="btn-primary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 16px',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 700
                        }}
                    >
                        <Plus size={14} />
                        <span>Log Application</span>
                    </button>
                </div>
            </header>

            {/* Main Interactive Sankey Chart Component */}
            <main>
                <JobSankeyChart jobs={jobs} compact={false} />
            </main>
        </div>
    );
}
