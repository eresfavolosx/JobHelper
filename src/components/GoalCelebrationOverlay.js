"use client";
import React, { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Sparkles, Check, Share2, X, PartyPopper, RefreshCw, Flame, Target } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { calculateGoalProgress, DEFAULT_GOAL, shouldTriggerGoalCelebration } from '@/lib/goal-tracker';

const CELEBRATION_STORAGE_KEY = 'novujobs_last_celebrated_goal_cycle';
const DAILY_CELEBRATION_STORAGE_KEY = 'novujobs_last_celebrated_daily_milestone';

const CONFETTI_COLORS = [
    '#5F8263', // Sage Emerald
    '#4A7C55', // Deep Sage
    '#D4A373', // Champagne Gold
    '#F59E0B', // Amber Gold
    '#EAB308', // Radiant Sun
    '#38BDF8', // Sky Blue
    '#818CF8', // Indigo Spark
    '#F472B6', // Rose Pink
    '#FAF8F4', // Crisp Warm White
    '#C85A3E'  // Terracotta
];

class ConfettiParticle {
    constructor(x, y, vx, vy, color, size, shape = 'rect') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.shape = shape; // 'rect', 'circle', 'strip'
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 12;
        this.wobble = Math.random() * 10;
        this.wobbleSpeed = 0.05 + Math.random() * 0.08;
        this.gravity = 0.18 + Math.random() * 0.12;
        this.drag = 0.982;
        this.opacity = 1;
        this.fadeRate = 0.003 + Math.random() * 0.004;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.drag;
        this.vy = this.vy * this.drag + this.gravity;
        this.rotation += this.rotationSpeed;
        this.wobble += this.wobbleSpeed;
        this.opacity -= this.fadeRate;
        return this.opacity > 0 && this.y < (typeof window !== 'undefined' ? window.innerHeight + 80 : 1200);
    }

    draw(ctx) {
        if (this.opacity <= 0) return;
        ctx.save();
        ctx.translate(this.x + Math.sin(this.wobble) * 4, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
        ctx.fillStyle = this.color;

        if (this.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.shape === 'strip') {
            ctx.fillRect(-this.size * 0.4, -this.size * 1.4, this.size * 0.8, this.size * 2.8);
        } else {
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.65);
        }
        ctx.restore();
    }
}

export default function GoalCelebrationOverlay() {
    const jobs = useAppStore(state => state.jobs);
    const profile = useAppStore(state => state.profile);
    const isGoalCelebrationOpen = useUIStore(state => state.isGoalCelebrationOpen);
    const goalCelebrationBurstId = useUIStore(state => state.goalCelebrationBurstId);
    const triggerGoalCelebration = useUIStore(state => state.triggerGoalCelebration);
    const closeGoalCelebration = useUIStore(state => state.closeGoalCelebration);

    const goal = profile?.applicationGoal || DEFAULT_GOAL;
    const progress = calculateGoalProgress(jobs, goal);

    // Track previous counts to detect real-time achievement of goals or 5-application daily milestones
    const prevProgressRef = useRef({ count: null, cycleKey: null, todayCount: null });
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let celebratedCycleKey = null;
        let celebratedDailyKey = null;
        try {
            celebratedCycleKey = localStorage.getItem(CELEBRATION_STORAGE_KEY);
            celebratedDailyKey = localStorage.getItem(DAILY_CELEBRATION_STORAGE_KEY);
        } catch {
            // Storage access blocked or restricted
        }

        const prevCount = prevProgressRef.current.count;
        const prevCycleKey = prevProgressRef.current.cycleKey;
        const prevTodayCount = prevProgressRef.current.todayCount;

        // When jobs haven't loaded yet on first tick, don't lock out celebration until real data arrives
        const isCadenceAchieved = progress.enabled !== false && progress.count >= progress.target && progress.target > 0;
        const isDailyMilestoneAchieved = progress.enabled !== false && progress.todayCount >= 5;

        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            prevProgressRef.current = { count: progress.count, cycleKey: progress.cycleKey, todayCount: progress.todayCount };

            // On initial load: trigger celebration if user achieved the goal or 5 daily applications
            // and hasn't celebrated this cycle/day yet
            const uncelebratedCadence = isCadenceAchieved && celebratedCycleKey !== progress.cycleKey;
            const uncelebratedDaily = isDailyMilestoneAchieved && celebratedDailyKey !== progress.dailyMilestoneKey;

            if (uncelebratedCadence || uncelebratedDaily) {
                try {
                    if (isCadenceAchieved) localStorage.setItem(CELEBRATION_STORAGE_KEY, progress.cycleKey);
                    if (isDailyMilestoneAchieved) localStorage.setItem(DAILY_CELEBRATION_STORAGE_KEY, progress.dailyMilestoneKey);
                } catch {}
                triggerGoalCelebration();
            }
            return;
        }

        // Real-time updates (e.g. adding a job or moving status to applied):
        const shouldTrigger = shouldTriggerGoalCelebration({
            prevCount,
            prevCycleKey,
            prevTodayCount,
            currentProgress: progress,
            celebratedCycleKey,
            celebratedDailyMilestoneKey: celebratedDailyKey
        });

        if (shouldTrigger && !isGoalCelebrationOpen) {
            try {
                if (isCadenceAchieved) localStorage.setItem(CELEBRATION_STORAGE_KEY, progress.cycleKey);
                if (isDailyMilestoneAchieved) localStorage.setItem(DAILY_CELEBRATION_STORAGE_KEY, progress.dailyMilestoneKey);
            } catch {}
            triggerGoalCelebration();
        }

        prevProgressRef.current = { count: progress.count, cycleKey: progress.cycleKey, todayCount: progress.todayCount };
    }, [progress, triggerGoalCelebration, isGoalCelebrationOpen]);

    if (!isGoalCelebrationOpen || typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <CelebrationDialogAndCanvas
            progress={progress}
            goal={goal}
            burstId={goalCelebrationBurstId}
            onClose={closeGoalCelebration}
            onReplay={triggerGoalCelebration}
        />,
        document.body
    );
}

const subscribeReducedMotion = (callback) => {
    if (typeof window === 'undefined') return () => {};
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', callback);
    return () => mq.removeEventListener?.('change', callback);
};
const getReducedMotionSnapshot = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
const getReducedMotionServerSnapshot = () => false;

function CelebrationDialogAndCanvas({ progress, goal, burstId, onClose, onReplay }) {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const particlesRef = useRef([]);
    const [copiedShare, setCopiedShare] = useState(false);
    const prefersReducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot
    );
    const [motionPaused, setMotionPaused] = useState(false);

    // Create a rich multi-directional cannon burst of particles across the whole screen
    const spawnCannonBurst = useCallback(() => {
        if (typeof window === 'undefined') return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const newParticles = [];
        const shapes = ['rect', 'circle', 'strip'];

        // Left cannon: fires up and towards the right
        const leftCount = 85;
        for (let i = 0; i < leftCount; i++) {
            const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.6; // ~45 deg upward
            const speed = 14 + Math.random() * 20;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const size = 10 + Math.random() * 9;
            newParticles.push(new ConfettiParticle(10, height - 20, vx, vy, color, size, shape));
        }

        // Right cannon: fires up and towards the left
        const rightCount = 85;
        for (let i = 0; i < rightCount; i++) {
            const angle = (-3 * Math.PI) / 4 + (Math.random() - 0.5) * 0.6; // ~135 deg upward
            const speed = 14 + Math.random() * 20;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const size = 10 + Math.random() * 9;
            newParticles.push(new ConfettiParticle(width - 10, height - 20, vx, vy, color, size, shape));
        }

        // Center sky fountain: drops fluttering confetti from the top ceiling
        const skyCount = 110;
        for (let i = 0; i < skyCount; i++) {
            const x = Math.random() * width;
            const vx = (Math.random() - 0.5) * 6;
            const vy = 1 + Math.random() * 6;
            const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const size = 9 + Math.random() * 8;
            newParticles.push(new ConfettiParticle(x, -25, vx, vy, color, size, shape));
        }

        particlesRef.current = [...particlesRef.current, ...newParticles];
    }, []);

    // Canvas animation loop
    useEffect(() => {
        if (prefersReducedMotion || motionPaused) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeCanvas = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.scale(dpr, dpr);
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Fire initial burst
        spawnCannonBurst();

        // Secondary celebratory wave 1.1s in
        const secondaryWaveTimer = setTimeout(() => {
            spawnCannonBurst();
        }, 1100);

        let running = true;
        const renderLoop = () => {
            if (!running) return;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.restore();

                const remaining = [];
                for (let i = 0; i < particlesRef.current.length; i++) {
                    const p = particlesRef.current[i];
                    if (p.update()) {
                        p.draw(ctx);
                        remaining.push(p);
                    }
                }
                particlesRef.current = remaining;
            }

            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };

        animationFrameRef.current = requestAnimationFrame(renderLoop);

        return () => {
            running = false;
            clearTimeout(secondaryWaveTimer);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [burstId, prefersReducedMotion, motionPaused, spawnCannonBurst]);

    // Handle Keyboard Escape key to dismiss
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Copy celebratory achievement to clipboard
    const handleShare = async () => {
        const textToShare = progress.todayCount >= 5
            ? `🎉 5 Applications Daily Goal Smashed on NovuJobs!\n🎯 Logged ${progress.todayCount} applications today. Consistent daily momentum turns applications into offers! 🚀`
            : `🎉 Application Goal Smashed on NovuJobs!\n🎯 Achieved ${progress.count} of ${progress.target} applications (${progress.cadence}). Keep the momentum going! 🚀`;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(textToShare);
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2400);
            }
        } catch {
            // Clipboard fallback
        }
    };

    const cycleLabelMap = {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        total: 'Milestone Total'
    };
    const cadenceDisplay = cycleLabelMap[progress.cadence] || 'Application';
    const isDailyGoalHighlight = progress.todayCount >= 5;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                height: '100dvh',
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: 'rgba(12, 16, 20, 0.78)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxSizing: 'border-box'
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Full-screen Confetti Canvas in front of backdrop and around dialog */}
            {!prefersReducedMotion && (
                <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        width: '100vw',
                        height: '100vh',
                        pointerEvents: 'none',
                        zIndex: 100003
                    }}
                />
            )}

            {/* Central Celebratory Dialog */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="goal-celebration-title"
                className="animate-scale-in"
                style={{
                    position: 'relative',
                    zIndex: 100002,
                    width: '100%',
                    maxWidth: '560px',
                    maxHeight: 'min(92vh, 92dvh)',
                    overflowY: 'auto',
                    borderRadius: '24px',
                    background: 'linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-app) 100%)',
                    border: '2px solid rgba(212, 163, 115, 0.6)',
                    boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.75), 0 0 32px rgba(212, 163, 115, 0.25)',
                    padding: '32px 28px',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                    color: 'var(--text-primary)'
                }}
            >
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close celebration"
                    title="Close celebration (Esc)"
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'var(--glass-highlight)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <X size={18} />
                </button>

                {/* Golden Trophy Icon Badge with Radiance */}
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '18px' }}>
                    <div style={{
                        position: 'absolute',
                        inset: '-10px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, transparent 70%)',
                        filter: 'blur(6px)'
                    }} />
                    <div style={{
                        width: '84px',
                        height: '84px',
                        borderRadius: '24px',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(95, 130, 99, 0.3))',
                        border: '2px solid rgba(245, 158, 11, 0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)'
                    }}>
                        <Trophy size={44} color="#F59E0B" />
                    </div>
                    <div style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-6px',
                        background: 'var(--success)',
                        color: '#ffffff',
                        borderRadius: '50%',
                        padding: '4px',
                        border: '2px solid var(--bg-panel)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Sparkles size={14} />
                    </div>
                </div>

                {/* Pill Headline */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {isDailyGoalHighlight && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            padding: '3px 12px',
                            borderRadius: '999px',
                            background: 'rgba(212, 163, 115, 0.25)',
                            border: '1px solid rgba(212, 163, 115, 0.6)',
                            color: 'var(--warning)'
                        }}>
                            <PartyPopper size={13} /> 5 Applications Daily Goal
                        </span>
                    )}

                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: 'rgba(95, 130, 99, 0.2)',
                        border: '1px solid var(--success)',
                        color: 'var(--success)'
                    }}>
                        <Check size={13} /> {progress.percentage >= 100 ? `${cadenceDisplay} 100% Achieved` : `${progress.todayCount} Applied Today`}
                    </span>
                </div>

                <h2
                    id="goal-celebration-title"
                    style={{
                        fontSize: '1.85rem',
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        margin: '0 0 10px 0',
                        color: 'var(--text-primary)'
                    }}
                >
                    {isDailyGoalHighlight ? '5 Applications Daily Goal Crushed! 🎉' : 'Goal Crushed! 🎉'}
                </h2>

                <p style={{
                    fontSize: '0.98rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    maxWidth: '460px',
                    margin: '0 auto 20px auto'
                }}>
                    {isDailyGoalHighlight ? (
                        <>
                            You logged <strong style={{ color: 'var(--text-primary)' }}>{progress.todayCount} applications today</strong>!
                            Hitting 5 applications a day is the gold standard for landing quality interviews.
                        </>
                    ) : (
                        <>
                            You logged <strong style={{ color: 'var(--text-primary)' }}>{progress.count}</strong> applications
                            out of your <strong style={{ color: 'var(--text-primary)' }}>{progress.target}</strong> target!
                        </>
                    )}
                    {goal?.targetRole ? ` Focused on ${goal.targetRole}.` : ' Every application brings you closer to your next offer.'}
                </p>

                {/* Highlight Stats Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '10px',
                    padding: '14px',
                    borderRadius: '16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '22px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Applied Today
                        </span>
                        <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--success)' }}>
                            {progress.todayCount} / 5+
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            {cadenceDisplay} Total
                        </span>
                        <span style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {progress.count} / {progress.target}
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            Daily Goal
                        </span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '100%' }}>
                            <Flame size={16} color="var(--warning)" /> {isDailyGoalHighlight ? 'Achieved 🔥' : 'In Progress'}
                        </span>
                    </div>
                </div>

                {/* Motivational Quote / Insight */}
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(95, 130, 99, 0.12)',
                    border: '1px solid rgba(95, 130, 99, 0.3)',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    textAlign: 'left'
                }}>
                    <Target size={20} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                    <span>
                        Consistency is the number one predictor of hiring success.
                        You have built undeniable momentum today—keep this energy rolling!
                    </span>
                </div>

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    flexWrap: 'wrap'
                }}>
                    <button
                        type="button"
                        onClick={onReplay}
                        className="btn-secondary"
                        style={{
                            padding: '11px 18px',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                        title="Replay screen confetti animation"
                    >
                        <RefreshCw size={15} /> Replay Confetti
                    </button>

                    <button
                        type="button"
                        onClick={handleShare}
                        className="btn-secondary"
                        style={{
                            padding: '11px 18px',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                        title="Copy achievement text to clipboard"
                    >
                        {copiedShare ? (
                            <>
                                <Check size={15} color="var(--success)" /> Copied!
                            </>
                        ) : (
                            <>
                                <Share2 size={15} /> Copy Win
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-primary"
                        style={{
                            padding: '11px 24px',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            borderRadius: '12px',
                            boxShadow: 'var(--shadow-btn-hover)'
                        }}
                    >
                        Keep Momentum Going 🚀
                    </button>
                </div>

                {/* Reduced-motion & Pause Controls for Accessibility */}
                <div style={{
                    marginTop: '16px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)'
                }}>
                    {!prefersReducedMotion && (
                        <button
                            type="button"
                            onClick={() => setMotionPaused(prev => !prev)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                padding: '2px 4px'
                            }}
                        >
                            {motionPaused ? 'Resume confetti motion' : 'Pause confetti animation'}
                        </button>
                    )}
                    <span>Press Esc to close</span>
                </div>
            </div>
        </div>
    );
}
