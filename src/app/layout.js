"use client";
import './globals.css';
import { useState, useEffect, Suspense } from 'react';
import { Plus } from 'lucide-react';
import AddJobModal from '@/components/AddJobModal';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useUIStore } from '@/lib/uiStore';
import DailyReminder from '@/components/DailyReminder';


// Separate component to use useSearchParams safely inside Suspense
function UrlListener() {
    const searchParams = useSearchParams();
    const openEditJobModal = useUIStore(s => s.openEditJobModal);

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'auto-open') {
            const role = searchParams.get('role');
            const company = searchParams.get('company');
            const url = searchParams.get('url');
            const status = searchParams.get('status');

            // Clean URL
            window.history.replaceState({}, '', '/');

            // Open modal with this "phantom" job data
            openEditJobModal({ role, company, url, status });
        }
    }, [searchParams, openEditJobModal]);

    return null;
}

export default function RootLayout({ children }) {
    const { isJobModalOpen, closeJobModal, openNewJobModal, editingJob } = useUIStore();

    return (
        <html lang="en">
            <body style={{ display: 'flex', minHeight: '100vh' }}>
                <nav style={{
                    width: '250px',
                    backgroundColor: 'var(--bg-panel)',
                    borderRight: '1px solid var(--border-subtle)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        Job<span style={{ color: 'var(--accent-primary)' }}>Tracker</span>
                    </h1>

                    <button
                        onClick={openNewJobModal}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <Plus size={18} /> New Job
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Link href="/" style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Dashboard</Link>
                        <Link href="/kanban" style={{ padding: '10px', borderRadius: '6px', color: 'var(--text-secondary)' }}>Board</Link>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '8px 0' }} />
                        <Link href="/profile" style={{ padding: '10px', borderRadius: '6px', color: 'var(--text-secondary)' }}>My Profile</Link>
                    </div>
                </nav>

                <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
                    {children}
                </main>

                <Suspense fallback={null}>
                    <UrlListener />
                </Suspense>
                <DailyReminder />

            </body>
        </html >
    );
}
