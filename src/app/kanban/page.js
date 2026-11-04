"use client";
import React, { useEffect, useState, useRef, useSyncExternalStore } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import { useAuth } from '@/lib/auth-context';
import { useAppStore } from '@/lib/store';
import { 
    Download, Mail, FileText, FileSpreadsheet, 
    Bot, ChevronDown, Plus
} from 'lucide-react';
import { exportBoardToCsv, exportBoardToJson, exportAgentBriefing } from '@/lib/export-utils';
import GmailJobSyncModal from '@/components/GmailJobSyncModal';
import NotificationCenter from '@/components/NotificationCenter';
import AiCareerCoachModal from '@/components/AiCareerCoachModal';
import GoalCustomizationModal from '@/components/GoalCustomizationModal';
import { useUIStore } from '@/lib/uiStore';

const emptySubscribe = () => () => {};

export default function KanbanPage() {
    const { user, loading } = useAuth();
    const jobs = useAppStore(state => state.jobs);
    const profile = useAppStore(state => state.profile);
    const openNewJobModal = useUIStore(state => state.openNewJobModal);

    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const [emailSyncOpen, setEmailSyncOpen] = useState(false);
    const [selectedCoachJob, setSelectedCoachJob] = useState(null);
    const [coachModalOpen, setCoachModalOpen] = useState(false);
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const exportRef = useRef(null);

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
            <header
                className="kanban-page-header"
                style={{ 
                    marginBottom: '10px', 
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    position: 'relative',
                    zIndex: 45
                }}
            >
                <div>
                    <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.7rem)', fontWeight: 'bold', lineHeight: 1.2 }}>Application Board</h2>
                    <p className="desktop-only" style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '2px' }}>
                        Track your pipeline across stages. Drag cards, attach your resume link, or use the Stage selector pill.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={openNewJobModal}
                        className="btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.8rem',
                            padding: '7px 12px'
                        }}
                    >
                        <Plus size={15} />
                        <span>Log Application</span>
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
                            gap: '5px',
                            fontSize: '0.8rem',
                            padding: '7px 12px',
                            background: 'linear-gradient(135deg, rgba(208, 90, 71, 0.12), rgba(94, 135, 110, 0.14))',
                            border: '1px solid rgba(94, 135, 110, 0.35)'
                        }}
                        title="Scan recruiter emails with AI to auto-update job statuses"
                    >
                        <Mail size={15} color="var(--accent-primary)" />
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
                                gap: '5px',
                                fontSize: '0.8rem',
                                padding: '7px 12px'
                            }}
                            title="Export board data for AI agents or spreadsheets"
                        >
                            <Download size={15} />
                            <span>Export</span>
                            <ChevronDown size={13} style={{ opacity: 0.7 }} />
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
