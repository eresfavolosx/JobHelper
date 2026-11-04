"use client";
import React, { useState } from 'react';
import { Shield, Sparkles } from 'lucide-react';
import AnthropicFellowsModal from './AnthropicFellowsModal';
import { useAuth } from '@/lib/auth-context';
import { isOwner } from '@/lib/subscription';

export default function AiSafetyBadge({ variant = 'navbar' }) {
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Strictly restrict Anthropic Fellows & AI Safety Prep card/badge to the owner email only
    if (!isOwner(user)) return null;

    if (variant === 'dashboard-card') {
        return (
            <>
                <div 
                    onClick={() => setIsModalOpen(true)}
                    className="card interactive-card"
                    style={{
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(107, 126, 103, 0.14) 0%, var(--glass-panel) 100%)',
                        border: '1px solid rgba(107, 126, 103, 0.32)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        borderRadius: '14px',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                >
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    flexShrink: 0,
                                    borderRadius: '8px',
                                    background: 'var(--accent-gradient)',
                                    color: '#FAF8F4',
                                    boxShadow: '0 2px 8px rgba(74, 124, 85, 0.3)'
                                }}>
                                    <Shield size={18} />
                                </div>
                                <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    Anthropic Fellows Prep & AI Safety
                                </span>
                            </div>
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                padding: '3px 9px',
                                borderRadius: '9999px',
                                backgroundColor: 'rgba(212, 163, 115, 0.15)',
                                border: '1px solid rgba(212, 163, 115, 0.35)',
                                color: 'var(--warning)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}>
                                Due Oct 18
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            AI Safety & Security Fellowship ($3,850/wk + $15k/mo compute). Analyze qualification gaps, generate research proposals, and practice alignment interviews.
                        </p>
                    </div>

                    <div style={{
                        marginTop: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        color: 'var(--accent-primary)'
                    }}>
                        <span>AI Safety Guardrails: Active</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Open Hub <Sparkles size={14} />
                        </span>
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
