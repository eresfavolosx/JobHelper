"use client";
import Link from 'next/link';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
            textAlign: 'center',
            padding: '40px 20px'
        }}>
            <div style={{
                fontSize: '8rem',
                fontWeight: '900',
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1,
                marginBottom: '16px'
            }}>
                404
            </div>

            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '12px' }}>
                Page Not Found
            </h1>

            <p style={{
                color: 'var(--text-secondary)',
                marginBottom: '32px',
                maxWidth: '400px',
                lineHeight: '1.6'
            }}>
                Looks like this page went on a job interview and never came back.
                Let's get you back on track!
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link
                    href="/"
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Home size={18} /> Go Home
                </Link>
                <Link
                    href="/kanban"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    <Search size={18} /> View Jobs
                </Link>
            </div>
        </div>
    );
}
