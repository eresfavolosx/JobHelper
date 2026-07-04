"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Loader, AlertCircle, Plus, Sparkles, ExternalLink, RefreshCw, Check, CheckCircle } from 'lucide-react';
import { fetchJobsFromRSS, scoreJobsWithGemini } from '@/lib/job-service';
import { sanitizeUrl } from '@/lib/utils';
export default function RecommendationsPage() {
    const profile = useAppStore(state => state.profile);
    const isPremium = useAppStore(state => state.isPremium);
    const addJob = useAppStore((state) => state.addJob);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [addedJobs, setAddedJobs] = useState(new Set());

    const isCurrentlyPremium = isPremium();

    const findJobs = async () => {
        setLoading(true);
        setError(null);
        try {
            const body = {};

            if (profile?.resumeAnalysis) {
                // Use resume analysis if available
                body.keywords = [...(profile.resumeAnalysis.keywords || []), ...(profile.resumeAnalysis.skills || [])].slice(0, 5);
                body.resumeData = profile.resumeAnalysis;
            } else {
                // Fallback to profile manual fields
                body.keywords = profile.keywords ? profile.keywords.split(',').map(k => k.trim()) : [];
                if (profile.modality === 'Remote' || profile.isRemote) body.keywords.push('remote');

                body.resumeData = {
                    targetRole: profile.targetRole,
                    experienceLevel: profile.experienceLevel,
                    skills: profile.keywords ? profile.keywords.split(',') : [],
                    country: profile.country,
                    modality: profile.modality,
                    minimumSalary: profile.minimumSalary
                };
            }

            const rawJobs = await fetchJobsFromRSS(body.keywords);
            const scoredJobs = await scoreJobsWithGemini(rawJobs, body.resumeData);

            // ⚡ Bolt: Pre-calculate expensive date parsing and regex replacements before setting state
            // This prevents executing these operations on every item during every render loop.
            const processedJobs = scoredJobs.map(job => ({
                ...job,
                parsedPubDate: job.pubDate && !isNaN(new Date(job.pubDate).getTime()) ? new Date(job.pubDate).toLocaleDateString() : 'Recent',
                cleanDescription: (job.description || '').replace(/<[^>]*>?/gm, '')
            }));

            setJobs(processedJobs);
        } catch (err) {
            setError('An unexpected error occurred while fetching recommendations.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch on mount if no jobs
    useEffect(() => {
        if (jobs.length === 0) {
            findJobs();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Sparkles className="text-accent-primary" /> Job Recommendations
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        AI-curated matches based on your resume and profile.
                    </p>
                </div>
                <button
                    onClick={findJobs}
                    disabled={loading}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <RefreshCw size={18} className={loading ? "spin" : ""} />
                    Refresh Matches
                </button>
            </header>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', gap: '24px' }}>
                    <Loader size={48} className="spin" color="var(--accent-primary)" />
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Scouring the web for your perfect role...</p>
                </div>
            ) : !isCurrentlyPremium ? (
                <div className="card" style={{ 
                    textAlign: 'center', 
                    padding: '80px 40px', 
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
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
                            boxShadow: '0 8px 32px rgba(56, 189, 248, 0.3)'
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
                    <button onClick={findJobs} className="btn-primary">Try Again</button>
                </div>
            ) : jobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '16px' }}>
                    <p style={{ fontSize: '1.1rem' }}>No matches found yet. Try adjusting your profile keywords or uploading a new resume.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                    {jobs.map((job, i) => {
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
                                    <span>{job.parsedPubDate}</span>
                                </div>

                                <div style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--accent-primary)',
                                    background: 'rgba(56, 189, 248, 0.05)',
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
                                    {job.cleanDescription}
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--glass-highlight)' }}>
                                <a
                                    href={sanitizeUrl(job.link) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-secondary"
                                    style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    View <ExternalLink size={14} />
                                </a>
                                {addedJobs.has(job.link) ? (
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
                                        <CheckCircle size={16} /> Added!
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            addJob({
                                                company: 'Unknown',
                                                role: job.title,
                                                url: sanitizeUrl(job.link),
                                                status: 'wishlist',
                                                notes: `Matched via AI. Score: ${job.relevanceScore}%. Reason: ${job.matchReason}`
                                            });

                                            setAddedJobs(prev => {
                                                const newSet = new Set(prev);
                                                newSet.add(job.link);
                                                return newSet;
                                            });

                                            setTimeout(() => {
                                                setAddedJobs(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete(job.link);
                                                    return newSet;
                                                });
                                            }, 2000);
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
            )}
        </div>
    );
}
