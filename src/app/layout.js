"use client";
import './globals.css';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import AddJobModal from '@/components/AddJobModal';
import Link from 'next/link';

export default function RootLayout({ children }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <html lang="en">
            <body style={{ display: 'flex', minHeight: '100vh' }}>
                <nav style={{
                    width: '250px',
                    backgroundColor: 'var(--bg-panel)',
                    borderRight: '1px solid var(--border-subtle)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        Job<span style={{ color: 'var(--accent-primary)' }}>Tracker</span>
                    </h1>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                        <Plus size={18} /> New Job
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Link href="/" style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Dashboard</Link>
                        <Link href="/kanban" style={{ padding: '10px', borderRadius: '6px', color: 'var(--text-secondary)' }}>Board</Link>
                        <Link href="/tailor" style={{ padding: '10px', borderRadius: '6px', color: 'var(--text-secondary)' }}>AI Tailor</Link>
                    </div>
                </nav>

                <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
                    {children}
                </main>

                <AddJobModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            </body>
        </html>
    );
}
