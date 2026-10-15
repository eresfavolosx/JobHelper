"use client";
import React, { useState } from 'react';
import { Shield, Sparkles } from 'lucide-react';
import AnthropicFellowsModal from './AnthropicFellowsModal';

export default function AiSafetyBadge({ variant = 'navbar' }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    if (variant === 'dashboard-card') {
        return (
            <>
                <div 
                    onClick={() => setIsModalOpen(true)}
                    className="card interactive-card"
                    style={{
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(46, 125, 50, 0.08) 0%, rgba(244, 241, 234, 0.6) 100%)',
                        border: '1px solid rgba(46, 125, 50, 0.25)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        borderRadius: '14px',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                >
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    backgroundColor: '#2e7d32',
                                    color: '#ffffff'
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
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                backgroundColor: '#fef3c7',
                                color: '#92400e'
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
                        color: '#2e7d32'
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

    // Default 'navbar' pill
    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                title="Constitutional AI Safety Active • Anthropic Fellows Prep Hub"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '6px 13px',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    border: '1px solid rgba(46, 125, 50, 0.28)',
                    color: '#2e7d32',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                }}
            >
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#2e7d32',
                    boxShadow: '0 0 0 2px rgba(46, 125, 50, 0.3)'
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
