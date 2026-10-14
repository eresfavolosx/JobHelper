"use client";
import './globals.css';
import { useState, useEffect, Suspense, useSyncExternalStore } from 'react';
import { Plus, LogOut, LayoutDashboard, Columns, User, Download, Menu, X, Shield, Sparkles, Target } from 'lucide-react';

const emptySubscribe = () => () => {};
import AddJobModal from '@/components/AddJobModal';
import Link from 'next/link';
import { sanitizeUrl } from '@/lib/utils';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useUIStore } from '@/lib/uiStore';
import DailyReminder from '@/components/DailyReminder';
import UndoToast from '@/components/UndoToast';
import { useAuth } from '@/lib/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAppStore } from '@/lib/store';
import { isOwner, isProUser } from '@/lib/subscription';
import NotificationCenter from '@/components/NotificationCenter';
import MorningSyncModal from '@/components/MorningSyncModal';
import { calculateGoalProgress, DEFAULT_GOAL } from '@/lib/goal-tracker';
import GoalCustomizationModal from '@/components/GoalCustomizationModal';
import ThemeSwitcher from '@/components/ThemeSwitcher';



// Separate component to use useSearchParams safely inside Suspense
function UrlListener() {
    const searchParams = useSearchParams();
    const openEditJobModal = useUIStore(s => s.openEditJobModal);

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'auto-open') {
            const role = searchParams.get('role');
            const company = searchParams.get('company');
            const rawUrl = searchParams.get('url');
            const status = searchParams.get('status') || 'wishlist';
            const salary = searchParams.get('salary');
            const location = searchParams.get('location');
            const description = searchParams.get('description');

            // Sanitize the URL to prevent XSS
            const url = rawUrl ? sanitizeUrl(rawUrl) : '';

            // Clean URL
            window.history.replaceState({}, '', '/');

            // Open modal with this "phantom" job data
            openEditJobModal({
                role,
                company,
                url,
                status,
                salary,
                location,
                notes: description
            });
        }
    }, [searchParams, openEditJobModal]);

    return null;
}

import { AuthProvider } from '@/lib/auth-context';

/* ... imports ... */

function AuthenticatedLayout({ children }) {
    const { user } = useAuth();
    const { isJobModalOpen, closeJobModal, editingJob } = useUIStore();
    const [morningSyncOpen, setMorningSyncOpen] = useState(false);

    // Auto-launch Morning Career Radar on the first login of each day
    useEffect(() => {
        if (!user) return;
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastSync = localStorage.getItem('novujobs_last_morning_sync');
        if (lastSync !== todayStr) {
            const timer = setTimeout(() => {
                setMorningSyncOpen(true);
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [user]);

    // If loading, AuthProvider shows the spinner, so this won't render
    // If no user, show only the children (login page) without sidebar
    if (!user) {
        return (
            <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                {children}
            </main>
        );
    }

    // User is authenticated - show full layout
    return (
        <>
            <NavContent onOpenMorningSync={() => setMorningSyncOpen(true)} />
            <main className="main-content">
                {children}
            </main>

            <Suspense fallback={null}>
                <UrlListener />
            </Suspense>
            <DailyReminder />
            <UndoToast />
            <AddJobModal
                isOpen={isJobModalOpen}
                onClose={closeJobModal}
                initialData={editingJob}
            />
            <MorningSyncModal
                isOpen={morningSyncOpen}
                onClose={() => setMorningSyncOpen(false)}
                autoLaunched={true}
            />
        </>
    );
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <title>NovuJobs - AI Career Command Center</title>
                <meta name="description" content="AI career command center and smart job application tracking by Novu." />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                        (function() {
                            try {
                                var stored = localStorage.getItem('novujobs_theme');
                                if (stored === 'light' || stored === 'dark') {
                                    document.documentElement.setAttribute('data-theme', stored);
                                    document.documentElement.setAttribute('data-theme-forced', 'true');
                                } else {
                                    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                                    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
                                }
                            } catch(e) {}
                        })();
                        `
                    }}
                />
            </head>
            <body style={{ display: 'flex', minHeight: '100vh' }}>
                <AuthProvider>
                    <AuthenticatedLayout>
                        {children}
                    </AuthenticatedLayout>
                </AuthProvider>
            </body>
        </html>
    );
}

function NavContent({ onOpenMorningSync }) {
    const { openNewJobModal } = useUIStore();
    const { user } = useAuth();
    const profile = useAppStore((state) => state.profile);
    const jobs = useAppStore((state) => state.jobs);
    const router = useRouter();
    const pathname = usePathname();

    const isPlatformOwner = isOwner(user);
    const isPro = isProUser(user, profile);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    const goalProgress = calculateGoalProgress(jobs, profile?.applicationGoal || DEFAULT_GOAL);

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    // Helper for link styling - only apply after client mount
    const linkStyle = (href) => {
        const isActive = mounted && pathname === href;
        return {
            padding: '10px',
            borderRadius: '6px',
            background: isActive ? 'var(--bg-card)' : 'transparent',
            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: isActive ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        };
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                className="mobile-menu-btn"
                onClick={toggleMobileMenu}
                aria-label="Toggle menu"
                title="Toggle menu"
            >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar Overlay */}
            <div
                className={`sidebar-overlay ${isMobileMenuOpen ? 'open' : ''}`}
                onClick={closeMobileMenu}
            />

            {/* FAB for adding jobs (Mobile Only via CSS) */}
            <button
                className="fab-btn"
                onClick={openNewJobModal}
                aria-label="Add New Job"
                title="Add New Job"
            >
                <Plus size={24} />
            </button>

            <nav className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        Novu<span style={{ color: 'var(--accent-primary)' }}>Jobs</span>
                    </h1>
                    <NotificationCenter onOpenMorningSync={onOpenMorningSync} />
                </div>

                <button
                    onClick={() => {
                        openNewJobModal();
                        closeMobileMenu();
                    }}
                    aria-label="Add New Job"
                    title="Add New Job"
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    <Plus size={18} /> New Job
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Link href="/" onClick={closeMobileMenu} style={linkStyle('/')}>
                        <LayoutDashboard size={18} /> Dashboard
                    </Link>
                    <Link href="/kanban" onClick={closeMobileMenu} style={linkStyle('/kanban')}>
                        <Columns size={18} /> Board
                    </Link>
                    <Link href="/recommendations" onClick={closeMobileMenu} style={linkStyle('/recommendations')}>
                        <Sparkles size={18} /> Recommendations
                    </Link>

                    {/* Mini Application Goal Tracker Card */}
                    <div 
                        onClick={() => setGoalModalOpen(true)}
                        style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            background: 'var(--glass-highlight)',
                            border: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            marginTop: '4px',
                            transition: 'all 0.2s ease'
                        }}
                        className="interactive-card"
                        title="Click to customize application target and cadence"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                <Target size={13} color="var(--accent-primary)" />
                                <span>Goal ({goalProgress.cadence})</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: goalProgress.percentage >= 100 ? '#10b981' : 'var(--accent-primary)' }}>
                                {goalProgress.count}/{goalProgress.target}
                            </span>
                        </div>
                        <div style={{ width: '100%', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{
                                width: `${goalProgress.percentage}%`,
                                height: '100%',
                                background: goalProgress.percentage >= 100 ? '#10b981' : 'var(--accent-primary)',
                                borderRadius: '3px'
                            }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span>{goalProgress.percentage}% reached</span>
                            <span>{goalProgress.pace === 'completed' ? 'Crushed! 🎉' : goalProgress.pace === 'on_track' ? 'On track 🚀' : 'Behind pace'}</span>
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '8px 0' }} />
                    <Link href="/profile" onClick={closeMobileMenu} style={linkStyle('/profile')}>
                        <User size={18} /> My Profile
                    </Link>
                    <Link href="/install" onClick={closeMobileMenu} style={linkStyle('/install')} className="desktop-only">
                        <Download size={18} /> Install Extension
                    </Link>
                    <Link href="/privacy" onClick={closeMobileMenu} style={linkStyle('/privacy')}>
                        <Shield size={18} /> Privacy Policy
                    </Link>
                    <Link href="/terms" onClick={closeMobileMenu} style={linkStyle('/terms')}>
                        <Shield size={18} /> Terms of Service
                    </Link>
                </div>

                {/* Appearance / Theme Switcher */}
                <div style={{ marginTop: 'auto', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Appearance
                        </span>
                    </div>
                    <ThemeSwitcher style={{ width: '100%', justifyContent: 'space-between' }} />
                </div>

                {/* User Profile & Sign Out Section */}
                {user && (
                    <div style={{
                        marginTop: '12px',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px',
                            borderRadius: '8px',
                            background: 'var(--bg-card)'
                        }}>
                            {user.photoURL ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={user.photoURL}
                                    alt="Profile"
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        objectFit: 'cover'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: 'var(--accent-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold'
                                }}>
                                    {user.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            )}
                            <div style={{ overflow: 'hidden' }}>
                                <p style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {user.displayName || 'User'}
                                </p>
                                <p style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {user.email}
                                </p>
                                <div style={{ marginTop: '4px' }}>
                                    {isPlatformOwner ? (
                                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'linear-gradient(135deg, #eab308, #ca8a04)', color: 'black', fontWeight: 'bold' }}>
                                            👑 OWNER
                                        </span>
                                    ) : isPro ? (
                                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--accent-primary)', color: 'white', fontWeight: 'bold' }}>
                                            ⭐ PRO
                                        </span>
                                    ) : (
                                        <Link 
                                            href="/profile#subscription-section" 
                                            onClick={closeMobileMenu} 
                                            style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'bold' }}
                                        >
                                            Free (25 Cap) · Upgrade
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleSignOut}
                            aria-label="Sign Out"
                            title="Sign Out"
                            style={{
                                padding: '10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                )}

                <GoalCustomizationModal
                    isOpen={goalModalOpen}
                    onClose={() => setGoalModalOpen(false)}
                />
            </nav>
        </>
    );
}
