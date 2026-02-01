"use client";
import { useAppStore } from '@/lib/store';
import { Briefcase, Calendar, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Home() {
    const { jobs } = useAppStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Reset daily reminder timer when user visits dashboard
        localStorage.setItem('lastJobCheckDate', new Date().toISOString());
    }, []);

    if (!mounted) return null; // Prevent hydration mismatch

    const stats = {
        total: jobs.length,
        interviewing: jobs.filter(j => j.status === 'interviewing').length,
        offers: jobs.filter(j => j.status === 'offer').length
    };

    return (
        <div className="container">
            <header style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Dashboard</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Welcome back. Here is your application progress.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Briefcase size={20} color="var(--accent-primary)" />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Applications</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.total}</p>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Calendar size={20} color="var(--warning)" />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Interviews</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.interviewing}</p>
                </div>

                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <CheckCircle size={20} color="var(--success)" />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Offers</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.offers}</p>
                </div>
            </div>
        </div>
    );
}
