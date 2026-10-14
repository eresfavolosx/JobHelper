"use client";
import React, { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import { useAuth } from '@/lib/auth-context';
import { useAppStore } from '@/lib/store';
import { 
    Download, Mail, FileText, FileSpreadsheet, 
    Bot, ChevronDown, Target
} from 'lucide-react';
import { exportBoardToCsv, exportBoardToJson, exportAgentBriefing } from '@/lib/export-utils';
import GmailJobSyncModal from '@/components/GmailJobSyncModal';
import NotificationCenter from '@/components/NotificationCenter';
import AiCareerCoachModal from '@/components/AiCareerCoachModal';
import { calculateGoalProgress, DEFAULT_GOAL } from '@/lib/goal-tracker';
import GoalCustomizationModal from '@/components/GoalCustomizationModal';

const emptySubscribe = () => () => {};

export default function KanbanPage() {
    const { user, loading } = useAuth();
    const jobs = useAppStore(state => state.jobs);
    const profile = useAppStore(state => state.profile);

    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const [emailSyncOpen, setEmailSyncOpen] = useState(false);
    const [selectedCoachJob, setSelectedCoachJob] = useState(null);
    const [coachModalOpen, setCoachModalOpen] = useState(false);
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const exportRef = useRef(null);

    const goalProgress = calculateGoalProgress(jobs, profile?.applicationGoal || DEFAULT_GOAL);

    useEffect(() => {
        if (mounted && !loading && !user) {
            window.location.href = '/login';
        }
    }, [mounted, loading, user]);

    // Close export dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (exportRef.current && !exportRef.current.contains(event.target)) {
                setExportMenuOpen(false);
            }
        }
        if (exportMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [exportMenuOpen]);

    if (!mounted || loading) return null;
    if (!user) return null;

    const handleOpenCoach = (job) => {
        setSelectedCoachJob(job);
        setCoachModalOpen(true);
    };

    return (
        <div className="kanban-board-container">
            <header style={{ 
                marginBottom: '16px', 
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>Application Board</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Track your pipeline across stages. Drag cards or use the quick status mover.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Goal Tracker Pill */}
                    <button
                        type="button"
                        onClick={() => setGoalModalOpen(true)}
                        className="btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.85rem',
                            padding: '8px 12px',
                            background: goalProgress.percentage >= 100 
                                ? 'rgba(16, 185, 129, 0.12)' 
                                : 'rgba(56, 189, 248, 0.1)',
                            border: goalProgress.percentage >= 100 
                                ? '1px solid rgba(16, 185, 129, 0.3)' 
                                : '1px solid rgba(56, 189, 248, 0.3)'
                        }}
                        title={`Application Goal: ${goalProgress.count} of ${goalProgress.target} applied (${goalProgress.cadence}). Click to customize.`}
                    >
                        <Target size={15} color={goalProgress.percentage >= 100 ? '#10b981' : 'var(--accent-primary)'} />
                        <span style={{ fontWeight: 'bold' }}>{goalProgress.count}/{goalProgress.target}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({goalProgress.cadence})</span>
                    </button>

                    {/* Notification Center */}
                    <NotificationCenter 
                        onSelectJobForCoach={handleOpenCoach} 
                        onOpenGmailSync={() => setEmailSyncOpen(true)} 
                    />

                    {/* AI Email & Status Sync Trigger */}
                    <button
                        type="button"
                        onClick={() => setEmailSyncOpen(true)}
                        className="btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.85rem',
                            padding: '8px 14px',
                            background: 'linear-gradient(135deg, rgba(208, 90, 71, 0.12), rgba(94, 135, 110, 0.14))',
                            border: '1px solid rgba(94, 135, 110, 0.35)'
                        }}
                        title="Scan recruiter emails with AI to auto-update job statuses"
                    >
                        <Mail size={16} color="var(--accent-primary)" />
                        <span>Sync Emails</span>
                    </button>

                    {/* Export Function Dropdown */}
                    <div style={{ position: 'relative' }} ref={exportRef}>
                        <button
                            type="button"
                            onClick={() => setExportMenuOpen(!exportMenuOpen)}
                            className="btn-secondary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.85rem',
                                padding: '8px 14px'
                            }}
                            title="Export board data for AI agents or spreadsheets"
                        >
                            <Download size={16} />
                            <span>Export Board</span>
                            <ChevronDown size={14} style={{ opacity: 0.7 }} />
                        </button>

                        {exportMenuOpen && (
                            <div className="card animate-scale-up" style={{
                                position: 'absolute',
                                top: '42px',
                                right: 0,
                                width: '260px',
                                padding: '8px',
                                zIndex: 1000,
                                boxShadow: '0 15px 35px -5px rgba(0,0,0,0.5)',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-app)',
                                display: 'grid',
                                gap: '4px'
                            }}>
                                <button
                                    onClick={() => {
                                        exportBoardToCsv(jobs);
                                        setExportMenuOpen(false);
                                    }}
                                    className="menu-item-hover"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        width: '100%',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-primary)',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <FileSpreadsheet size={16} color="#10b981" />
                                    <div>
                                        <div style={{ fontWeight: '600' }}>Export as CSV</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Excel, Google Sheets, Airtable</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        exportBoardToJson(jobs, profile);
                                        setExportMenuOpen(false);
                                    }}
                                    className="menu-item-hover"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        width: '100%',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-primary)',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Bot size={16} color="var(--accent-primary)" />
                                    <div>
                                        <div style={{ fontWeight: '600' }}>Export as JSON</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Full data format for AI agents</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => {
                                        exportAgentBriefing(jobs);
                                        setExportMenuOpen(false);
                                    }}
                                    className="menu-item-hover"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        width: '100%',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-primary)',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        textAlign: 'left',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <FileText size={16} color="#a855f7" />
                                    <div>
                                        <div style={{ fontWeight: '600' }}>Agent Briefing (.md)</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>AI-ready markdown summary</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <KanbanBoard />

            {/* AI Email & Status Sync Modal */}
            <GmailJobSyncModal
                isOpen={emailSyncOpen}
                onClose={() => setEmailSyncOpen(false)}
            />

            {/* Application Output Goal & Cadence Customization Modal */}
            <GoalCustomizationModal
                isOpen={goalModalOpen}
                onClose={() => setGoalModalOpen(false)}
            />

            {/* AI Career Coach Modal triggered from notifications */}
            {selectedCoachJob && (
                <AiCareerCoachModal
                    job={selectedCoachJob}
                    isOpen={coachModalOpen}
                    onClose={() => {
                        setCoachModalOpen(false);
                        setSelectedCoachJob(null);
                    }}
                />
            )}
        </div>
    );
}
