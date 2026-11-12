"use client";
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import {
    Loader,
    AlertCircle,
    Plus,
    Sparkles,
    ExternalLink,
    RefreshCw,
    CheckCircle,
    Search,
    X,
    ShieldCheck,
    HelpCircle,
    Ban,
    Info,
} from 'lucide-react';
import { fetchJobsWithCoverage, scoreJobsWithGemini } from '@/lib/job-service';
import {
    ELIGIBILITY_OUTCOMES,
    RECOMMENDATION_LABELS,
    canonicalizeJobUrl,
} from '@/lib/job-matcher';
import { sanitizeUrl } from '@/lib/utils';
import UpgradeModal from '@/components/UpgradeModal';
import JobSettingsBanner from '@/components/JobSettingsBanner';

const CACHE_KEY = 'jobhelper_recommendations_cache_v2';
const FP_CACHE_KEY = 'jobhelper_recommendations_fp_cache_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function parseRecommendedJobTitle(rawTitle = '', rawSource = '') {
    const title = String(rawTitle || '').trim();
    if (!title) return { company: rawSource || 'Company', role: 'Role' };

    if (title.includes(': ')) {
        const [comp, ...rest] = title.split(': ');
        if (comp && rest.length > 0) {
            return { company: comp.trim(), role: rest.join(': ').trim() };
        }
    }
    if (title.includes(' at ')) {
        const parts = title.split(' at ');
        if (parts.length >= 2) {
            return { role: parts[0].trim(), company: parts.slice(1).join(' at ').trim() };
        }
    }
    if (title.includes(' - ')) {
        const [first, ...rest] = title.split(' - ');
        if (first && rest.length > 0) {
            return { company: first.trim(), role: rest.join(' - ').trim() };
        }
    }
    return { company: rawSource || 'Employer', role: title };
}

function getLabelStyle(label) {
    switch (label) {
        case RECOMMENDATION_LABELS.RECOMMEND:
            return { bg: 'rgba(34, 197, 94, 0.16)', color: 'var(--success)', border: 'rgba(34, 197, 94, 0.35)' };
        case RECOMMENDATION_LABELS.WORTHWHILE_STRETCH:
            return { bg: 'rgba(107, 126, 103, 0.18)', color: 'var(--accent-primary)', border: 'rgba(107, 126, 103, 0.38)' };
        case RECOMMENDATION_LABELS.NEEDS_CLARIFICATION:
            return { bg: 'rgba(234, 179, 8, 0.16)', color: 'var(--warning)', border: 'rgba(234, 179, 8, 0.38)' };
        default:
            return { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--error)', border: 'rgba(239, 68, 68, 0.28)' };
    }
}

function getGateBadge(status) {
    if (status === ELIGIBILITY_OUTCOMES.PASS) {
        return { text: 'Pass', color: 'var(--success)', icon: CheckCircle };
    }
    if (status === ELIGIBILITY_OUTCOMES.FAIL) {
        return { text: 'Fail', color: 'var(--error)', icon: Ban };
    }
    return { text: 'Unknown', color: 'var(--warning)', icon: HelpCircle };
}

export default function RecommendationsPage() {
    const profile = useAppStore(state => state.profile);
    const trackedJobs = useAppStore(state => state.jobs);
    const isPremium = useAppStore(state => state.isPremium);
    const addJob = useAppStore((state) => state.addJob);
    const [jobs, setJobs] = useState([]);
    const [coverageReport, setCoverageReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [addedJobs, setAddedJobs] = useState(new Set());
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [recSearchQuery, setRecSearchQuery] = useState('');
    const [labelFilter, setLabelFilter] = useState('actionable');

    const trackedUrls = useMemo(() => new Set(
        (trackedJobs || [])
            .filter(j => j && j.status !== 'deleted' && (j.url || j.link))
            .map(j => canonicalizeJobUrl(j.url || j.link))
            .filter(Boolean)
    ), [trackedJobs]);

    const isCurrentlyPremium = isPremium();
    const hasAccess = isCurrentlyPremium || Boolean(profile?.geminiApiKey);

    const labelCounts = useMemo(() => {
        const counts = {
            actionable: 0,
            clarify: 0,
            skip: 0,
            all: jobs.length,
        };
        for (const j of jobs) {
            if (j.label === RECOMMENDATION_LABELS.RECOMMEND || j.label === RECOMMENDATION_LABELS.WORTHWHILE_STRETCH) {
                counts.actionable += 1;
            } else if (j.label === RECOMMENDATION_LABELS.NEEDS_CLARIFICATION) {
                counts.clarify += 1;
            } else {
                counts.skip += 1;
            }
        }
        return counts;
    }, [jobs]);

    const filteredRecommendations = useMemo(() => {
        if (!Array.isArray(jobs)) return [];
        const tokens = recSearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return jobs
            .filter(job => {
                if (!job) return false;
                if (labelFilter === 'actionable') {
                    if (job.label !== RECOMMENDATION_LABELS.RECOMMEND && job.label !== RECOMMENDATION_LABELS.WORTHWHILE_STRETCH) {
                        return false;
                    }
                } else if (labelFilter === 'clarify') {
                    if (job.label !== RECOMMENDATION_LABELS.NEEDS_CLARIFICATION) return false;
                } else if (labelFilter === 'skip') {
                    if (job.label !== RECOMMENDATION_LABELS.SKIP) return false;
                }

                if (tokens.length === 0) return true;
                const parsed = parseRecommendedJobTitle(job.title, job.source);
                const haystack = `${job.title || ''} ${job.employer || parsed.company || ''} ${job.roleTitle || parsed.role || ''} ${job.source || ''} ${job.matchReason || ''} ${job.description || ''}`.toLowerCase();
                return tokens.every(t => haystack.includes(t));
            })
            .map(job => {
                const parsedDate = job.pubDate ? new Date(job.pubDate) : null;
                return {
                    ...job,
                    sanitizedLink: sanitizeUrl(job.link),
                    canonicalLink: canonicalizeJobUrl(job.link),
                    parsedTitle: parseRecommendedJobTitle(job.title, job.source),
                    formattedDate: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toLocaleDateString() : 'Recent',
                    cleanDescription: String(job.description || '').replace(/<[^>]*>?/gm, '')
                };
            });
    }, [jobs, recSearchQuery, labelFilter]);

    const findJobs = async (forceRefresh = false) => {
        if (!forceRefresh && typeof window !== 'undefined') {
            try {
                const cachedRaw = localStorage.getItem(CACHE_KEY);
                if (cachedRaw) {
                    const cached = JSON.parse(cachedRaw);
                    const isFresh = Date.now() - (cached.timestamp || 0) < CACHE_TTL_MS;
                    if (isFresh && Array.isArray(cached.jobs) && cached.jobs.length > 0) {
                        setJobs(cached.jobs);
                        if (cached.coverageReport) setCoverageReport(cached.coverageReport);
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
                body.keywords = [...(profile.resumeAnalysis.keywords || []), ...(profile.resumeAnalysis.skills || [])].slice(0, 6);
                body.resumeData = profile.resumeAnalysis;
            } else {
                body.keywords = profile?.keywords ? profile.keywords.split(',').map(k => k.trim()).filter(Boolean) : [];
                const modalityStr = Array.isArray(profile?.modality) ? profile.modality.join(', ') : String(profile?.modality || '');
                body.resumeData = {
                    targetRole: profile?.targetRole || '',
                    experienceLevel: Array.isArray(profile?.experienceLevel) ? profile.experienceLevel.join(', ') : (profile?.experienceLevel || ''),
                    skills: body.keywords,
                    country: profile?.country || 'Puerto Rico',
                    modality: modalityStr || 'Remote',
                    minimumSalary: profile?.minimumSalary || '85000',
                };
            }

            let cachedByFingerprint = {};
            if (typeof window !== 'undefined') {
                try {
                    const fpRaw = localStorage.getItem(FP_CACHE_KEY);
                    if (fpRaw) cachedByFingerprint = JSON.parse(fpRaw) || {};
                } catch {
                    cachedByFingerprint = {};
                }
            }

            const { jobs: rawJobs, coverageReport: coverage } = await fetchJobsWithCoverage(body.keywords);
            const scoredJobs = await scoreJobsWithGemini(rawJobs, body.resumeData, {
                trackedJobs,
                cachedByFingerprint,
            });

            const fullCoverage = {
                ...coverage,
                ...(scoredJobs.coverageStats || {}),
            };
            setJobs(scoredJobs);
            setCoverageReport(fullCoverage);

            if (typeof window !== 'undefined' && scoredJobs.length > 0) {
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        jobs: scoredJobs,
                        coverageReport: fullCoverage,
                        timestamp: Date.now(),
                    }));
                    const nextFpCache = { ...cachedByFingerprint };
                    for (const item of scoredJobs) {
                        if (item.fingerprint) {
                            nextFpCache[item.fingerprint] = {
                                extracted: item.extracted,
                                eligibility: item.eligibility,
                                scoring: item.scoring,
                                geminiReason: item.geminiReason || '',
                                cachedAt: Date.now(),
                            };
                        }
                    }
                    localStorage.setItem(FP_CACHE_KEY, JSON.stringify(nextFpCache));
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

    useEffect(() => {
        if (jobs.length === 0) {
            findJobs(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Sparkles className="text-accent-primary" /> Job Recommendations
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                        Evidence-gated matching against Growth, MOpS, Lifecycle, GTM, BI, TPM, and Practical AI Ops. Scores are ranking aids, not hiring probabilities.
                    </p>
                </div>
                <button
                    onClick={() => findJobs(true)}
                    disabled={loading}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <RefreshCw size={18} className={loading ? 'spin' : ''} />
                    Refresh Matches
                </button>
            </header>

            <JobSettingsBanner onSettingsSaved={() => findJobs(true)} />

            {coverageReport && !loading && (
                <div
                    className="card"
                    style={{
                        padding: '12px 16px',
                        marginBottom: '18px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                    }}
                >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Info size={14} color="var(--accent-primary)" /> Coverage &amp; Token Cache
                        </strong>
                        <span>Evaluated: {coverageReport.totalEvaluated ?? jobs.length}</span>
                        <span>•</span>
                        <span>Cached unchanged: {coverageReport.cachedCount ?? 0}</span>
                        <span>•</span>
                        <span>Newly investigated: {coverageReport.newlyEvaluatedCount ?? 0}</span>
                        <span>•</span>
                        <span>Filters: {(coverageReport.filtersReviewed || []).join(', ')}</span>
                    </div>
                    {Array.isArray(coverageReport.incompleteCoverageReasons) && coverageReport.incompleteCoverageReasons.length > 0 && (
                        <div style={{ color: 'var(--warning)' }}>
                            Coverage note: {coverageReport.incompleteCoverageReasons.join(' | ')}
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', gap: '24px' }}>
                    <Loader size={48} className="spin" color="var(--accent-primary)" />
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Extracting posting facts, checking eligibility gates, and matching evidence...</p>
                </div>
            ) : !hasAccess ? (
                <div className="card" style={{
                    textAlign: 'center',
                    padding: 'clamp(40px, 6vw, 80px) clamp(20px, 4vw, 40px)',
                    background: 'linear-gradient(135deg, rgba(94, 135, 110, 0.06) 0%, rgba(212, 163, 115, 0.05) 100%)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '24px',
                }}>
                    <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '16px' }}>Premium AI Insights</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 32px', lineHeight: '1.6' }}>
                        Unlock specialized job matches curated by AI based on your verified evidence and eligibility gates.
                    </p>
                    <Link href="/profile" className="btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem', display: 'inline-flex', justifyContent: 'center' }}>
                        Upgrade to Premium
                    </Link>
                </div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
                    <AlertCircle size={48} style={{ marginBottom: '16px', display: 'inline-block' }} />
                    <p style={{ fontSize: '1.1rem', marginBottom: '24px' }}>{error}</p>
                    <button onClick={() => findJobs(true)} className="btn-primary">Try Again</button>
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
                            gap: '10px',
                        }}
                    >
                        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '460px' }}>
                            <label htmlFor="recommendations-search-input" className="sr-only">
                                Search evaluated roles by company, title, source, or keyword
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
                                    pointerEvents: 'none',
                                }}
                            />
                            <input
                                id="recommendations-search-input"
                                type="search"
                                value={recSearchQuery}
                                onChange={e => setRecSearchQuery(e.target.value)}
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder="Filter by employer, role, evidence, or gap..."
                                style={{
                                    width: '100%',
                                    padding: '8px 32px 8px 34px',
                                    fontSize: '0.84rem',
                                    borderRadius: '999px',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
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
                                        display: 'inline-flex',
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {[
                                { id: 'actionable', label: `Actionable (${labelCounts.actionable})` },
                                { id: 'clarify', label: `Needs clarification (${labelCounts.clarify})` },
                                { id: 'all', label: `All (${labelCounts.all})` },
                                { id: 'skip', label: `Skip (${labelCounts.skip})` },
                            ].map(opt => {
                                const active = labelFilter === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setLabelFilter(opt.id)}
                                        style={{
                                            padding: '5px 11px',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            fontWeight: active ? 700 : 500,
                                            background: active ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-card)',
                                            border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </search>

                    {filteredRecommendations.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-secondary)' }}>
                            <ShieldCheck size={36} style={{ margin: '0 auto 12px', color: 'var(--accent-primary)', opacity: 0.7 }} />
                            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                Zero qualifying recommendations in this view
                            </p>
                            <p style={{ fontSize: '0.88rem', maxWidth: '520px', margin: '0 auto' }}>
                                Roles that fail location, credential, or salary gates are never padded into recommendations. Check &ldquo;Needs clarification&rdquo; for roles pending Puerto Rico or salary verification.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '20px' }}>
                            {filteredRecommendations.map((job, i) => {
                                const sanitizedLink = job.sanitizedLink;
                                const labelStyle = getLabelStyle(job.label);
                                const prBadge = getGateBadge(job.puertoRicoStatus);
                                const PrIcon = prBadge.icon;
                                const eligBadge = getGateBadge(job.eligibility?.overall);
                                const EligIcon = eligBadge.icon;
                                const isAlreadyOnBoard = addedJobs.has(job.link) || (job.canonicalLink && trackedUrls.has(job.canonicalLink)) || job.duplicate?.isDuplicate;

                                return (
                                    <div key={job.fingerprint || job.link || i} className="card animate-scale-in" style={{
                                        padding: '22px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%',
                                        gap: '12px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                            <div>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '3px 10px',
                                                    borderRadius: '999px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    background: labelStyle.bg,
                                                    color: labelStyle.color,
                                                    border: `1px solid ${labelStyle.border}`,
                                                    marginBottom: '6px',
                                                }}>
                                                    {job.label}
                                                </span>
                                                <h3 style={{ fontWeight: 'bold', fontSize: '1.08rem', lineHeight: '1.3' }}>
                                                    {job.roleTitle || job.title}
                                                </h3>
                                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                                    {job.employer || job.parsedTitle?.company} • {job.source} • {job.formattedDate}
                                                    {job.requisitionId ? ` • Req: ${job.requisitionId}` : ''}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.88rem',
                                                    fontWeight: 800,
                                                    background: 'var(--glass-highlight)',
                                                    color: 'var(--text-primary)',
                                                }}>
                                                    {job.relevanceScore}/100
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                                                    Confidence: {job.evidenceConfidence || 'medium'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Separate Dimensions: Eligibility, Puerto Rico, Pay */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '8px',
                                            padding: '10px',
                                            borderRadius: '10px',
                                            background: 'var(--glass-highlight)',
                                            fontSize: '0.77rem',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: eligBadge.color, fontWeight: 600 }}>
                                                <EligIcon size={13} /> Eligibility: {eligBadge.text}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: prBadge.color, fontWeight: 600 }}>
                                                <PrIcon size={13} /> PR: {prBadge.text}
                                            </div>
                                            <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>PR Note:</strong> {job.puertoRicoDetail || 'Unverified'}
                                            </div>
                                            <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>
                                                <strong style={{ color: 'var(--text-primary)' }}>Pay:</strong> {job.paySummary || 'Undisclosed'}
                                            </div>
                                        </div>

                                        {/* Strongest Evidence */}
                                        {Array.isArray(job.strongestEvidence) && job.strongestEvidence.length > 0 && (
                                            <div style={{ fontSize: '0.8rem' }}>
                                                <strong style={{ color: 'var(--success)', display: 'block', marginBottom: '3px' }}>Strongest Evidence</strong>
                                                <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                                    {job.strongestEvidence.slice(0, 2).map((ev, idx) => (
                                                        <li key={idx}>{ev}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Real Gaps */}
                                        {Array.isArray(job.realGaps) && job.realGaps.length > 0 && (
                                            <div style={{ fontSize: '0.8rem' }}>
                                                <strong style={{ color: 'var(--error)', display: 'block', marginBottom: '3px' }}>Real Gaps / Exclusions</strong>
                                                <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                                    {job.realGaps.slice(0, 2).map((gap, idx) => (
                                                        <li key={idx}>{gap}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Reasoning */}
                                        <div style={{
                                            fontSize: '0.82rem',
                                            color: 'var(--text-secondary)',
                                            background: 'rgba(107, 126, 103, 0.08)',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            lineHeight: 1.45,
                                        }}>
                                            {job.matchReason}
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--glass-highlight)' }}>
                                            <a
                                                href={sanitizedLink || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-secondary"
                                                style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            >
                                                View <ExternalLink size={14} />
                                            </a>
                                            {isAlreadyOnBoard ? (
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
                                                        color: 'var(--success)',
                                                    }}
                                                >
                                                    <CheckCircle size={16} /> On Board
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        try {
                                                            const parsed = job.parsedTitle || parseRecommendedJobTitle(job.title, job.source);
                                                            addJob({
                                                                company: job.employer || parsed.company,
                                                                role: job.roleTitle || parsed.role,
                                                                requisitionId: job.requisitionId || '',
                                                                url: sanitizedLink,
                                                                status: 'wishlist',
                                                                notes: `[${job.label} · ${job.relevanceScore}/100 · PR: ${job.puertoRicoStatus}] ${job.matchReason}`,
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
                                                                setError('Failed to save job application to board.');
                                                            }
                                                        }
                                                    }}
                                                    className="btn-primary"
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                    }}
                                                >
                                                    <Plus size={16} /> Track Role
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <UpgradeModal
                isOpen={upgradeOpen}
                onClose={() => setUpgradeOpen(false)}
                reason="Upgrade to NovuJobs Pro or add your personal Gemini API key in Profile to unlock unlimited AI job recommendations."
            />
        </div>
    );
}
