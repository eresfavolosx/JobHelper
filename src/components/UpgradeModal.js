"use client";
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, CheckCircle2, CreditCard, Key } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getStripeCheckoutUrl, PRO_MONTHLY_PRICE } from '@/lib/subscription';

export default function UpgradeModal({ isOpen, onClose, triggerReason = 'feature' }) {
    const { user } = useAuth();

    if (!isOpen) return null;

    const checkoutUrl = getStripeCheckoutUrl(user);

    const modalContent = (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Upgrade to NovuJobs Pro"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 10010,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px'
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="card animate-scale-up"
                style={{
                    width: '100%',
                    maxWidth: '560px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: 'clamp(20px, 5vw, 32px)',
                    position: 'relative',
                    border: '1px solid var(--accent-primary)',
                    boxShadow: '0 25px 50px -12px rgba(107, 126, 103, 0.28)',
                    background: 'var(--bg-app)'
                }}
            >
                <button
                    type="button"
                    aria-label="Close upgrade modal"
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

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(118, 133, 142, 0.22), rgba(250, 248, 244, 0.08))',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        <Sparkles size={28} color="var(--accent-secondary)" />
                    </div>
                    <h3 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.6rem)', fontWeight: 'bold' }}>
                        Supercharge Your Career with <span style={{ color: 'var(--accent-primary)' }}>NovuJobs Pro</span>
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '6px' }}>
                        {triggerReason === 'limit' 
                            ? 'You have reached the 25-job free tracking limit. Upgrade for unlimited tracking and executive AI tools.'
                            : 'Access unlimited Gemini 3.8 Flash AI parsing, Ghosting Buster follow-ups, and interview preparation.'}
                    </p>
                </div>

                <div style={{
                    padding: '20px',
                    borderRadius: '16px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '24px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                            <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{PRO_MONTHLY_PRICE}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}> / month</span>
                        </div>
                        <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            background: 'rgba(107, 126, 103, 0.16)',
                            color: 'var(--accent-primary)',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                        }}>
                            PRO MEMBER
                        </span>
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px', fontSize: '0.9rem' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={16} color="#10b981" /> Unlimited tracked applications & cloud sync
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={16} color="#10b981" /> <strong>Ghosting Radar & 1-Click Stealth Follow-ups</strong>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={16} color="#10b981" /> <strong>Interview Power Coach with STAR frameworks</strong>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={16} color="#10b981" /> AI Resume Parser & Match Scorer (Gemini 3.8 Flash)
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={16} color="#10b981" /> Google Maps Commute & Location Intelligence
                        </li>
                    </ul>
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                    <a
                        href={checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            padding: '14px',
                            fontSize: '1rem',
                            textDecoration: 'none',
                            fontWeight: 'bold'
                        }}
                    >
                        <CreditCard size={18} /> Upgrade with Stripe ($9.99/mo)
                    </a>

                    <div style={{ textAlign: 'center', margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        — or bring your own free key —
                    </div>

                    <a
                        href="/profile#api-keys-section"
                        onClick={onClose}
                        className="btn-secondary"
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            padding: '12px',
                            fontSize: '0.9rem',
                            textDecoration: 'none'
                        }}
                    >
                        <Key size={16} /> Enter Free Personal Gemini Key in Profile
                    </a>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '16px' }}>
                    🔒 Payments secured via Stripe. Cancel anytime in one click.
                </p>
            </div>
        </div>
    );

    if (typeof document !== 'undefined' && document.body) {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
}
