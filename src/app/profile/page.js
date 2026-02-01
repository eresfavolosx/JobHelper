"use client";
import { useState, useEffect, Suspense } from 'react';
import { User } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useSearchParams, useRouter } from 'next/navigation';

function ProfileContent() {
    const { profile, updateProfile } = useAppStore();
    const router = useRouter();

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
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <User size={32} /> Your Profile
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Manage your personal details and preferences.
                    </p>
                </div>
            </header>

            <div style={{ display: 'grid', gap: '32px' }}>
                {/* 1. Profile Form */}
                <div className="card">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Core Preferences</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontWeight: 'bold' }}>Full Name</label>
                            <input
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="e.g. Jane Doe"
                                style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Job Title</label>
                                <input
                                    name="targetRole"
                                    value={formData.targetRole}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Keywords</label>
                                <input
                                    name="keywords"
                                    value={formData.keywords}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Target Location</label>
                                <input
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Experience Level</label>
                                <select
                                    name="experienceLevel"
                                    value={formData.experienceLevel}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                                >
                                    <option>Intern / Junior</option>
                                    <option>Mid-Level</option>
                                    <option>Senior</option>
                                    <option>Lead / Manager</option>
                                    <option>Executive</option>
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
                                    style={{ transform: 'scale(1.2)' }}
                                />
                                <span>I am interested in Remote / Hybrid roles</span>
                            </label>
                        </div>

                        <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                            {saved ? 'Saved!' : 'Save Preferences'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="container">Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
