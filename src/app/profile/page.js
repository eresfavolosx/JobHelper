"use client";
import { useState, useEffect, Suspense } from 'react';
import { User } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';

function ProfileContent() {
    const { profile, updateProfile } = useAppStore();
    const { user, loading } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !loading && !user) {
            window.location.href = '/login';
        }
    }, [mounted, loading, user]);

    // Local state to handle form inputs before saving to global store
    const [formData, setFormData] = useState({
        fullName: '',
        targetRole: '',
        location: 'Puerto Rico',
        keywords: '',
        isRemote: false,
        experienceLevel: 'Mid-Senior'
    });

    const [saved, setSaved] = useState(false);

    // Load from global store on mount
    useEffect(() => {
        if (profile) {
            setFormData(prev => ({ ...prev, ...profile }));
        }
    }, [profile]);

    if (loading) return null; // Wait for auth check

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        updateProfile(formData);

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="container" style={{ maxWidth: '800px', paddingBottom: '100px' }}>
            <header className="animate-slide-up" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <User size={32} color="var(--accent-primary)" /> Your Profile
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Manage your personal details and preferences.
                    </p>
                </div>
            </header>

            <div style={{ display: 'grid', gap: '32px' }}>
                {/* 0. Cloud Sync - ONLY SHOW IF NOT MIGRATED OR FOR MANUAL SYNC */}
                <div className="card animate-slide-up delay-100" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>Sync Local Data</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                                Push your locally saved jobs to the cloud so you can see them on other devices.
                            </p>
                        </div>
                        <SyncButton />
                    </div>
                </div>

                {/* 1. Profile Form */}
                <div className="card animate-slide-up delay-200">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Core Preferences</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontWeight: '600' }}>Full Name</label>
                            <input
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="e.g. Jane Doe"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Job Title</label>
                                <input
                                    name="targetRole"
                                    value={formData.targetRole}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Keywords</label>
                                <input
                                    name="keywords"
                                    value={formData.keywords}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Target Location</label>
                                <input
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600' }}>Experience Level</label>
                                <select
                                    name="experienceLevel"
                                    value={formData.experienceLevel}
                                    onChange={handleChange}
                                >
                                    <option style={{ background: 'var(--bg-panel)' }}>Intern / Junior</option>
                                    <option style={{ background: 'var(--bg-panel)' }}>Mid-Level</option>
                                    <option style={{ background: 'var(--bg-panel)' }}>Senior</option>
                                    <option style={{ background: 'var(--bg-panel)' }}>Lead / Manager</option>
                                    <option style={{ background: 'var(--bg-panel)' }}>Executive</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    name="isRemote"
                                    checked={formData.isRemote}
                                    onChange={handleChange}
                                    style={{ width: '20px', height: '20px' }}
                                />
                                <span>I am interested in Remote / Hybrid roles</span>
                            </label>
                        </div>

                        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                            {saved ? 'Changes Saved!' : 'Save Preferences'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function SyncButton() {
    const { user } = useAuth();
    const { jobs, profile } = useAppStore();
    const [syncing, setSyncing] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, success, error

    const handleSync = async () => {
        if (!user) return;
        setSyncing(true);
        setStatus('idle');
        try {
            // Dynamically import to avoid server-side issues if any
            const { syncLocalDataToFirestore } = await import('@/lib/firestore-sync');
            await syncLocalDataToFirestore(user.uid, jobs, profile);
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err) {
            console.error(err);
            setStatus('error');
        } finally {
            setSyncing(false);
        }
    };

    if (!user) return null;

    return (
        <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-primary"
            style={{
                minWidth: '120px',
                background: status === 'error' ? 'var(--error)' : status === 'success' ? 'var(--success)' : undefined
            }}
        >
            {syncing ? 'Syncing...' : status === 'success' ? 'Done!' : status === 'error' ? 'Error' : 'Sync Now'}
        </button>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="container">Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
