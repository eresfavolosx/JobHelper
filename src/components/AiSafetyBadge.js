"use client";
import React, { useState } from 'react';
import { Shield, Sparkles, X } from 'lucide-react';
import AnthropicFellowsModal from './AnthropicFellowsModal';
import { useAuth } from '@/lib/auth-context';
import { isOwner } from '@/lib/subscription';

export default function AiSafetyBadge({ variant = 'navbar' }) {
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDismissed, setIsDismissed] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                return localStorage.getItem('novujobs_dismissed_anthropic_card') === 'true';
            } catch {}
        }
        return false;
    });

    const handleDismiss = (e) => {
        e?.stopPropagation?.();
        setIsDismissed(true);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('novujobs_dismissed_anthropic_card', 'true');
            } catch {}
        }
    };

    // Strictly restrict Anthropic Fellows & AI Safety Prep card/badge to the owner email only
    if (!isOwner(user)) return null;

    if (variant === 'dashboard-card') {
        if (isDismissed) return null;

        return (
            <>
                <div 
                    role="region"
                    aria-label="Anthropic Fellows AI Safety Opportunity"
                    style={{
                        background: 'linear-gradient(135deg, rgba(107, 126, 103, 0.12) 0%, var(--glass-panel, rgba(28, 29, 31, 0.5)) 100%)',
                        border: '1px solid rgba(107, 126, 103, 0.28)',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        borderRadius: '10px',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                        boxSizing: 'border-box'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 260px', minWidth: 0 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            flexShrink: 0,
                            borderRadius: '7px',
                            background: 'var(--accent-gradient, #5e876e)',
                            color: '#FAF8F4',
                            boxShadow: '0 2px 6px rgba(74, 124, 85, 0.25)'
                        }}>
                            <Shield size={15} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    Anthropic Fellows Prep &amp; AI Safety
                                </span>
                                <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: '700',
                                    padding: '2px 7px',
                                    borderRadius: '9999px',
                                    backgroundColor: 'rgba(212, 163, 115, 0.15)',
                                    border: '1px solid rgba(212, 163, 115, 0.35)',
                                    color: 'var(--warning)',
                                    whiteSpace: 'nowrap'
                                }}>
                                    Due Oct 18
                                </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                AI Safety &amp; Security Fellowship ($3,850/wk + $15k/mo compute) · Readiness &amp; research proposals
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="btn-secondary"
                            style={{
                                fontSize: '0.75rem',
                                padding: '5px 11px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontWeight: 700,
                                background: 'rgba(107, 126, 103, 0.18)',
                                border: '1px solid var(--accent-primary)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                borderRadius: '7px'
                            }}
                        >
                            <span>Open Hub</span>
                            <Sparkles size={13} color="var(--accent-primary)" />
                        </button>
                        <button
                            type="button"
                            onClick={handleDismiss}
                            title="Dismiss Anthropic card from dashboard (available in Notifications)"
                            aria-label="Dismiss Anthropic card from dashboard"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>

                <AnthropicFellowsModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            </>
        );
    }

    if (variant === 'compact') {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    title="Constitutional AI Safety Active • Anthropic Fellows Prep Hub"
                    aria-label="AI Safety & Anthropic Fellows Hub"
                    style={{
                        width: '44px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '9px',
                        backgroundColor: 'rgba(107, 126, 103, 0.14)',
                        border: '1px solid rgba(107, 126, 103, 0.32)',
                        color: 'var(--accent-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        boxSizing: 'border-box'
                    }}
                >
                    <span style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-primary)',
                        boxShadow: '0 0 0 2px rgba(107, 126, 103, 0.3)'
                    }} />
                    <Shield size={17} />
                </button>

                <AnthropicFellowsModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            </>
        );
    }

    // Default 'navbar' pill
    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                title="Constitutional AI Safety Active • Anthropic Fellows Prep Hub"
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    padding: '6px 10px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(107, 126, 103, 0.14)',
                    border: '1px solid rgba(107, 126, 103, 0.32)',
                    color: 'var(--accent-primary)',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box'
                }}
            >
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary)',
                    boxShadow: '0 0 0 2px rgba(107, 126, 103, 0.3)'
                }} />
                <Shield size={14} />
                <span>AI Safety & Anthropic</span>
            </button>

            <AnthropicFellowsModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}
