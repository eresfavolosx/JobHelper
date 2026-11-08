"use client";

import { useEffect, useSyncExternalStore, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { Timer, Columns, Plus, LayoutDashboard, Search } from 'lucide-react';
import JobGanttChart from '@/components/JobGanttChart';
import CycleFilterBar from '@/components/CycleFilterBar';
import { filterJobsByCycle } from '@/lib/cycle-utils';

const emptySubscribe = () => () => {};

export default function GanttPage() {
    const { user, loading } = useAuth();
    const rawJobs = useAppStore(state => state.jobs);
    const cycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const jobs = useMemo(() => filterJobsByCycle(rawJobs, cycles, selectedCycleId), [rawJobs, cycles, selectedCycleId]);
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
                            <Timer size={22} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                                Application Timeline & Gantt View
                            </h1>
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                                Interactive swimlanes, milestone pacing, and stage bottleneck velocity diagnostics
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
                        <span>Board View</span>
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
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <Search size={14} />
                        <span>Find Roles</span>
                    </button>

                    <button
                        type="button"
                        onClick={openNewJobModal}
                        className="btn-primary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={15} />
                        <span>Add Application</span>
                    </button>
                </div>
            </header>

            {/* Search Cycles Selector */}
            <CycleFilterBar />

            {/* Main Interactive Gantt Chart & Velocity Analytics */}
            <JobGanttChart jobs={jobs} compact={false} />
        </div>
    );
}
