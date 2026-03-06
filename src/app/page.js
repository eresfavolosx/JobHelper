"use client";
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Briefcase, Calendar, CheckCircle } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import Onboarding from '@/components/Onboarding';
import ApplicationHistoryChart from '@/components/ApplicationHistoryChart';

export default function Home() {
    const { jobs } = useAppStore();
    const { user, loading } = useAuth();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Clear any potential legacy auth flags that might conflict
        if (typeof window !== 'undefined') {
            localStorage.removeItem('is_authenticated');
        }
    }, []);

    // Separate effect for auth redirect - only runs once when auth state is settled
    useEffect(() => {
        if (!loading && !user && mounted) {
            // Use window.location for static export compatibility
            window.location.href = '/login';
        }
    }, [loading, user, mounted]);

    if (!mounted || loading) return null; // Prevent hydration mismatch and show nothing while checking auth
    if (!user) return null; // Don't render anything if not authenticated (redirect is happening)

    // ⚡ Bolt: Use a single-pass loop inside useMemo instead of multiple .filter() calls
    // to reduce time complexity from O(kN) to O(N) and avoid recalculation on every render
    const stats = useMemo(() => {
        let interviewing = 0;
        let offers = 0;
        for (let i = 0; i < jobs.length; i++) {
            if (jobs[i].status === 'interviewing') interviewing++;
            else if (jobs[i].status === 'offer') offers++;
        }
        return {
            total: jobs.length,
            interviewing,
            offers
        };
    }, [jobs]);

    if (jobs.length === 0) {
        return <Onboarding />;
    }

    return (
        <div className="container">
            <header style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Dashboard</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Welcome back. Here is your application progress.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div
                    className="card"
                    onClick={() => router.push('/kanban')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Briefcase size={24} color="var(--accent-primary)" />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Applications</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.total}</p>
                </div>

                <div
                    className="card"
                    onClick={() => router.push('/kanban#interviewing')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Calendar size={24} color="var(--warning)" style={{ minWidth: '24px' }} />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Interviews</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.interviewing}</p>
                </div>

                <div
                    className="card"
                    onClick={() => router.push('/kanban#offer')}
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <CheckCircle size={24} color="var(--success)" style={{ minWidth: '24px' }} />
                        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Offers</h3>
                    </div>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.offers}</p>
                </div>
            </div>

            <ApplicationHistoryChart jobs={jobs} />
        </div>
    );
}
