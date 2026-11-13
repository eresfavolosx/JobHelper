"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, Sparkles, Clock, AlertTriangle, Copy, Mail, 
    Send, Briefcase, FileText, Lightbulb, Check, Lock
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { generateWithFallback, extractJson } from '@/lib/gemini-client';
import { isOwner, isProUser } from '@/lib/subscription';
import { CareerCoachSkeleton } from '@/components/SkeletonLoaders';

export default function AiCareerCoachModal({ job, isOpen, onClose, onOpenUpgrade }) {
    const { user } = useAuth();
    const profile = useAppStore(state => state.profile);
    const [activeTab, setActiveTab] = useState('ghosting'); // 'ghosting', 'interview', 'ats'
    const [loading, setLoading] = useState(false);
    const [coachData, setCoachData] = useState(null);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [error, setError] = useState(null);
    const [now] = useState(() => new Date());
    const mouseDownTargetRef = useRef(null);

    const isAuthorized = isOwner(user) || isProUser(user, profile) || Boolean(profile?.geminiApiKey);

    // Calculate days elapsed since job created or updated
    const daysElapsed = React.useMemo(() => {
        if (!job) return 0;
        const refDate = job.updatedAt || job.appliedAt || job.createdAt;
        if (!refDate) return 0;
        const diff = now.getTime() - new Date(refDate).getTime();
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }, [job, now]);

    const ghostStatus = React.useMemo(() => {
        if (daysElapsed >= 10) {
            return {
                level: 'high',
                label: 'Ghost Alert (10+ Days)',
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.12)',
                border: 'rgba(239, 68, 68, 0.3)',
                advice: 'Recruiters have likely paused this pipeline. Send a high-urgency or value-add message to resurrect it.'
            };
        }
        if (daysElapsed >= 5) {
            return {
                level: 'medium',
                label: 'Follow-Up Window (5-9 Days)',
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.12)',
                border: 'rgba(245, 158, 11, 0.3)',
                advice: 'This is the prime conversion window. Following up now increases reply rates by over 45%.'
            };
        }
        return {
            level: 'low',
            label: 'On Track (0-4 Days)',
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.12)',
            border: 'rgba(16, 185, 129, 0.3)',
            advice: 'Standard screening time. Review your interview preparation notes in the meantime.'
        };
    }, [daysElapsed]);

    // Load AI career strategy on open
    useEffect(() => {
        if (!isOpen || !job) {
            setCoachData(null);
            setError(null);
            return;
        }

        if (!isAuthorized) {
            return; // Free users get upgrade prompt
        }

        const fetchStrategy = async () => {
            setLoading(true);
            setError(null);

            const jobTitle = job.role || job.title || 'Software Engineer';
            const jobNotes = job.notes || job.description || '';

            const prompt = `You are the world's most elite executive career coach and recruiter.
Analyze this job application and candidate profile to generate a tactical career coaching strategy:

<job>
Title: ${jobTitle}
Company: ${job.company || 'Tech Company'}
Status: ${job.status || 'applied'}
Days Since Update: ${daysElapsed} days
Description: ${jobNotes.slice(0, 1500)}
</job>

<candidate>
Name: ${profile?.fullName || 'Candidate'}
Target Role: ${profile?.targetRole || jobTitle}
Experience: ${profile?.experienceLevel || 'Mid-Senior'}
Keywords/Skills: ${profile?.keywords || ''}
Resume Summary: ${profile?.resumeAnalysis?.summary || 'Experienced software professional.'}
</candidate>

Return ONLY valid JSON matching this schema:
{
  "followUps": [
    {
      "type": "The Value-Add Hook",
      "subject": "Follow-up subject line",
      "body": "Personalized 2-paragraph email body referencing a relevant tech trend or project insight for their company.",
      "bestTimeToDay": "Tuesday morning 9:30 AM"
    },
    {
      "type": "The Gentle Pulse",
      "subject": "Follow-up subject line",
      "body": "Concise, respectful inquiry about the hiring timeline and offering any additional portfolio materials.",
      "bestTimeToDay": "Thursday afternoon 2:00 PM"
    },
    {
      "type": "The Polite FOMO Close",
      "subject": "Follow-up subject line",
      "body": "High-conversion email stating you are currently advancing in other interview stages but remain deeply excited about this team, asking for a quick update before decisions are locked.",
      "bestTimeToDay": "Monday morning 10:00 AM"
    }
  ],
  "interviewPrep": {
    "predictedQuestions": [
      {
        "question": "Realistic challenging question likely asked for this role",
        "starFramework": "Situation/Task: ..., Action: ..., Result: ...",
        "whyTheyAsk": "What the interviewer is testing"
      },
      {
        "question": "Second challenging question",
        "starFramework": "Situation/Task: ..., Action: ..., Result: ...",
        "whyTheyAsk": "What the interviewer is testing"
      },
      {
        "question": "Third challenging question",
        "starFramework": "Situation/Task: ..., Action: ..., Result: ...",
        "whyTheyAsk": "What the interviewer is testing"
      }
    ],
    "reverseQuestions": [
      "Strategic question for candidate to ask that demonstrates top 1% seniority and uncovers team red flags",
      "Second strategic question to ask the interviewer",
      "Third strategic question to ask the interviewer"
    ]
  },
  "atsGap": {
    "matchPercent": 88,
    "matchingSkills": ["Skill 1", "Skill 2", "Skill 3"],
    "missingKeywords": ["Keyword A", "Keyword B"],
    "tailoredBullets": [
      "Accomplished X using Y to deliver Z metric tailored to this job description.",
      "Engineered A with B resulting in C improvement."
    ]
  }
}`;

            try {
                const response = await generateWithFallback(prompt, { jsonMode: true });
                const parsed = extractJson(response);
                if (parsed) {
                    setCoachData(parsed);
                } else {
                    throw new Error("Unable to parse coach strategy.");
                }
            } catch (err) {
                console.error("[AiCareerCoach] Error generating strategy:", err);
                if (err?.code === 'SUBSCRIPTION_REQUIRED') {
                    setError('SUBSCRIPTION_REQUIRED');
                } else {
                    setError(err?.message || 'Failed to generate AI strategy. Please try again.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchStrategy();
    }, [isOpen, job, daysElapsed, isAuthorized, profile]);

    if (!isOpen || !job) return null;

    const copyToClipboard = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2500);
    };

    const handleBackdropMouseDown = (e) => {
        mouseDownTargetRef.current = e.target;
    };

    const handleBackdropClick = (e) => {
        if (mouseDownTargetRef.current === e.currentTarget && e.target === e.currentTarget) {
            onClose();
        }
        mouseDownTargetRef.current = null;
    };

    const modalContent = (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="NovuJobs AI Career Agent"
            onMouseDown={handleBackdropMouseDown}
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 10005,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px'
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="card animate-scale-up"
                style={{
                    width: '100%',
                    maxWidth: '820px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: 'clamp(16px, 4vw, 24px)',
                    position: 'relative',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    background: 'var(--bg-app)'
                }}
            >
                {/* Close Button */}
                <button
                    type="button"
                    aria-label="Close AI Career Agent"
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <X size={22} />
                </button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{
                        padding: '8px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(118, 133, 142, 0.22), rgba(250, 248, 244, 0.08))',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        <Sparkles size={24} color="var(--accent-secondary)" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                            NovuJobs AI Career Agent
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {job.role || job.title || 'Application'} at <strong>{job.company}</strong>
                        </p>
                    </div>
                </div>

                {/* Ghosting Radar Ribbon */}
                <div style={{
                    margin: '16px 0',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: ghostStatus.bg,
                    border: `1px solid ${ghostStatus.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clock size={20} color={ghostStatus.color} />
                        <div>
                            <div style={{ fontWeight: 'bold', color: ghostStatus.color, fontSize: '0.95rem' }}>
                                Ghosting Radar: {daysElapsed} {daysElapsed === 1 ? 'day' : 'days'} elapsed · {ghostStatus.label}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                                {ghostStatus.advice}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    borderBottom: '1px solid var(--border-subtle)',
                    marginBottom: '20px',
                    paddingBottom: '4px',
                    overflowX: 'auto'
                }}>
                    <button
                        onClick={() => setActiveTab('ghosting')}
                        style={{
                            padding: '8px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'ghosting' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            color: activeTab === 'ghosting' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Send size={16} /> Ghosting Buster & Follow-Ups
                    </button>
                    <button
                        onClick={() => setActiveTab('interview')}
                        style={{
                            padding: '8px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'interview' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            color: activeTab === 'interview' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Lightbulb size={16} /> Interview Power Coach
                    </button>
                    <button
                        onClick={() => setActiveTab('ats')}
                        style={{
                            padding: '8px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'ats' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            color: activeTab === 'ats' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <FileText size={16} /> ATS Gap & Resume Tailor
                    </button>
                </div>

                {/* Body Content */}
                {!isAuthorized || error === 'SUBSCRIPTION_REQUIRED' ? (
                    <div style={{
                        padding: '32px 24px',
                        textAlign: 'center',
                        background: 'rgba(107, 126, 103, 0.08)',
                        border: '1px solid rgba(107, 126, 103, 0.25)',
                        borderRadius: '16px',
                        margin: '12px 0'
                    }}>
                        <Lock size={42} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px' }}>
                            Unlock AI Career Agent & Ghosting Buster
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 20px' }}>
                            Get hyper-personalized recruiter follow-up templates, interview question predictions with STAR frameworks, and ATS resume tailoring.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => {
                                    onClose();
                                    if (onOpenUpgrade) onOpenUpgrade();
                                    else window.location.href = '/profile#subscription-section';
                                }}
                                className="btn-primary"
                                style={{ padding: '10px 20px', fontSize: '0.95rem' }}
                            >
                                <Sparkles size={16} /> Upgrade to NovuJobs Pro ($9.99/mo)
                            </button>
                            <a
                                href="/profile#api-keys-section"
                                className="btn-secondary"
                                style={{ padding: '10px 20px', fontSize: '0.95rem' }}
                            >
                                Or Enter Free Gemini Key in Profile
                            </a>
                        </div>
                    </div>
                ) : loading ? (
                    <CareerCoachSkeleton label="Consulting AI Career Agent" />
                ) : error ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
                        <AlertTriangle size={32} style={{ margin: '0 auto 8px' }} />
                        <div>{error}</div>
                    </div>
                ) : coachData ? (
                    <div>
                        {/* Tab 1: Ghosting Buster Follow-ups */}
                        {activeTab === 'ghosting' && (
                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Choose one of 3 tactical follow-up strategies tailored to resurrect or accelerate your application:
                                </div>
                                {coachData.followUps?.map((item, idx) => (
                                    <div key={idx} style={{
                                        padding: '16px',
                                        borderRadius: '12px',
                                        background: 'var(--bg-panel)',
                                        border: '1px solid var(--border-subtle)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)', fontSize: '0.95rem' }}>
                                                {item.type}
                                            </div>
                                            {item.bestTimeToDay && (
                                                <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: 'rgba(107, 126, 103, 0.16)', color: 'var(--accent-primary)' }}>
                                                    ⚡ Best send time: {item.bestTimeToDay}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                                            Subject: <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>{item.subject}</span>
                                        </div>
                                        <div style={{
                                            fontSize: '0.9rem',
                                            color: 'var(--text-primary)',
                                            background: 'var(--bg-app)',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: '1.5',
                                            marginBottom: '12px'
                                        }}>
                                            {item.body}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => copyToClipboard(`Subject: ${item.subject}\n\n${item.body}`, `f-${idx}`)}
                                                className="btn-secondary"
                                                style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                                            >
                                                {copiedIndex === `f-${idx}` ? (
                                                    <>
                                                        <Check size={14} color="#10b981" /> Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy size={14} /> Copy Template
                                                    </>
                                                )}
                                            </button>
                                            <a
                                                href={`mailto:?subject=${encodeURIComponent(item.subject)}&body=${encodeURIComponent(item.body)}`}
                                                className="btn-primary"
                                                style={{ fontSize: '0.85rem', padding: '6px 14px', textDecoration: 'none' }}
                                            >
                                                <Mail size={14} /> Open in Email App
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tab 2: Interview Prep Coach */}
                        {activeTab === 'interview' && (
                            <div style={{ display: 'grid', gap: '20px' }}>
                                <div>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Lightbulb size={18} color="var(--accent-primary)" /> Top Predicted Interview Questions
                                    </h4>
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {coachData.interviewPrep?.predictedQuestions?.map((q, idx) => (
                                            <div key={idx} style={{
                                                padding: '14px',
                                                borderRadius: '10px',
                                                background: 'var(--bg-panel)',
                                                border: '1px solid var(--border-subtle)'
                                            }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '4px' }}>
                                                    {idx + 1}. {q.question}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                                                    🎯 Evaluator intent: {q.whyTheyAsk}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.85rem',
                                                    background: 'var(--bg-app)',
                                                    padding: '10px',
                                                    borderRadius: '8px',
                                                    lineHeight: '1.4'
                                                }}>
                                                    <strong>STAR Talking Framework:</strong> {q.starFramework}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Briefcase size={18} color="var(--accent-primary)" /> Reverse Interviewing Power Questions
                                    </h4>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        Ask these to show exceptional seniority and uncover internal team culture:
                                    </p>
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {coachData.interviewPrep?.reverseQuestions?.map((rq, idx) => (
                                            <div key={idx} style={{
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                background: 'rgba(107, 126, 103, 0.08)',
                                                border: '1px solid rgba(107, 126, 103, 0.25)',
                                                fontSize: '0.9rem',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span>“{rq}”</span>
                                                <button
                                                    onClick={() => copyToClipboard(rq, `rq-${idx}`)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: '4px' }}
                                                    title="Copy question"
                                                >
                                                    {copiedIndex === `rq-${idx}` ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab 3: ATS Keyword Gap */}
                        {activeTab === 'ats' && (
                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '14px 18px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-panel)',
                                    border: '1px solid var(--border-subtle)'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            ATS Job Match Score
                                        </div>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                                            {coachData.atsGap?.matchPercent || 85}%
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '400px' }}>
                                        {coachData.atsGap?.matchingSkills?.map((s, idx) => (
                                            <span key={idx} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                                ✓ {s}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {coachData.atsGap?.missingKeywords?.length > 0 && (
                                    <div style={{
                                        padding: '14px',
                                        borderRadius: '10px',
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        border: '1px solid rgba(239, 68, 68, 0.25)'
                                    }}>
                                        <div style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '0.9rem', marginBottom: '6px' }}>
                                            ⚠️ Keywords Missing in Your Resume for this Role:
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {coachData.atsGap?.missingKeywords?.map((kw, idx) => (
                                                <span key={idx} style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px', background: '#ef4444', color: 'white', fontWeight: '500' }}>
                                                    + {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '8px' }}>
                                        Tailored Resume Bullets to Add for this Job:
                                    </div>
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {coachData.atsGap?.tailoredBullets?.map((bullet, idx) => (
                                            <div key={idx} style={{
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                background: 'var(--bg-panel)',
                                                border: '1px solid var(--border-subtle)',
                                                fontSize: '0.85rem',
                                                lineHeight: '1.4',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                gap: '12px',
                                                alignItems: 'center'
                                            }}>
                                                <span>• {bullet}</span>
                                                <button
                                                    onClick={() => copyToClipboard(bullet, `b-${idx}`)}
                                                    className="btn-secondary"
                                                    style={{ padding: '4px 8px', fontSize: '0.75rem', flexShrink: 0 }}
                                                >
                                                    {copiedIndex === `b-${idx}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );

    if (typeof document !== 'undefined' && document.body) {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
}
