"use client";
import './globals.css';
import { useState, useEffect, Suspense, useSyncExternalStore, useMemo } from 'react';
import { Plus, LogOut, LayoutDashboard, Columns, User, Download, Menu, X, Shield, Sparkles, Target, Search, PanelLeftClose, PanelLeftOpen, BarChart3, Bot } from 'lucide-react';

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
import { filterJobsByCycle } from '@/lib/cycle-utils';
import GoalCustomizationModal from '@/components/GoalCustomizationModal';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import AiSafetyBadge from '@/components/AiSafetyBadge';
import GlobalJobSearchModal from '@/components/GlobalJobSearchModal';
import GoalCelebrationOverlay from '@/components/GoalCelebrationOverlay';
import OfferAcceptedCycleModal from '@/components/OfferAcceptedCycleModal';
import AgentModeHud from '@/components/AgentModeHud';
import { AGENT_SELECTORS, buildAgentSnapshot } from '@/lib/agent-helper';



function cleanIncomingText(raw) {
    if (!raw) return '';
    return String(raw)
        .replace(/â€”/g, ' - ')
        .replace(/â€“/g, '-')
        .replace(/â€™/g, "'")
        .replace(/â€œ|â€\u009d/g, '"')
        .replace(/Â·|â€¢/g, ' ')
        .replace(/Â/g, '')
        .replace(/ðŸš€/g, '')
        .replace(/&(amp|lt|gt|quot|#39|#x27|apos|nbsp|ndash|mdash|bull|middot);/gi, (m) => {
            const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&nbsp;': ' ', '&ndash;': '-', '&mdash;': ' - ', '&bull;': ' ', '&middot;': ' ' };
            return map[m.toLowerCase()] ?? m;
        })
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\uFFFD\uE000-\uF8FF]/g, '')
        .replace(/^\(\d+\+?\)\s*/, '')
        .replace(/^[\s•·|‣⁃\-–—]+|[\s•·|‣⁃\-–—]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Separate component to use useSearchParams safely inside Suspense
function UrlListener() {
    const searchParams = useSearchParams();
    const openEditJobModal = useUIStore(s => s.openEditJobModal);

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'auto-open') {
            const role = cleanIncomingText(searchParams.get('role'));
            const company = cleanIncomingText(searchParams.get('company'));
            const rawUrl = searchParams.get('url');
            const rawStatus = searchParams.get('status') || 'wishlist';
            const validStatuses = ['wishlist', 'applied', 'screening', 'interviewing', 'offer', 'accepted', 'rejected'];
            const status = validStatuses.includes(rawStatus) ? rawStatus : 'wishlist';
            const salary = cleanIncomingText(searchParams.get('salary'));
            const location = cleanIncomingText(searchParams.get('location'));
            const description = cleanIncomingText(searchParams.get('description'));
            const rawResumeUrl = searchParams.get('resumeUrl');
            const resumeName = cleanIncomingText(searchParams.get('resumeName'));

            // Sanitize URLs to prevent XSS
            const url = rawUrl ? sanitizeUrl(rawUrl) : '';
            const resumeUrl = rawResumeUrl ? sanitizeUrl(rawResumeUrl) : '';

            // Clean URL safely
            try {
                if (typeof window !== 'undefined' && window.history?.replaceState) {
                    window.history.replaceState({}, '', window.location.pathname || '/');
                }
            } catch (e) {
                console.warn('[UrlListener] Could not clear URL parameters:', e);
            }

            // Open modal with this "phantom" job data
            openEditJobModal({
                role,
                company,
                url,
                status,
                salary,
                location,
                notes: description,
                resumeUrl,
                resumeName
            });
        }
    }, [searchParams, openEditJobModal]);

    return null;
}

import { AuthProvider } from '@/lib/auth-context';
import AiCareerCoachModal from '@/components/AiCareerCoachModal';

/* ... imports ... */

function AuthenticatedLayout({ children }) {
    const { user } = useAuth();
    const jobs = useAppStore(state => state.jobs);
    const isJobModalOpen = useUIStore(state => state.isJobModalOpen);
    const closeJobModal = useUIStore(state => state.closeJobModal);
    const editingJob = useUIStore(state => state.editingJob);
    const openNewJobModal = useUIStore(state => state.openNewJobModal);
    const openGlobalSearch = useUIStore(state => state.openGlobalSearch);
    const toggleSidebarCollapse = useUIStore(state => state.toggleSidebarCollapse);
    const toggleAgentMode = useUIStore(state => state.toggleAgentMode);
    const setAgentMode = useUIStore(state => state.setAgentMode);
    const [morningSyncOpen, setMorningSyncOpen] = useState(false);
    const [coachJob, setCoachJob] = useState(null);

    const activeJobsCount = Array.isArray(jobs)
        ? jobs.filter(j => j && j.status !== 'deleted').length
        : 0;

    // Sync saved agent mode preference on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('novujobs_agent_mode');
            if (saved !== null) {
                setAgentMode(saved === 'true');
            }
        } catch {
            // Ignore storage access errors
        }
    }, [setAgentMode]);

    // Register Programmatic Agent Bridge on window for automated browser agents
    // Exposes structured read/write access to window.__NOVU_AGENT__ for Playwright, Puppeteer, Claude Computer Use, and DevTools
    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.__NOVU_AGENT__ = {
            version: '1.0.0',
            /** Current Agent Navigation Mode boolean status */
            get isAgentMode() {
                return useUIStore.getState().isAgentMode;
            },
            /** Programmatically toggle or set Agent Navigation Mode */
            toggleAgentMode: (val) => {
                if (typeof val === 'boolean') {
                    useUIStore.getState().setAgentMode(val);
                } else {
                    useUIStore.getState().toggleAgentMode();
                }
                return useUIStore.getState().isAgentMode;
            },
            /** Returns a full structured JSON snapshot of user, stats, UI, filters, and jobs */
            getSnapshot: () => {
                return buildAgentSnapshot({
                    appStoreState: useAppStore.getState(),
                    uiStoreState: useUIStore.getState(),
                    user
                });
            },
            /** Filter jobs by stage ('wishlist', 'applied', 'interviewing', 'offer', etc.) */
            getJobs: (statusFilter) => {
                const allJobs = useAppStore.getState().jobs || [];
                if (!statusFilter || statusFilter === 'all') return allJobs;
                return allJobs.filter(j => j && j.status === statusFilter);
            },
            /** Open Add/Edit application modal with optional prefilled data */
            openNewJobModal: (initialData) => useUIStore.getState().openNewJobModal(initialData),
            /** Close Add/Edit application modal */
            closeJobModal: () => useUIStore.getState().closeJobModal(),
            /** Open system-wide Role Search command palette (Cmd+K) */
            openGlobalSearch: (q) => useUIStore.getState().openGlobalSearch(q),
            /** Close Role Search command palette */
            closeGlobalSearch: () => useUIStore.getState().closeGlobalSearch(),
            /** Set board search query text */
            setBoardSearch: (q) => useUIStore.getState().setBoardSearchQuery(q),
            /** Update multi-parameter board filters */
            setBoardFilters: (f) => useUIStore.getState().setBoardFilters(f),
            /** Reset all board filters back to defaults */
            resetBoardFilters: () => useUIStore.getState().resetBoardFilters(),
            /** Standardized CSS selector dictionary for automated element targeting */
            selectors: AGENT_SELECTORS
        };
        return () => {
            delete window.__NOVU_AGENT__;
        };
    }, [user]);

    // Global keyboard shortcuts:
    // - Cmd+Shift+A / Ctrl+Shift+A toggles Agent Navigation Mode
    // - Cmd+K / Ctrl+K from anywhere opens Global Role Search
    // - Cmd+B / Ctrl+B toggles desktop sidebar collapse into icons
    // - 'N' (when not typing in a form field) quickly logs a new job
    useEffect(() => {
        if (!user) return;
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                toggleAgentMode();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                openGlobalSearch();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                toggleSidebarCollapse();
                return;
            }
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
            if ((e.key === 'n' || e.key === 'N') && !isJobModalOpen) {
                e.preventDefault();
                openNewJobModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [user, isJobModalOpen, openNewJobModal, openGlobalSearch, toggleSidebarCollapse, toggleAgentMode]);

    // Auto-launch Morning Career Radar on the first login of each day
    // Only auto-launch when the user already has tracked jobs and is not mid-save from the Chrome Extension
    useEffect(() => {
        if (!user || activeJobsCount === 0 || isJobModalOpen) return;
        if (typeof window !== 'undefined' && window.location.search.includes('action=auto-open')) return;
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastSync = localStorage.getItem('novujobs_last_morning_sync');
        if (lastSync !== todayStr) {
            const timer = setTimeout(() => {
                setMorningSyncOpen(true);
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [user, activeJobsCount, isJobModalOpen]);

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
            <AgentModeHud />
            <NavContent onOpenMorningSync={() => setMorningSyncOpen(true)} />
            <main className="main-content">
                {children}
            </main>

            <Suspense fallback={null}>
                <UrlListener />
            </Suspense>
            <DailyReminder />
            <UndoToast />
            <GlobalJobSearchModal />
            <GoalCelebrationOverlay />
            <OfferAcceptedCycleModal />
            <AddJobModal
                isOpen={isJobModalOpen}
                onClose={closeJobModal}
                initialData={editingJob}
            />
            <MorningSyncModal
                isOpen={morningSyncOpen}
                onClose={() => setMorningSyncOpen(false)}
                onOpenCoach={(job) => setCoachJob(job)}
                autoLaunched={true}
            />
            {coachJob && (
                <AiCareerCoachModal
                    isOpen={!!coachJob}
                    onClose={() => setCoachJob(null)}
                    job={coachJob}
                />
            )}
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
                                var agentStored = localStorage.getItem('novujobs_agent_mode');
                                if (agentStored === 'true') {
                                    document.documentElement.setAttribute('data-agent-mode', 'true');
                                }
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
                <div id="portal-root" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: 0, zIndex: 99999, pointerEvents: 'none' }} />
            </body>
        </html>
    );
}

function NavContent({ onOpenMorningSync }) {
    const openNewJobModal = useUIStore(state => state.openNewJobModal);
    const openGlobalSearch = useUIStore(state => state.openGlobalSearch);
    const isSidebarCollapsed = useUIStore(state => state.isSidebarCollapsed);
    const toggleSidebarCollapse = useUIStore(state => state.toggleSidebarCollapse);
    const setSidebarCollapsed = useUIStore(state => state.setSidebarCollapsed);
    const isAgentMode = useUIStore(state => state.isAgentMode);
    const toggleAgentMode = useUIStore(state => state.toggleAgentMode);
    const { user } = useAuth();
    const profile = useAppStore((state) => state.profile);
    const rawJobs = useAppStore((state) => state.jobs);
    const cycles = useAppStore((state) => state.cycles);
    const selectedCycleId = useAppStore((state) => state.selectedCycleId);
    const jobs = useMemo(() => filterJobsByCycle(rawJobs, cycles, selectedCycleId), [rawJobs, cycles, selectedCycleId]);
    const router = useRouter();
    const pathname = usePathname();

    const isPlatformOwner = isOwner(user);
    const isPro = isProUser(user, profile);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [goalModalOpen, setGoalModalOpen] = useState(false);
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    // Sync sidebar collapsed preference from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('novujobs_sidebar_collapsed');
            if (saved !== null) {
                setSidebarCollapsed(saved === 'true');
            }
        } catch {
            // Ignore storage access errors
        }
    }, [setSidebarCollapsed]);

    const goalProgress = calculateGoalProgress(jobs, profile?.applicationGoal || DEFAULT_GOAL);

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    const handleSignOut = async () => {
        try {
            useAppStore.getState().clearUserData();
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                className="mobile-menu-btn"
                data-agent-action="toggle-mobile-menu"
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
                data-agent-action="mobile-new-job"
                onClick={openNewJobModal}
                aria-label="Add New Job"
                title="Add New Job"
            >
                <Plus size={24} />
            </button>

            {/* Mobile Bottom Tab Bar (phones only via CSS) */}
            <nav className="mobile-bottom-nav" aria-label="Primary">
                <Link
                    href="/"
                    data-agent-nav="dashboard"
                    onClick={closeMobileMenu}
                    className={`mobile-bottom-link ${mounted && pathname === '/' ? 'active' : ''}`}
                    aria-current={mounted && pathname === '/' ? 'page' : undefined}
                >
                    <LayoutDashboard size={21} />
                    <span>Home</span>
                </Link>
                <Link
                    href="/kanban"
                    data-agent-nav="kanban"
                    onClick={closeMobileMenu}
                    className={`mobile-bottom-link ${mounted && pathname === '/kanban' ? 'active' : ''}`}
                    aria-current={mounted && pathname === '/kanban' ? 'page' : undefined}
                >
                    <Columns size={21} />
                    <span>Board</span>
                </Link>
                <button
                    type="button"
                    className="mobile-bottom-add"
                    data-agent-action="mobile-tab-new-job"
                    onClick={() => { closeMobileMenu(); openNewJobModal(); }}
                    aria-label="Add New Job"
                >
                    <Plus size={24} />
                </button>
                <Link
                    href="/insights"
                    data-agent-nav="insights"
                    onClick={closeMobileMenu}
                    className={`mobile-bottom-link ${mounted && pathname?.startsWith('/insights') ? 'active' : ''}`}
                    aria-current={mounted && pathname?.startsWith('/insights') ? 'page' : undefined}
                >
                    <BarChart3 size={21} />
                    <span>Insights</span>
                </Link>
                <button
                    type="button"
                    className={`mobile-bottom-link ${isMobileMenuOpen ? 'active' : ''}`}
                    onClick={toggleMobileMenu}
                    aria-expanded={isMobileMenuOpen}
                    aria-label="More menu"
                >
                    {isMobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
                    <span>More</span>
                </button>
            </nav>

            <nav className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                {/* Header: Expanded State */}
                <div className="sidebar-expanded-only" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <h1 className="sidebar-brand-text" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                        Novu<span style={{ color: 'var(--accent-primary)' }}>Jobs</span>
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <NotificationCenter onOpenMorningSync={onOpenMorningSync} />
                        <button
                            type="button"
                            data-agent-action="toggle-sidebar"
                            onClick={toggleSidebarCollapse}
                            aria-label="Collapse sidebar"
                            title="Collapse sidebar into icons (⌘B)"
                            className="sidebar-toggle-btn"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    </div>
                </div>

                {/* Header: Collapsed State */}
                <div className="sidebar-collapsed-only" style={{ flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <button
                        type="button"
                        data-agent-action="toggle-sidebar"
                        onClick={toggleSidebarCollapse}
                        aria-label="Expand sidebar"
                        title="Expand sidebar (⌘B)"
                        className="sidebar-toggle-btn sidebar-expand-btn"
                    >
                        <PanelLeftOpen size={18} />
                    </button>
                    <NotificationCenter onOpenMorningSync={onOpenMorningSync} />
                </div>

                {/* Add New Job Action Button */}
                <button
                    type="button"
                    data-agent-action="new-job"
                    onClick={() => {
                        openNewJobModal();
                        closeMobileMenu();
                    }}
                    aria-label="Add New Job (N)"
                    title="Add New Job (N)"
                    className="btn-primary sidebar-action-btn sidebar-new-job-btn"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    <Plus size={18} />
                    <span className="sidebar-label">New Job</span>
                </button>

                {/* Global Role Search Action Button */}
                <button
                    type="button"
                    data-agent-action="global-search"
                    onClick={() => {
                        closeMobileMenu();
                        openGlobalSearch();
                    }}
                    aria-label="Find Roles Across System (Command+K)"
                    title="Search roles by company, title, location, salary, or notes (⌘K)"
                    className="btn-secondary sidebar-action-btn sidebar-search-btn"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '9px 12px',
                        fontSize: '0.82rem',
                        fontWeight: 600
                    }}
                >
                    <span className="sidebar-search-inner">
                        <Search size={15} color="var(--accent-primary)" />
                        <span className="sidebar-label">Find Roles...</span>
                    </span>
                    <kbd className="sidebar-kbd sidebar-label" style={{
                        fontSize: '0.68rem',
                        padding: '2px 6px',
                        borderRadius: '5px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'inherit'
                    }}>
                        ⌘K
                    </kbd>
                </button>

                {/* Nav Links */}
                <div className="sidebar-nav-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <Link
                        href="/"
                        data-agent-nav="dashboard"
                        onClick={closeMobileMenu}
                        className={`sidebar-nav-link ${mounted && pathname === '/' ? 'active' : ''}`}
                        title={`Dashboard — Goal: ${goalProgress.count}/${goalProgress.target}`}
                        aria-label="Dashboard"
                    >
                        <span className="sidebar-nav-left">
                            <LayoutDashboard size={18} />
                            <span className="sidebar-label">Dashboard</span>
                        </span>
                        <span
                            role="button"
                            tabIndex={0}
                            className="sidebar-label sidebar-goal-pill"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setGoalModalOpen(true);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setGoalModalOpen(true);
                                }
                            }}
                            title={`Application Goal (${goalProgress.cadence}): ${goalProgress.count}/${goalProgress.target}. Click to customize.`}
                            style={{
                                background: goalProgress.percentage >= 100 ? 'rgba(16, 185, 129, 0.16)' : 'rgba(107, 126, 103, 0.15)',
                                color: goalProgress.percentage >= 100 ? 'var(--success)' : 'var(--accent-primary)',
                                cursor: 'pointer'
                            }}
                        >
                            {goalProgress.count}/{goalProgress.target}
                        </span>
                    </Link>

                    <Link
                        href="/kanban"
                        data-agent-nav="kanban"
                        onClick={closeMobileMenu}
                        className={`sidebar-nav-link ${mounted && pathname === '/kanban' ? 'active' : ''}`}
                        title={`Kanban Board (${jobs?.length || 0} applications)`}
                        aria-label="Kanban Board"
                    >
                        <span className="sidebar-nav-left">
                            <Columns size={18} />
                            {jobs?.length > 0 && <span className="sidebar-collapsed-dot" />}
                            <span className="sidebar-label">Board</span>
                        </span>
                        {jobs?.length > 0 && (
                            <span className="sidebar-label sidebar-count-pill">
                                {jobs.length}
                            </span>
                        )}
                    </Link>

                    <Link
                        href="/insights"
                        data-agent-nav="insights"
                        onClick={closeMobileMenu}
                        className={`sidebar-nav-link ${mounted && pathname?.startsWith('/insights') ? 'active' : ''}`}
                        title="Insights — pipeline flow, timeline, benchmarks & trends"
                        aria-label="Insights"
                    >
                        <span className="sidebar-nav-left">
                            <BarChart3 size={18} />
                            <span className="sidebar-label">Insights</span>
                        </span>
                    </Link>

                    <Link
                        href="/recommendations"
                        data-agent-nav="recommendations"
                        onClick={closeMobileMenu}
                        className={`sidebar-nav-link ${mounted && pathname === '/recommendations' ? 'active' : ''}`}
                        title="AI Job Recommendations"
                        aria-label="Job Recommendations"
                    >
                        <span className="sidebar-nav-left">
                            <Sparkles size={18} />
                            <span className="sidebar-label">Recommendations</span>
                        </span>
                    </Link>

                    <Link
                        href="/profile"
                        data-agent-nav="profile"
                        onClick={closeMobileMenu}
                        className={`sidebar-nav-link ${mounted && pathname === '/profile' ? 'active' : ''}`}
                        title="Job & Profile Settings"
                        aria-label="Job & Profile Settings"
                    >
                        <span className="sidebar-nav-left">
                            <User size={18} />
                            <span className="sidebar-label">Job & Profile Settings</span>
                        </span>
                    </Link>

                    {/* Dedicated Sidebar Application Goal Section */}
                    {/* Expanded Goal Card */}
                    <div className="sidebar-expanded-only sidebar-goal-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Target size={15} color={goalProgress.percentage >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                    {goalProgress.cadence} Goal
                                </span>
                            </div>
                            <span style={{
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: '999px',
                                background: goalProgress.percentage >= 100 ? 'rgba(78, 135, 82, 0.18)' : 'rgba(107, 126, 103, 0.15)',
                                color: goalProgress.percentage >= 100 ? 'var(--success)' : 'var(--accent-primary)'
                            }}>
                                {goalProgress.count}/{goalProgress.target}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div style={{
                            width: '100%',
                            height: '6px',
                            borderRadius: '999px',
                            background: 'var(--bg-panel)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${Math.min(100, goalProgress.percentage)}%`,
                                height: '100%',
                                borderRadius: '999px',
                                background: goalProgress.percentage >= 100
                                    ? 'linear-gradient(90deg, #4E8752, #6BA368)'
                                    : 'var(--accent-gradient)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            <span>{goalProgress.todayCount} applied today</span>
                            <span>{goalProgress.percentage}%</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setGoalModalOpen(true);
                                closeMobileMenu();
                            }}
                            className="btn-secondary"
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                borderRadius: '7px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px'
                            }}
                        >
                            <Target size={12} color="var(--accent-primary)" />
                            Customize Goal
                        </button>
                    </div>

                    {/* Collapsed Goal Button */}
                    <div className="sidebar-collapsed-only" style={{ justifyContent: 'center', width: '100%' }}>
                        <button
                            type="button"
                            onClick={() => setGoalModalOpen(true)}
                            title={`Application Goal (${goalProgress.cadence}): ${goalProgress.count}/${goalProgress.target} (${goalProgress.percentage}%). Click to customize.`}
                            aria-label={`Application Goal: ${goalProgress.count} of ${goalProgress.target}. Click to customize.`}
                            className="sidebar-collapsed-goal-btn"
                        >
                            <Target size={16} color={goalProgress.percentage >= 100 ? 'var(--success)' : 'var(--accent-primary)'} />
                            <span style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                lineHeight: 1,
                                color: goalProgress.percentage >= 100 ? 'var(--success)' : 'var(--text-secondary)'
                            }}>
                                {goalProgress.count}/{goalProgress.target}
                            </span>
                        </button>
                    </div>

                    {isPlatformOwner && (
                        <div style={{ margin: '4px 0', width: '100%' }}>
                            <div className="sidebar-expanded-only">
                                <AiSafetyBadge variant="navbar" />
                            </div>
                            <div className="sidebar-collapsed-only" style={{ justifyContent: 'center', width: '100%' }}>
                                <AiSafetyBadge variant="compact" />
                            </div>
                        </div>
                    )}

                    <hr className="sidebar-divider" />

                    <Link
                        href="/install"
                        onClick={closeMobileMenu}
                        className={`sidebar-nav-link desktop-only ${mounted && pathname === '/install' ? 'active' : ''}`}
                        title="Install Extension"
                        aria-label="Install Extension"
                    >
                        <span className="sidebar-nav-left">
                            <Download size={18} />
                            <span className="sidebar-label">Install Extension</span>
                        </span>
                    </Link>
                    <Link
                        href="/privacy"
                        onClick={closeMobileMenu}
                        className={`sidebar-nav-link ${mounted && pathname === '/privacy' ? 'active' : ''}`}
                        title="Privacy Policy"
                        aria-label="Privacy Policy"
                    >
                        <span className="sidebar-nav-left">
                            <Shield size={18} />
                            <span className="sidebar-label">Privacy Policy</span>
                        </span>
                    </Link>
                    <Link
                        href="/terms"
                        onClick={closeMobileMenu}
                        className={`sidebar-nav-link ${mounted && pathname === '/terms' ? 'active' : ''}`}
                        title="Terms of Service"
                        aria-label="Terms of Service"
                    >
                        <span className="sidebar-nav-left">
                            <Shield size={18} />
                            <span className="sidebar-label">Terms of Service</span>
                        </span>
                    </Link>
                </div>

                {/* Appearance / Theme Switcher */}
                <div className="sidebar-appearance-section">
                    <div className="sidebar-expanded-only" style={{ flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Appearance
                            </span>
                        </div>
                        <ThemeSwitcher style={{ width: '100%', justifyContent: 'space-between' }} />
                    </div>
                    <div className="sidebar-collapsed-only" style={{ justifyContent: 'center', width: '100%' }}>
                        <ThemeSwitcher collapsed={true} />
                    </div>
                </div>

                {/* Agent Mode Navigation Toggle */}
                <div className="sidebar-agent-section" style={{ width: '100%', padding: '0 4px', margin: '4px 0 8px 0' }}>
                    <div className="sidebar-expanded-only" style={{ flexDirection: 'column', gap: '6px', width: '100%' }}>
                        <button
                            type="button"
                            data-agent-action="toggle-agent-mode"
                            onClick={toggleAgentMode}
                            className={`sidebar-agent-toggle-btn ${isAgentMode ? 'active' : ''}`}
                            aria-pressed={isAgentMode}
                            aria-label="Toggle Agent Mode (Command+Shift+A)"
                            title="Toggle Agent Navigation Mode: Zero animations, high contrast & OCR-optimized (⌘⇧A)"
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Bot size={16} color={isAgentMode ? '#10b981' : 'var(--accent-primary)'} />
                                <span>Agent Mode</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <kbd className="sidebar-kbd" style={{
                                    fontSize: '0.65rem',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'inherit'
                                }}>
                                    ⌘⇧A
                                </kbd>
                                <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: isAgentMode ? '#10b981' : 'var(--bg-panel)',
                                    color: isAgentMode ? '#000' : 'var(--text-secondary)'
                                }}>
                                    {isAgentMode ? 'ON' : 'OFF'}
                                </span>
                            </span>
                        </button>
                    </div>
                    <div className="sidebar-collapsed-only" style={{ justifyContent: 'center', width: '100%' }}>
                        <button
                            type="button"
                            data-agent-action="toggle-agent-mode"
                            onClick={toggleAgentMode}
                            className={`sidebar-agent-toggle-btn-collapsed ${isAgentMode ? 'active' : ''}`}
                            aria-pressed={isAgentMode}
                            aria-label="Toggle Agent Mode (Command+Shift+A)"
                            title={`Agent Mode: ${isAgentMode ? 'ON' : 'OFF'} (⌘⇧A)`}
                        >
                            <Bot size={17} color={isAgentMode ? '#10b981' : 'currentColor'} />
                        </button>
                    </div>
                </div>

                {/* User Profile & Sign Out Section */}
                {user && (
                    <div className="sidebar-user-section">
                        {/* Expanded Profile Info */}
                        <div className="sidebar-expanded-only" style={{ flexDirection: 'column', gap: '12px', width: '100%' }}>
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
                                        textOverflow: 'ellipsis',
                                        margin: 0
                                    }}>
                                        {user.displayName || 'User'}
                                    </p>
                                    <p style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-secondary)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        margin: 0
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
                                                style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(107, 126, 103, 0.16)', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'bold' }}
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
                                className="sidebar-signout-btn"
                            >
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>

                        {/* Collapsed Profile & Sign Out */}
                        <div className="sidebar-collapsed-only" style={{ flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
                            <Link
                                href="/profile"
                                onClick={closeMobileMenu}
                                title={`${user.displayName || 'User'} (${user.email}) - Profile`}
                                aria-label="User profile settings"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textDecoration: 'none'
                                }}
                            >
                                {user.photoURL ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={user.photoURL}
                                        alt="Profile"
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            border: isPlatformOwner 
                                                ? '2px solid #eab308' 
                                                : isPro 
                                                    ? '2px solid var(--accent-primary)' 
                                                    : '1px solid var(--border-subtle)'
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
                                        fontWeight: 'bold',
                                        fontSize: '0.9rem',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                                    }}>
                                        {user.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                            </Link>
                            <button
                                onClick={handleSignOut}
                                aria-label="Sign Out"
                                title="Sign Out"
                                className="sidebar-signout-btn-collapsed"
                            >
                                <LogOut size={17} />
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            <GoalCustomizationModal
                isOpen={goalModalOpen}
                onClose={() => setGoalModalOpen(false)}
            />
        </>
    );
}
