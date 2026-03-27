"use client";
import { useState, useEffect } from 'react';
import { X, Undo2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function UndoToast() {
    const [deletedJob, setDeletedJob] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const restoreJob = useAppStore(s => s.restoreJob);
    const permanentDeleteJob = useAppStore(s => s.permanentDeleteJob);
    const jobs = useAppStore(s => s.jobs);

    // Watch for newly deleted jobs
    useEffect(() => {
        const now = Date.now();
        const recentlyDeleted = jobs.find(j => {
            if (j.status !== 'deleted' || !j.deletedAt) return false;
            // ⚡ Bolt: Use a single Date.now() reference and optimize parsing
            // This avoids creating new Date objects inside the O(N) array search
            const deletedTime = typeof j.deletedAt === 'number' ? j.deletedAt : new Date(j.deletedAt).getTime();
            return now - deletedTime < 1000;
        });

        if (recentlyDeleted && (!deletedJob || deletedJob.id !== recentlyDeleted.id)) {
            setDeletedJob(recentlyDeleted);
            setTimeLeft(10); // 10 second undo window
        }
    }, [jobs, deletedJob]);

    // Countdown timer
    useEffect(() => {
        if (timeLeft > 0 && deletedJob) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0 && deletedJob) {
            // Timer expired - clear toast (job stays in deleted)
            setDeletedJob(null);
        }
    }, [timeLeft, deletedJob]);

    const handleUndo = () => {
        if (deletedJob) {
            restoreJob(deletedJob.id);
            setDeletedJob(null);
        }
    };

    const handleDismiss = () => {
        setDeletedJob(null);
    };

    if (!deletedJob) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-app)',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            animation: 'slideUp 0.3s ease-out'
        }}>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateX(-50%) translateY(100%); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `}</style>

            <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '500' }}>
                    "{deletedJob.role}" moved to trash
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                    Undo in {timeLeft}s
                </p>
            </div>

            <button
                onClick={handleUndo}
                style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                }}
            >
                <Undo2 size={16} /> Undo
            </button>

            <button
                onClick={handleDismiss}
                aria-label="Dismiss undo notification"
                title="Dismiss undo notification"
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px'
                }}
            >
                <X size={18} />
            </button>
        </div>
    );
}
