"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    Sunrise, Clock, Mail, X, ChevronRight, Send, Target
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getStoredGmailToken, fetchRecentJobEmails } from '@/lib/gmail-service';
import { generateWithFallback, extractJson } from '@/lib/gemini-client';
import { calculateGoalProgress, DEFAULT_GOAL } from '@/lib/goal-tracker';
import { findMatchingJob, classifyEmailIntent } from '@/lib/email-matcher';
import { safeDate } from '@/lib/utils';

export default function MorningSyncModal({ isOpen, onClose, onOpenCoach, autoLaunched = false }) {
    const jobs = useAppStore(state => state.jobs);
    const moveJob = useAppStore(state => state.moveJob);
    const updateJob = useAppStore(state => state.updateJob);
    const profile = useAppStore(state => state.profile);

    const goalProgress = calculateGoalProgress(jobs, profile?.applicationGoal || DEFAULT_GOAL);

    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Initializing Morning Career Radar...');
    const [syncComplete, setSyncComplete] = useState(false);
    const [briefing, setBriefing] = useState({
        ghostAlerts: [],
        followUpAlerts: [],
        emailUpdates: []
    });
    const [appliedEmailUpdates, setAppliedEmailUpdates] = useState(new Set());
    const mouseDownTargetRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        // Mark today's sync immediately when opened so dismissing early never re-triggers it on refresh
        try {
            const todayStr = new Date().toISOString().slice(0, 10);
            localStorage.setItem('novujobs_last_morning_sync', todayStr);
        } catch {}

        let isCancelled = false;

        const runMorningSync = async () => {
            setProgress(10);
            setStatusText('Analyzing active applications & follow-up timelines...');
            await new Promise(r => setTimeout(r, 600));
            if (isCancelled) return;

            // Step 1: Scan pipeline
            const activeJobs = jobs.filter(j => j && j.status !== 'deleted');
            const ghosts = [];
            const followUps = [];

            activeJobs.forEach(job => {
                if (job.status === 'applied' || job.status === 'screening' || job.status === 'interviewing') {
                    const latestFollowUp = Array.isArray(job.followUps) && job.followUps.length > 0
                        ? job.followUps[0].date
                        : null;
                    const refDate = job.lastFollowUpAt || latestFollowUp || job.lastInteraction || job.updatedAt || job.appliedAt || job.createdAt || job.dateAdded;
                    if (!refDate) return;
                    const diff = Date.now() - safeDate(refDate).getTime();
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    if (!isNaN(days)) {
                        const cleanDays = Math.max(0, days);
                        if (cleanDays >= 10) ghosts.push({ ...job, days: cleanDays });
                        else if (cleanDays >= 5) followUps.push({ ...job, days: cleanDays });
                    }
                }
            });

            setProgress(40);
            setStatusText('Checking recruiter emails & status communications...');
            await new Promise(r => setTimeout(r, 600));
            if (isCancelled) return;

            // Step 2: Check Gmail direct if connected
            let detectedUpdates = [];
            const gmailToken = getStoredGmailToken();

            if (gmailToken) {
                try {
                    setStatusText('Querying Gmail inbox for recent recruiter responses...');
                    const targetCompanies = [...ghosts, ...followUps, ...activeJobs.slice(0, 10)].map(j => j.company);
                    const rawEmails = await fetchRecentJobEmails(gmailToken, 30, targetCompanies);

                    if (rawEmails && rawEmails.length > 0) {
                        setStatusText('Analyzing recruiter email threads with AI Engine...');
                        setProgress(65);

                        const activeJobsList = activeJobs.map(j => ({
                            id: j.id,
                            company: j.company,
                            role: j.role || j.title,
                            status: j.status
                        }));

                        const prompt = `Analyze these incoming job emails against active applications:
<applications>
${JSON.stringify(activeJobsList)}
</applications>
<emails>
${JSON.stringify(rawEmails.map(e => ({ subject: e.subject, from: e.from, snippet: e.snippet })))}
</emails>

Return ONLY a JSON array of status changes:
[
  {
    "company": "Company Name",
    "matchedJobId": "id-or-null",
    "matchedJobCurrentStatus": "applied",
    "suggestedStatus": "interviewing | offer | rejected | applied",
    "summary": "1 sentence explanation",
    "keyQuote": "quote from email"
  }
]`;
                        try {
                            const res = await generateWithFallback(prompt, { jsonMode: true });
                            const parsed = extractJson(res);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                detectedUpdates = parsed;
                            }
                        } catch (aiErr) {
                            console.warn('[MorningSync] Gemini AI generation skipped, using deterministic matcher:', aiErr);
                        }

                        // Local deterministic fallback if AI didn't return matches
                        if (detectedUpdates.length === 0) {
                            for (const email of rawEmails) {
                                const matched = findMatchingJob(email, activeJobsList);
                                const intent = classifyEmailIntent(`${email.subject} ${email.snippet}`);
                                if (matched || intent.suggestedStatus) {
                                    detectedUpdates.push({
                                        company: matched?.company || email.from.split('@')[0],
                                        matchedJobId: matched?.id || null,
                                        matchedJobCurrentStatus: matched?.status || 'applied',
                                        suggestedStatus: intent.suggestedStatus || 'interviewing',
                                        summary: intent.category === 'interview_invite'
                                            ? `Interview / screening invitation from ${matched?.company || 'recruiter'}`
                                            : intent.category === 'offer'
                                            ? `Job offer from ${matched?.company || 'recruiter'}!`
                                            : `Status update regarding your application`,
                                        keyQuote: email.snippet.slice(0, 140) + '...'
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[MorningSync] Gmail check skipped/failed:', e);
                }
            }

            setProgress(85);
            setStatusText('Compiling daily career recommendations...');
            await new Promise(r => setTimeout(r, 500));
            if (isCancelled) return;

            setProgress(100);
            setStatusText('Morning Career Briefing Ready!');
            setBriefing({
                ghostAlerts: ghosts,
                followUpAlerts: followUps,
                emailUpdates: detectedUpdates
            });
            setSyncComplete(true);

            // Save sync date so it only auto-runs once per day
            const todayStr = new Date().toISOString().slice(0, 10);
            localStorage.setItem('novujobs_last_morning_sync', todayStr);
        };

        const timer = setTimeout(() => {
            if (isCancelled) return;
            setProgress(0);
            setSyncComplete(false);
            runMorningSync();
        }, 0);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [isOpen, jobs]);

    if (!isOpen) return null;

    const handleApplyEmailMove = (item, idx) => {
        if (!item.matchedJobId) return;
        const currentJob = jobs.find(j => j.id === item.matchedJobId);
        const dateStr = new Date().toLocaleDateString();
        const note = `[Morning Radar Update - ${dateStr}]: ${item.summary} ("${item.keyQuote}")`;
        const updatedNotes = currentJob?.notes ? `${currentJob.notes}\n\n${note}` : note;

        moveJob(item.matchedJobId, item.suggestedStatus);
        updateJob(item.matchedJobId, { notes: updatedNotes, updatedAt: new Date().toISOString() });
        setAppliedEmailUpdates(prev => new Set(prev).add(idx));

        // Immediately remove matched job from ghost/follow-up lists so the alert clears
        setBriefing(prev => ({
            ...prev,
            ghostAlerts: prev.ghostAlerts.filter(g => g.id !== item.matchedJobId),
            followUpAlerts: prev.followUpAlerts.filter(f => f.id !== item.matchedJobId)
        }));
    };

    const handleBackdropMouseDown = (e) => {
        mouseDownTargetRef.current = e.target;
    };

    const handleBackdropClick = (e) => {
        if (mouseDownTargetRef.current === e.currentTarget && e.target === e.currentTarget) {
            onClose();
        }
        mouseDownTargetRef.current = null;
    };

    const modalContent = (
        <div
            onMouseDown={handleBackdropMouseDown}
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.82)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                zIndex: 10001,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px'
            }}
        >
            <div className="card animate-scale-up" style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '88vh',
                overflowY: 'auto',
                padding: 'clamp(18px, 4vw, 28px)',
                position: 'relative',
                border: '1px solid var(--accent-primary)',
                boxShadow: '0 25px 60px -15px rgba(107, 126, 103, 0.3)',
                background: 'var(--bg-app)'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <X size={22} />
                </button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(212, 163, 115, 0.22), rgba(94, 135, 110, 0.2))',
                        border: '1px solid rgba(212, 163, 115, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Sunrise size={26} color="var(--warning)" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.45rem', fontWeight: 'bold' }}>
                            Morning Career Radar
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {autoLaunched ? 'Daily first-login synchronization' : 'On-demand pipeline & email synchronization'}
                        </p>
                    </div>
                </div>

                {/* Progress Bar Container */}
                <div style={{
                    margin: '18px 0 24px 0',
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--accent-primary)' }}>{statusText}</span>
                        <span style={{ fontWeight: 'bold' }}>{progress}%</span>
                    </div>

                    {/* Progress Bar Track */}
                    <div style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '6px',
                        background: 'rgba(107, 126, 103, 0.14)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            borderRadius: '6px',
                            background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 50%, var(--warning) 100%)',
                            transition: 'width 0.4s ease-out'
                        }} />
                    </div>
                </div>

                {/* Results Screen */}
                {syncComplete && (
                    <div className="animate-fade-in" style={{ display: 'grid', gap: '16px' }}>
                        {/* Summary Badges */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 'bold' }}>GHOST ALERTS</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ef4444' }}>{briefing.ghostAlerts.length}</div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 'bold' }}>FOLLOW-UPS</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>{briefing.followUpAlerts.length}</div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(107, 126, 103, 0.12)', border: '1px solid rgba(107, 126, 103, 0.3)' }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>EMAIL UPDATES</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{briefing.emailUpdates.length}</div>
                            </div>
                            <div style={{ padding: '12px', borderRadius: '10px', background: goalProgress.percentage >= 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)', border: goalProgress.percentage >= 100 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)' }}>
                                <div style={{ fontSize: '0.72rem', color: goalProgress.percentage >= 100 ? '#10b981' : '#a855f7', fontWeight: 'bold' }}>GOAL ({goalProgress.cadence.toUpperCase()})</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: goalProgress.percentage >= 100 ? '#10b981' : '#a855f7' }}>
                                    {goalProgress.count}/{goalProgress.target}
                                </div>
                            </div>
                        </div>

                        {/* Goal Pace Banner */}
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: goalProgress.percentage >= 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 126, 103, 0.1)',
                            border: goalProgress.percentage >= 100 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(107, 126, 103, 0.28)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.82rem',
                            flexWrap: 'wrap',
                            gap: '6px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Target size={15} color={goalProgress.percentage >= 100 ? '#10b981' : 'var(--accent-primary)'} />
                                <span style={{ fontWeight: 'bold' }}>Goal Pacing:</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{goalProgress.paceMessage}</span>
                            </div>
                            <span style={{ fontWeight: 'bold', color: goalProgress.percentage >= 100 ? '#10b981' : 'var(--accent-primary)' }}>
                                {goalProgress.percentage}% complete
                            </span>
                        </div>

                        {/* Email Updates (if any) */}
                        {briefing.emailUpdates.length > 0 && (
                            <div style={{
                                padding: '14px',
                                borderRadius: '12px',
                                background: 'rgba(107, 126, 103, 0.1)',
                                border: '1px solid rgba(107, 126, 103, 0.28)'
                            }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--accent-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Mail size={16} /> Recruiter Updates Detected from Inbox:
                                </div>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    {briefing.emailUpdates.map((item, idx) => (
                                        <div key={idx} style={{
                                            padding: '10px',
                                            borderRadius: '8px',
                                            background: 'var(--bg-app)',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}>
                                            <div>
                                                <strong>{item.company}</strong>: {item.summary}
                                                <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', marginTop: '2px' }}>
                                                    Suggested: Move to <strong>{item.suggestedStatus}</strong>
                                                </div>
                                            </div>
                                            {appliedEmailUpdates.has(idx) ? (
                                                <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem' }}>✓ Moved</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleApplyEmailMove(item, idx)}
                                                    className="btn-primary"
                                                    style={{ fontSize: '0.75rem', padding: '5px 10px', flexShrink: 0 }}
                                                >
                                                    Apply Move
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Top Follow-Up Recommendations */}
                        {(briefing.ghostAlerts.length > 0 || briefing.followUpAlerts.length > 0) && (
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={16} color="var(--accent-primary)" /> Top Applications Requiring Follow-Up Today:
                                </div>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    {[...briefing.ghostAlerts, ...briefing.followUpAlerts].slice(0, 3).map(job => (
                                        <div key={job.id} style={{
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            background: 'var(--bg-panel)',
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            <div>
                                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{job.company}</span>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '6px' }}>({job.role || job.title})</span>
                                                <div style={{ fontSize: '0.75rem', color: job.days >= 10 ? '#ef4444' : '#f59e0b', marginTop: '2px' }}>
                                                    {job.days} days elapsed without response
                                                </div>
                                            </div>

                                            {onOpenCoach && (
                                                <button
                                                    onClick={() => {
                                                        onClose();
                                                        onOpenCoach(job);
                                                    }}
                                                    className="btn-secondary"
                                                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <Send size={12} /> Launch Follow-Up
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Close / Proceed */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button
                                onClick={onClose}
                                className="btn-primary"
                                style={{ padding: '10px 24px', fontSize: '0.95rem' }}
                            >
                                Let&apos;s Get to Work <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (typeof document === 'undefined') return modalContent;
    return createPortal(modalContent, document.body);
}
