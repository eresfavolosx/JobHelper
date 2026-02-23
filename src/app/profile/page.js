"use client";
import { useState, useEffect, Suspense, useRef } from 'react';
import { User, Upload, CheckCircle, AlertCircle, FileText, Loader } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';
import { getGeminiModel, fileToGenerativePart } from '@/lib/gemini-client';

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

                {/* 1. Resume Upload */}
                <div className="card animate-slide-up delay-150">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Resume & Skills</h3>
                    <ResumeUpload onAnalysisComplete={(analysis) => {
                        updateProfile({
                            resumeAnalysis: analysis,
                            // Auto-fill form if empty
                            keywords: formData.keywords || analysis.keywords.join(', '),
                            targetRole: formData.targetRole || (analysis.targetRoles && analysis.targetRoles[0]) || '',
                            experienceLevel: formData.experienceLevel || analysis.experienceLevel || 'Mid-Senior'
                        });
                        // Update local form state too so it shows immediately
                        setFormData(prev => ({
                            ...prev,
                            keywords: prev.keywords || analysis.keywords.join(', '),
                            targetRole: prev.targetRole || (analysis.targetRoles && analysis.targetRoles[0]) || '',
                            experienceLevel: prev.experienceLevel || analysis.experienceLevel || 'Mid-Senior'
                        }));
                    }} />
                </div>

                {/* 1.5. AI Configuration */}
                <div className="card animate-slide-up delay-175">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>AI Configuration</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Add your own Gemini API Key to enable AI features. This key is stored securely in your private profile.
                    </p>
                    <ApiKeyInput />
                </div>

                {/* 2. Profile Form */}
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
                {/* 2. Data Management */}
                <div className="card animate-slide-up delay-300">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>Data Management</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Export your data or delete your account. These actions help you stay in control of your information.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <ExportDataButton />
                        <DeleteAccountButton />
                    </div>
                </div>
            </div>
        </div>
    );
}

function ExportDataButton() {
    const { jobs, profile } = useAppStore();
    const { user } = useAuth();

    const handleExport = () => {
        const exportData = {
            exportDate: new Date().toISOString(),
            user: user ? { email: user.email, displayName: user.displayName } : null,
            profile,
            jobs,
            totalJobs: jobs.length
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jobtracker-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <button
            onClick={handleExport}
            style={{
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            📦 Export My Data
        </button>
    );
}

function DeleteAccountButton() {
    const { user } = useAuth();
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!user) return;

        setDeleting(true);
        try {
            // Delete Firestore data
            const { deleteAllUserData } = await import('@/lib/firestore-sync');
            await deleteAllUserData(user.uid);

            // Delete Firebase auth account
            await user.delete();

            // Clear local storage
            localStorage.clear();

            // Redirect to login
            window.location.href = '/login';
        } catch (err) {
            console.error('Delete account error:', err);
            alert('Failed to delete account. You may need to re-authenticate first.');
            setDeleting(false);
        }
    };

    if (confirming) {
        return (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: 'var(--error)', fontSize: '0.9rem' }}>Are you sure?</span>
                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        background: 'var(--error)',
                        color: 'white',
                        border: 'none',
                        cursor: deleting ? 'not-allowed' : 'pointer'
                    }}
                >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                    onClick={() => setConfirming(false)}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        background: 'var(--bg-panel)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            style={{
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--error)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            🗑️ Delete Account
        </button>
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

function ApiKeyInput() {
    const { profile, updateProfile } = useAppStore();
    const [key, setKey] = useState('');
    const [show, setShow] = useState(false);
    const [saved, setSaved] = useState(false);

    // Sync local state with profile
    useEffect(() => {
        if (profile?.geminiApiKey) {
            setKey(profile.geminiApiKey);
        }
    }, [profile?.geminiApiKey]);

    const handleSave = () => {
        updateProfile({ geminiApiKey: key });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
                <input
                    type={show ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Enter your Gemini API Key (starts with AIza...)"
                    style={{ width: '100%', paddingRight: '80px' }}
                />
                <button
                    onClick={() => setShow(!show)}
                    style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                    }}
                >
                    {show ? 'Hide' : 'Show'}
                </button>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button onClick={handleSave} className="btn-primary" style={{ padding: '8px 16px' }}>
                    {saved ? 'Saved!' : 'Save Key'}
                </button>
                <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}
                >
                    Get a Key
                </a>
            </div>
        </div>
    );
}

function ResumeUpload({ onAnalysisComplete }) {
    const fileInputRef = useRef(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState(null);
    const { profile } = useAppStore();

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setError("File is too large (max 5MB)");
            return;
        }

        setAnalyzing(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const model = getGeminiModel();
            const prompt = `
            You are an expert career coagch and resume analyst.
            Analyze the following resume and extract the key information needed to find relevant job matches and improve the user's profile.

            Return a JSON object with the following structure:
            {
                "skills": ["skill1", "skill2", ...],
                "experienceLevel": "Entry/Mid/Senior/Executive",
                "targetRoles": ["Role Title 1", "Role Title 2"],
                "summary": "A 2-sentence professional summary of the candidate.",
                "keywords": ["keyword1", "keyword2", ...]
            }

            Resume Content:
            `;

            const documentPart = await fileToGenerativePart(file);
            const result = await model.generateContent([prompt, documentPart]);
            const responseText = result.response.text();

            const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const analysis = JSON.parse(cleanJson);

            console.log("Resume analysis:", analysis);
            onAnalysisComplete(analysis);
        } catch (err) {
            console.error('Resume analysis error:', err);
            setError(err.message || 'Failed to analyze resume');
        } finally {
            setAnalyzing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const hasResume = profile?.resumeAnalysis;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: hasResume ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {hasResume ? <CheckCircle size={24} color="var(--success)" /> : <FileText size={24} color="var(--text-secondary)" />}
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {hasResume ? 'Resume Analyzed' : 'Upload Resume'}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {hasResume
                            ? 'Your resume has been processed. We use this to find better job matches.'
                            : 'Upload your resume (PDF) to auto-fill your profile and get better job matches.'}
                    </p>
                </div>
                <div>
                    <input
                        type="file"
                        accept=".pdf,.txt"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={analyzing}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {analyzing ? (
                            <>
                                <Loader size={16} className="spin" /> Analyzing...
                            </>
                        ) : (
                            <>
                                <Upload size={16} /> {hasResume ? 'Update Resume' : 'Upload PDF'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--error)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {hasResume && (
                <div style={{ background: 'var(--bg-panel)', padding: '16px', borderRadius: '8px', fontSize: '0.9rem' }}>
                    <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--accent-primary)' }}>AI Summary:</p>
                    <p style={{ fontStyle: 'italic', marginBottom: '12px', color: 'var(--text-secondary)' }}>"{profile.resumeAnalysis.summary}"</p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {profile.resumeAnalysis.skills?.slice(0, 5).map((skill, i) => (
                            <span key={i} style={{ padding: '4px 10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', fontSize: '0.8rem' }}>
                                {skill}
                            </span>
                        ))}
                        {profile.resumeAnalysis.skills?.length > 5 && (
                            <span style={{ padding: '4px 10px', fontSize: '0.8rem', opacity: 0.7 }}>+{profile.resumeAnalysis.skills.length - 5} more</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
