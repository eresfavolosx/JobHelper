"use client";
import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { 
    Bell, CheckCircle2, Clock, AlertTriangle, Sparkles, 
    X, ChevronRight, Send, Sunrise, Mail
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import Link from 'next/link';

const emptySubscribe = () => () => {};

export default function NotificationCenter({ onSelectJobForCoach, onOpenMorningSync, onOpenGmailSync }) {
    const jobs = useAppStore(state => state.jobs);
    const [isOpen, setIsOpen] = useState(false);
    const [dismissedIds, setDismissedIds] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('novujobs_dismissed_notifications');
                if (saved) return new Set(JSON.parse(saved));
            } catch {}
        }
        return new Set();
    });
    const [desktopGranted, setDesktopGranted] = useState(() => {
        return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
    });
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [coords, setCoords] = useState(null);

    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);

    // Dynamically compute and clamp coordinates to ensure it NEVER overflows ANY viewport
    useEffect(() => {
        if (!isOpen || !buttonRef.current) return;

        const updateCoords = () => {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Target width: 360px on desktop, or clamped to viewport width minus safety padding
            const width = Math.min(360, Math.max(280, viewportWidth - 24));

            // Vertical positioning: default below button
            let top = rect.bottom + 8;
            let maxHeight = Math.min(480, viewportHeight - top - 16);

            // Flip above button if not enough vertical room below and room above
            if (maxHeight < 220 && rect.top > 250) {
                maxHeight = Math.min(440, rect.top - 24);
                top = Math.max(12, rect.top - maxHeight - 8);
            }

            // Horizontal positioning:
            // Prefer aligning right edge of dropdown with right edge of button
            let left = rect.right - width;

            // If it spills off the left edge (e.g. when in the sidebar on the left of the screen):
            if (left < 12) {
                // Align with left edge of button, or clamp to 12px from viewport left edge
                left = Math.max(12, rect.left);
            }

            // If it spills off the right edge:
            if (left + width > viewportWidth - 12) {
                left = Math.max(12, viewportWidth - width - 12);
            }

            setCoords({ top, left, width, maxHeight });
        };

        updateCoords();
        window.addEventListener('resize', updateCoords);
        window.addEventListener('scroll', updateCoords, true);

        return () => {
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target) &&
                buttonRef.current && 
                !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }
        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
            window.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('touchstart', handleClickOutside);
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isOpen]);

    const [now] = useState(() => new Date());

    // Compute notifications based on active jobs
    const notifications = useMemo(() => {
        const list = [];
        const activeJobs = jobs.filter(j => j && j.status !== 'deleted');

        activeJobs.forEach(job => {
            const refDate = job.updatedAt || job.appliedAt || job.createdAt || job.dateAdded;
            if (!refDate) return;
            const diff = now.getTime() - new Date(refDate).getTime();
            const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));

            if (job.status === 'applied' || job.status === 'interviewing') {
                if (days >= 10) {
                    list.push({
                        id: `ghost-${job.id}`,
                        jobId: job.id,
                        type: 'ghost',
                        title: `Ghost Alert: ${job.company}`,
                        message: `No updates for ${days} days on your ${job.role || job.title} application. High chance of dropping off without a nudge.`,
                        days,
                        color: '#ef4444',
                        job
                    });
                } else if (days >= 5) {
                    list.push({
                        id: `followup-${job.id}`,
                        jobId: job.id,
                        type: 'followup',
                        title: `Follow-Up Window: ${job.company}`,
                        message: `${days} days since applied for ${job.role || job.title}. This is the optimal window to send a value-add follow-up.`,
                        days,
                        color: '#f59e0b',
                        job
                    });
                }
            }
        });

        // Add recommendation tip
        list.push({
            id: 'daily-recommendations',
            type: 'tip',
            title: 'AI Matches Refreshed',
            message: 'Check out newly scraped remote roles scored with Gemini 3.8 Flash against your profile.',
            color: 'var(--accent-primary)',
            link: '/recommendations'
        });

        return list.filter(item => !dismissedIds.has(item.id));
    }, [jobs, dismissedIds, now]);

    const unreadCount = notifications.length;

    const dismissNotification = (id) => {
        const next = new Set(dismissedIds).add(id);
        setDismissedIds(next);
        try {
            localStorage.setItem('novujobs_dismissed_notifications', JSON.stringify(Array.from(next)));
        } catch {}
    };

    const markAllRead = () => {
        const allIds = new Set([...dismissedIds, ...notifications.map(n => n.id)]);
        setDismissedIds(allIds);
        try {
            localStorage.setItem('novujobs_dismissed_notifications', JSON.stringify(Array.from(allIds)));
        } catch {}
    };

    const requestDesktopNotifications = async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            const perm = await Notification.requestPermission();
            setDesktopGranted(perm === 'granted');
            if (perm === 'granted') {
                new Notification('NovuJobs Notifications Active', {
                    body: 'You will receive timely desktop alerts for interview follow-ups and status changes.',
                    icon: '/favicon.ico'
                });
            }
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Bell Trigger Button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
                title="Notifications"
                style={{
                    position: 'relative',
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: isOpen ? 'var(--accent-primary)' : 'var(--glass-highlight)',
                    border: '1px solid var(--border-subtle)',
                    color: isOpen ? 'white' : 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        minWidth: '18px',
                        height: '18px',
                        padding: '0 4px',
                        borderRadius: '10px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Menu Portaled to document.body for zero-overflow guarantee */}
            {isOpen && mounted && coords && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    className="card animate-scale-up"
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        maxHeight: `${coords.maxHeight}px`,
                        overflowY: 'auto',
                        padding: '16px',
                        zIndex: 99999,
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7), 0 0 0 1px var(--border-subtle)',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-app)',
                        boxSizing: 'border-box'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Bell size={16} color="var(--accent-primary)" /> Notifications ({unreadCount})
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {onOpenMorningSync && (
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onOpenMorningSync();
                            }}
                            className="btn-secondary"
                            style={{
                                width: '100%',
                                justifyContent: 'center',
                                fontSize: '0.8rem',
                                padding: '8px 10px',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'linear-gradient(135deg, rgba(212, 163, 115, 0.18), rgba(94, 135, 110, 0.14))',
                                border: '1px solid rgba(212, 163, 115, 0.35)'
                            }}
                        >
                            <Sunrise size={14} color="var(--warning)" /> Run Morning Career Radar
                        </button>
                    )}

                    {/* Enable Desktop Notifications banner if not yet enabled */}
                    {!desktopGranted && (
                        <div style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(94, 135, 110, 0.12)',
                            border: '1px solid rgba(94, 135, 110, 0.28)',
                            marginBottom: '12px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <div>
                                <span style={{ fontWeight: 'bold' }}>Desktop Alerts</span>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Never miss recruiter follow-ups</div>
                            </div>
                            <button
                                onClick={requestDesktopNotifications}
                                className="btn-primary"
                                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            >
                                Enable
                            </button>
                        </div>
                    )}

                    {notifications.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
                            All caught up! No urgent follow-ups or ghost alerts right now.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {notifications.map((item) => (
                                <div key={item.id} style={{
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-panel)',
                                    border: '1px solid var(--border-subtle)',
                                    position: 'relative'
                                }}>
                                    <button
                                        onClick={() => dismissNotification(item.id)}
                                        style={{
                                            position: 'absolute',
                                            top: '6px',
                                            right: '6px',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            padding: '2px'
                                        }}
                                        title="Dismiss"
                                    >
                                        <X size={14} />
                                    </button>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        {item.type === 'ghost' ? (
                                            <AlertTriangle size={14} color="#ef4444" />
                                        ) : item.type === 'followup' ? (
                                            <Clock size={14} color="#f59e0b" />
                                        ) : (
                                            <Sparkles size={14} color="var(--accent-primary)" />
                                        )}
                                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: item.color }}>
                                            {item.title}
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: item.job ? '8px' : '0' }}>
                                        {item.message}
                                    </div>

                                    {item.job && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                            {onSelectJobForCoach && (
                                                <button
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        onSelectJobForCoach(item.job);
                                                    }}
                                                    className="btn-secondary"
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        padding: '4px 8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Send size={11} /> 1-Click Follow-Up
                                                </button>
                                            )}

                                            {onOpenGmailSync && (
                                                <button
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        onOpenGmailSync(item.job.company);
                                                    }}
                                                    className="btn-secondary"
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        padding: '4px 8px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                                        background: 'rgba(56, 189, 248, 0.08)'
                                                    }}
                                                    title={`Scan Gmail for any communications regarding ${item.job.company}`}
                                                >
                                                    <Mail size={11} color="var(--accent-primary)" /> Check Gmail
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {item.link && (
                                        <Link
                                            href={item.link}
                                            onClick={() => setIsOpen(false)}
                                            style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--accent-primary)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                marginTop: '4px',
                                                textDecoration: 'none',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            View Matches <ChevronRight size={12} />
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
