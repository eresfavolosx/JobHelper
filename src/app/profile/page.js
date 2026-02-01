"use client";
import { useState, useEffect, Suspense } from 'react';
import { User, MapPin, Search, Save, Upload, Loader2, Linkedin } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useSearchParams, useRouter } from 'next/navigation';

function ProfileContent() {
    const { profile, updateProfile, addContextDocument } = useAppStore();
    const searchParams = useSearchParams();
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
    const [isImporting, setIsImporting] = useState(false);

    // Load from global store on mount
    useEffect(() => {
        if (profile) {
            setFormData(prev => ({ ...prev, ...profile }));
        }
    }, [profile]);

    // Handle URL Import (from Extension)
    useEffect(() => {
        const importData = searchParams.get('import');
        if (importData) {
            try {
                const parsed = JSON.parse(decodeURIComponent(importData));
                setFormData(prev => ({
                    ...prev,
                    fullName: parsed.fullName || prev.fullName,
                    targetRole: parsed.targetRole || prev.targetRole,
                    location: parsed.location || prev.location,
                    keywords: parsed.keywords || prev.keywords,
                    experienceLevel: parsed.experienceLevel || prev.experienceLevel
                }));
                // Clean URL
                router.replace('/profile');
                alert("Profile Info Synced from LinkedIn via Extension!");
            } catch (e) {
                console.error("Failed to import profile param", e);
            }
        }
    }, [searchParams, router]);

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

    const handleLinkedInImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        const data = new FormData();
        data.append("resume", file);

        try {
            const res = await fetch('/api/profile/parse', { method: 'POST', body: data });
            const parsed = await res.json();

            if (parsed.error) throw new Error(parsed.error);

            // Merge parsed data with current form
            setFormData(prev => ({
                ...prev,
                fullName: parsed.fullName || prev.fullName,
                targetRole: parsed.targetRole || prev.targetRole,
                location: parsed.location || prev.location,
                keywords: parsed.keywords || prev.keywords,
                experienceLevel: parsed.experienceLevel || prev.experienceLevel
            }));

            alert("Profile imported from LinkedIn!");
        } catch (err) {
            console.error(err);
            alert("Failed to parse LinkedIn PDF");
        } finally {
            setIsImporting(false);
        }
    };

    const handleContextUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        setIsImporting(true);
        const data = new FormData();
        files.forEach(file => data.append("files", file));

        try {
            const res = await fetch('/api/profile/context', { method: 'POST', body: data });
            const result = await res.json();

            if (result.documents) {
                // Add parsed docs to store
                result.documents.forEach(doc => {
                    // Ensure no duplicates
                    if (!profile.contextDocuments?.some(d => d.name === doc.name)) {
                        useAppStore.getState().addContextDocument(doc);
                    }
                });
            }
            alert("Documents added to context!");
        } catch (err) {
            console.error(err);
            alert("Failed to upload context files");
        } finally {
            setIsImporting(false);
        }
    };

    const removeDocument = (index) => {
        useAppStore.getState().removeContextDocument(index);
    };

    return (
        <div className="container" style={{ maxWidth: '800px', paddingBottom: '100px' }}>
            {/* Same JSX as before... just now inside ProfileContent */}
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <User size={32} /> Your Profile & Context
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Add resumes, portfolios, or project lists. The AI will use this <strong>Context</strong> to write better cover letters.
                    </p>
                </div>

                <div style={{ position: 'relative' }}>
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handleLinkedInImport}
                        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                    <button className="btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Linkedin size={18} />}
                        {isImporting ? 'Parsing...' : 'Import LinkedIn PDF'}
                    </button>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '4px' }}>Save Profile as PDF & Upload</p>
                </div>
            </header>

            <div style={{ display: 'grid', gap: '32px' }}>
                {/* 1. Profile Form */}
                <div className="card">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Core Preferences</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* ... Existing Fields ... */}
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

                {/* 2. Context Documents */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Knowledge Base</h3>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="file"
                                multiple
                                onChange={handleContextUpload}
                                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                            />
                            <button className="btn-secondary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Upload size={16} /> Add Files
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {profile?.contextDocuments?.length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', border: '2px dashed var(--border-subtle)', borderRadius: '8px' }}>
                                No documents yet. Upload resumes, project lists, or cover letters.
                            </div>
                        )}
                        {profile?.contextDocuments?.map((doc, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-app)', borderRadius: '8px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', background: 'var(--accent-secondary)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                        DOC
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>{doc.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{doc.summary || 'Context Document'}</div>
                                    </div>
                                </div>
                                <button onClick={() => removeDocument(idx)} style={{ color: 'var(--text-secondary)', padding: '8px' }}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="container"><Loader2 className="animate-spin" /> Loading...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
