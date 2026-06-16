"use client";
import Link from 'next/link';
import { Download, Plus, LayoutDashboard, Monitor } from 'lucide-react';
import { useUIStore } from '@/lib/uiStore';
import { useState, useEffect } from 'react';

export default function Onboarding() {
    // ⚡ Bolt: Use specific selector to prevent re-renders when other UI state changes
    const openNewJobModal = useUIStore(state => state.openNewJobModal);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div className="container" style={{ maxWidth: '800px', marginTop: '40px', marginLeft: 'auto', marginRight: 'auto', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '16px' }}>
                    Welcome to Job<span style={{ color: 'var(--accent-primary)' }}>Tracker</span>
                </h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
                    Let's get you hired! Choose how you want to start tracking your applications.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {/* Option 1: Manual (now first) */}
                <div
                    className="card interactive-card"
                    style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', border: '2px solid var(--accent-primary)' }}
                    onClick={openNewJobModal}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openNewJobModal();
                        }
                    }}
                >
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                        <Plus size={32} color="var(--accent-primary)" />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>Add Manually</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', flex: 1 }}>
                        Have a job link ready? Add it directly to your dashboard.
                    </p>
                    <button
                        onClick={(e) => { e.stopPropagation(); openNewJobModal(); }}
                        className="btn-primary"
                        style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                    >
                        <Plus size={18} /> Add Your First Job
                    </button>
                </div>

                {/* Option 2: Extension (now second, with mobile-specific content) */}
                {isMobile ? (
                    <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', opacity: 0.8 }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--glass-highlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <Monitor size={32} color="var(--text-secondary)" />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>
                            Browser Extension
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', flex: 1 }}>
                            Our Chrome extension lets you save jobs with one click. Visit this page on your desktop to install it.
                        </p>
                        <div style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'var(--glass-panel)',
                            borderRadius: '12px',
                            color: 'var(--text-secondary)',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            justifyContent: 'center'
                        }}>
                            <Monitor size={16} /> Desktop Only
                        </div>
                    </div>
                ) : (
                    <Link href="/install" className="card interactive-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--glass-highlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <Download size={32} color="var(--text-primary)" />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '12px' }}>
                            Use the Extension
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', flex: 1 }}>
                            Automatically capture jobs from LinkedIn, Indeed, and more with one click.
                        </p>
                        <div className="btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}>
                            <Download size={18} /> Install Extension
                        </div>
                    </Link>
                )}
            </div>

            <div style={{ marginTop: '60px', padding: '24px', background: 'var(--bg-card)', borderRadius: '12px', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ minWidth: '40px', height: '40px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LayoutDashboard size={20} color="white" />
                </div>
                <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px' }}>Your Command Center</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        Once you add your first job, this dashboard will transform into your personal command center. Track interviews, get reminders, and manage your offers—all in one place.
                    </p>
                </div>
            </div>
        </div>
    );
}
