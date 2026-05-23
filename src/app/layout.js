"use client";
import './globals.css';
import { useState, useEffect, Suspense } from 'react';
import { Plus, LogOut, LayoutDashboard, Columns, User, Download, Menu, X, Shield, Sparkles } from 'lucide-react';
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
    const { user, loading } = useAuth();
    // ⚡ Bolt: Use specific selectors instead of destructuring the whole store to prevent
    // unnecessary re-renders when other state changes
    const isJobModalOpen = useUIStore(state => state.isJobModalOpen);
    const closeJobModal = useUIStore(state => state.closeJobModal);
    const editingJob = useUIStore(state => state.editingJob);

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
            <NavContent />
            <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
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
        </>
    );
}

export default function RootLayout({ children }) {
    return (
        <html lang="en">
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

function NavContent() {
    // ⚡ Bolt: Use specific selector instead of destructuring the whole store
    const openNewJobModal = useUIStore(state => state.openNewJobModal);
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

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
                <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    Job<span style={{ color: 'var(--accent-primary)' }}>Tracker</span>
                </h1>

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

                {/* User Profile & Sign Out Section */}
                {user && (
                    <div style={{
                        marginTop: 'auto',
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
            </nav>
        </>
    );
}
