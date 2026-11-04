"use client";
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Loader, AlertCircle, Plus, Sparkles, ExternalLink, RefreshCw, CheckCircle, Search, X } from 'lucide-react';
import { fetchJobsFromRSS, scoreJobsWithGemini } from '@/lib/job-service';
import { sanitizeUrl } from '@/lib/utils';
import UpgradeModal from '@/components/UpgradeModal';
import JobSettingsBanner from '@/components/JobSettingsBanner';

function parseRecommendedJobTitle(rawTitle = '', rawSource = '') {
    const title = String(rawTitle || '').trim();
    if (!title) return { company: rawSource || 'Company', role: 'Software Engineer' };

    // Pattern 1: "Company: Role Title" (standard WeWorkRemotely RSS format)
    if (title.includes(': ')) {
        const [comp, ...rest] = title.split(': ');
        if (comp && rest.length > 0) {
            return { company: comp.trim(), role: rest.join(': ').trim() };
        }
    }
    // Pattern 2: "Role Title at Company"
    if (title.includes(' at ')) {
        const parts = title.split(' at ');
        if (parts.length >= 2) {
            return { role: parts[0].trim(), company: parts.slice(1).join(' at ').trim() };
        }
    }
    // Pattern 3: "Company - Role Title"
    if (title.includes(' - ')) {
        const [first, ...rest] = title.split(' - ');
        if (first && rest.length > 0) {
            return { company: first.trim(), role: rest.join(' - ').trim() };
        }
    }
    return { company: rawSource || 'Tech Company', role: title };
}

export default function RecommendationsPage() {
    const profile = useAppStore(state => state.profile);
    const trackedJobs = useAppStore(state => state.jobs);
    const isPremium = useAppStore(state => state.isPremium);
    const addJob = useAppStore((state) => state.addJob);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [addedJobs, setAddedJobs] = useState(new Set());
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [recSearchQuery, setRecSearchQuery] = useState('');
    const [minScoreFilter, setMinScoreFilter] = useState(0);
    const CACHE_KEY = 'jobhelper_recommendations_cache';
    const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

    const trackedUrls = new Set(
        (trackedJobs || [])
            .filter(j => j && j.status !== 'deleted' && j.url)
            .map(j => sanitizeUrl(j.url))
            .filter(Boolean)
    );

    const isCurrentlyPremium = isPremium();
    const hasAccess = isCurrentlyPremium || Boolean(profile?.geminiApiKey);

    const filteredRecommendations = useMemo(() => {
        if (!Array.isArray(jobs)) return [];
        const tokens = recSearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return jobs.filter(job => {
            if (!job) return false;
            if (minScoreFilter > 0 && (job.relevanceScore || 0) < minScoreFilter) {
                return false;
            }
            if (tokens.length === 0) return true;
            const parsed = parseRecommendedJobTitle(job.title, job.source);
            const haystack = `${job.title || ''} ${parsed.company || ''} ${parsed.role || ''} ${job.source || ''} ${job.matchReason || ''} ${job.description || ''}`.toLowerCase();
            return tokens.every(t => haystack.includes(t));
        });
    }, [jobs, recSearchQuery, minScoreFilter]);

    const findJobs = async (forceRefresh = false) => {
        // Check cache first if not explicitly refreshing
        if (!forceRefresh && typeof window !== 'undefined') {
            try {
                const cachedRaw = localStorage.getItem(CACHE_KEY);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    const isFresh = Date.now() - (cached.timestamp || 0) < CACHE_TTL_MS;
                    const hasValidScores = Array.isArray(cached.jobs) && cached.jobs.length > 0 && cached.jobs.some(j => (j.relevanceScore || 0) > 0);
                    if (isFresh && hasValidScores) {
                        setJobs(cached.jobs);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Failed to read recommendations cache:', e);
            }
        }

        setLoading(true);
        setError(null);
        try {
            const body = {};

            if (profile?.resumeAnalysis) {
                // Use resume analysis if available
                body.keywords = [...(profile.resumeAnalysis.keywords || []), ...(profile.resumeAnalysis.skills || [])].slice(0, 5);
                body.resumeData = profile.resumeAnalysis;
            } else {
                // Fallback to profile manual fields with safe optional chaining
                body.keywords = profile?.keywords ? profile.keywords.split(',').map(k => k.trim()) : [];
                const modalityStr = Array.isArray(profile?.modality) ? profile.modality.join(', ') : String(profile?.modality || '');
                if (modalityStr.toLowerCase().includes('remote') || profile?.isRemote) body.keywords.push('remote');

                body.resumeData = {
                    targetRole: profile?.targetRole || 'Software Engineer',
                    experienceLevel: Array.isArray(profile?.experienceLevel) ? profile.experienceLevel.join(', ') : (profile?.experienceLevel || 'Mid-Senior'),
                    skills: profile?.keywords ? profile.keywords.split(',').map(s => s.trim()) : ['React', 'Node.js', 'JavaScript'],
                    country: profile?.country || 'Global',
                    modality: modalityStr || 'Remote',
                    minimumSalary: profile?.minimumSalary || ''
                };
            }

            const rawJobs = await fetchJobsFromRSS(body.keywords);
            const scoredJobs = await scoreJobsWithGemini(rawJobs, body.resumeData);
            setJobs(scoredJobs);

            // Cache successfully scored jobs only if we obtained valid positive scores
            if (typeof window !== 'undefined' && scoredJobs.length > 0 && scoredJobs.some(j => (j.relevanceScore || 0) > 0)) {
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        jobs: scoredJobs,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn('Failed to save recommendations cache:', e);
                }
            }
        } catch (err) {
            console.error('Error fetching recommendations:', err);
            if (err?.code === 'SUBSCRIPTION_REQUIRED') {
                setError('NovuJobs Pro ($9.99/mo) or your personal Gemini API key is required to score recommendations with AI.');
                setUpgradeOpen(true);
            } else {
                setError(err.message || 'An unexpected error occurred while fetching recommendations.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch on mount if no jobs
    useEffect(() => {
        if (jobs.length === 0) {
            findJobs(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Sparkles className="text-accent-primary" /> Job Recommendations
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        AI-curated matches based on your resume and profile.
                    </p>
                </div>
                <button
                    onClick={() => findJobs(true)}
                    disabled={loading}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <RefreshCw size={18} className={loading ? "spin" : ""} />
                    Refresh Matches
                </button>
            </header>

            <JobSettingsBanner onSettingsSaved={() => findJobs(true)} />

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', gap: '24px' }}>
                    <Loader size={48} className="spin" color="var(--accent-primary)" />
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Scouring the web for your perfect role...</p>
                </div>
            ) : !hasAccess ? (
                <div className="card" style={{ 
                    textAlign: 'center', 
                    padding: 'clamp(40px, 6vw, 80px) clamp(20px, 4vw, 40px)', 
                    background: 'linear-gradient(135deg, rgba(94, 135, 110, 0.06) 0%, rgba(212, 163, 115, 0.05) 100%)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '24px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ 
                            width: '80px', 
                            height: '80px', 
                            borderRadius: '24px', 
                            background: 'var(--accent-primary)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            margin: '0 auto 24px',
                            boxShadow: '0 8px 32px rgba(107, 126, 103, 0.35)'
                        }}>
                            <Sparkles size={40} color="white" />
                        </div>
                        <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '16px' }}>Premium AI Insights</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 32px', lineHeight: '1.6' }}>
                            Unlock specialized job matches curated by AI based on your specific resume skills and experience level.
                        </p>
                        <Link href="/profile" className="btn-primary" style={{ padding: "16px 32px", fontSize: "1.1rem", display: "inline-flex", justifyContent: "center" }}>Upgrade to Premium</Link>
                    </div>
                </div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
                    <AlertCircle size={48} style={{ marginBottom: '16px', display: 'inline-block' }} />
                    <p style={{ fontSize: '1.1rem', marginBottom: '24px' }}>{error}</p>
                    <button onClick={() => findJobs(true)} className="btn-primary">Try Again</button>
                </div>
            ) : jobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '16px' }}>
                    <p style={{ fontSize: '1.1rem' }}>No matches found yet. Try adjusting your profile keywords or uploading a new resume.</p>
                </div>
            ) : (
                <>
                <search
                    className="card"
                    style={{
                        padding: '12px 16px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px'
                    }}
                >
                    <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '460px' }}>
                        <label htmlFor="recommendations-search-input" className="sr-only">
                            Search recommended roles by company, title, source, or keyword
                        </label>
                        <Search
                            size={15}
                            color="var(--text-secondary)"
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                pointerEvents: 'none'
                            }}
                        />
                        <input
                            id="recommendations-search-input"
                            type="search"
                            value={recSearchQuery}
                            onChange={e => setRecSearchQuery(e.target.value)}
                            autocorrect="off"
                            autocapitalize="off"
                            spellCheck={false}
                            placeholder="Filter recommendations by company, role, source, or skill..."
                            style={{
                                width: '100%',
                                padding: '8px 32px 8px 34px',
                                fontSize: '0.84rem',
                                borderRadius: '999px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)'
                            }}
                        />
                        {recSearchQuery && (
                            <button
                                type="button"
                                aria-label="Clear recommendation search"
                                onClick={() => setRecSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'inline-flex'
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                            { score: 0, label: 'All Scores' },
                            { score: 80, label: '80%+ Match' },
                            { score: 60, label: '60%+ Match' }
                        ].map(opt => {
                            const active = minScoreFilter === opt.score;
                            return (
                                <button
                                    key={opt.score}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setMinScoreFilter(opt.score)}
                                    style={{
                                        padding: '5px 11px',
                                        borderRadius: '999px',
                                        fontSize: '0.75rem',
                                        fontWeight: active ? 700 : 500,
                                        background: active ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-card)',
                                        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginLeft: '4px' }}>
                            {filteredRecommendations.length} of {jobs.length} shown
                        </span>
                    </div>
                </search>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '24px' }}>
                    {filteredRecommendations.map((job, i) => {
                        const sanitizedLink = sanitizeUrl(job.link);
                        return (
                        <div key={i} className="card animate-scale-in" style={{
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            animationDelay: `${i * 50}ms`
                        }}>
                            <div style={{ marginBottom: '16px', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <h3 style={{ fontWeight: 'bold', fontSize: '1.2rem', lineHeight: '1.3' }}>{job.title}</h3>
                                    <span style={{
                                        background: job.relevanceScore > 80 ? 'rgba(34, 197, 94, 0.2)' : job.relevanceScore > 50 ? 'rgba(234, 179, 8, 0.2)' : 'var(--glass-panel)',
                                        color: job.relevanceScore > 80 ? 'var(--success)' : job.relevanceScore > 50 ? 'var(--warning)' : 'var(--text-secondary)',
                                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold',
                                        whiteSpace: 'nowrap', marginLeft: '12px'
                                    }}>
                                        {job.relevanceScore}%
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                    <span>{job.source}</span>
                                    <span>•</span>
                                    <span>{job.pubDate && !isNaN(new Date(job.pubDate).getTime()) ? new Date(job.pubDate).toLocaleDateString() : 'Recent'}</span>
                                </div>

                                <div style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--accent-primary)',
                                    background: 'rgba(107, 126, 103, 0.1)',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    marginBottom: '16px',
                                    fontStyle: 'italic'
                                }}>
                                    &quot;{job.matchReason}&quot;
                                </div>

                                <p style={{
                                    fontSize: '0.95rem',
                                    lineHeight: '1.6',
                                    color: 'var(--text-secondary)',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 4,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                }}>
                                    {job.description.replace(/<[^>]*>?/gm, '')}
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--glass-highlight)' }}>
                                <a
                                    href={sanitizedLink || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-secondary"
                                    style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    View <ExternalLink size={14} />
                                </a>
                                {(addedJobs.has(job.link) || (sanitizedLink && trackedUrls.has(sanitizedLink))) ? (
                                    <button
                                        disabled
                                        className="btn-secondary"
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            cursor: 'default',
                                            color: 'var(--success)'
                                        }}
                                    >
                                        <CheckCircle size={16} /> On Board
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            try {
                                                const parsed = parseRecommendedJobTitle(job.title, job.source);
                                                addJob({
                                                    company: parsed.company,
                                                    role: parsed.role,
                                                    url: sanitizedLink,
                                                    status: 'wishlist',
                                                    notes: `Matched via AI. Score: ${job.relevanceScore}%. Reason: ${job.matchReason}`
                                                });

                                                setAddedJobs(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.add(job.link);
                                                    return newSet;
                                                });
                                            } catch (err) {
                                                if (err?.code === 'LIMIT_REACHED') {
                                                    setUpgradeOpen(true);
                                                } else {
                                                    alert(err?.message || 'Failed to save job application.');
                                                }
                                            }
                                        }}
                                        className="btn-primary"
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <Plus size={16} /> Add to Board
                                    </button>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
                </>
            )}

            <UpgradeModal
                isOpen={upgradeOpen}
                onClose={() => setUpgradeOpen(false)}
            />
        </div>
    );
}
