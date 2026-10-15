"use client";
import React, { useState } from 'react';
import { 
    X, Mail, Sparkles, CheckCircle2, ArrowRight, AlertTriangle, 
    Loader, Check, Plus, Inbox, Clipboard, ExternalLink
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { generateWithFallback, extractJson } from '@/lib/gemini-client';
import { auth } from '@/lib/firebase';
import { connectGmailAccount, fetchRecentJobEmails, getStoredGmailToken } from '@/lib/gmail-service';
import { findMatchingJob, classifyEmailIntent } from '@/lib/email-matcher';

export default function GmailJobSyncModal({ isOpen, onClose }) {
    const jobs = useAppStore(state => state.jobs);
    const moveJob = useAppStore(state => state.moveJob);
    const updateJob = useAppStore(state => state.updateJob);
    const addJob = useAppStore(state => state.addJob);

    const [emailText, setEmailText] = useState('');
    const [fetchingGmail, setFetchingGmail] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResults, setAnalysisResults] = useState(null);
    const [appliedUpdates, setAppliedUpdates] = useState(new Set());
    const [error, setError] = useState('');
    const [apiDisabledInfo, setApiDisabledInfo] = useState(null);

    if (!isOpen) return null;

    const handleDirectGmailFetch = async () => {
        setFetchingGmail(true);
        setError('');
        setApiDisabledInfo(null);
        try {
            let token = getStoredGmailToken();
            if (!token) {
                const res = await connectGmailAccount(auth);
                token = res.accessToken;
            }

            // Target the user's active tracked companies explicitly (e.g. Atlassian, Google, etc.)
            const targetCompanies = (jobs || [])
                .filter(j => j && j.status !== 'deleted' && j.company)
                .map(j => j.company);

            const emails = await fetchRecentJobEmails(token, 30, targetCompanies);
            if (emails.length === 0) {
                setError(`No recent recruiter emails found in your Gmail inbox over the past 30 days matching your applications. If you received an email recently (like an Atlassian update), click "Paste from Clipboard" or paste the email text below to sync immediately.`);
                return;
            }

            const formatted = emails.map(e => `[Subject: ${e.subject} | From: ${e.from} | Date: ${e.date}]\n${e.snippet}`).join('\n\n---\n\n');
            setEmailText(formatted);
            setTimeout(() => {
                handleAnalyze(formatted);
            }, 100);
        } catch (err) {
            console.error('[GmailSync] Fetch failed:', err);
            if (err.code === 'GMAIL_API_DISABLED') {
                setApiDisabledInfo({
                    message: err.message,
                    enableUrl: err.enableUrl
                });
            } else {
                setError(err.message || 'Failed to fetch from Gmail. You can paste the email text below.');
            }
        } finally {
            setFetchingGmail(false);
        }
    };

    const handlePasteClipboard = async () => {
        setError('');
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                    setEmailText(text.trim());
                    handleAnalyze(text.trim());
                    return;
                }
            }
            setError('Clipboard is empty. Copy your recruiter email and press Paste or Cmd+V / Ctrl+V in the box below.');
        } catch {
            setError('Could not access clipboard automatically. Please paste using Cmd+V or Ctrl+V in the text box below.');
        }
    };

    const handleInsertAtlassianSample = () => {
        setError('');
        const atlassianEmail = `From: talent-acquisition@atlassian.com\nSubject: Next steps regarding your application at Atlassian\nDate: Yesterday\n\nHi Fabian,\n\nThank you for your interest in joining Atlassian! Our engineering team reviewed your profile and we were very impressed by your software engineering track record.\n\nWe would love to invite you to schedule a 45-minute technical screen with one of our Engineering Managers next week. Please pick a convenient time using the link below.\n\nBest regards,\nThe Atlassian Recruiting Team`;
        setEmailText(atlassianEmail);
        handleAnalyze(atlassianEmail);
    };

    const handleAnalyze = async (textOverride = null) => {
        const textToAnalyze = textOverride || emailText;
        if (!textToAnalyze || !textToAnalyze.trim()) {
            setError('Please paste the email content or fetch from Gmail.');
            return;
        }

        setAnalyzing(true);
        setError('');
        setAnalysisResults(null);

        const activeJobsList = jobs
            .filter(j => j && j.status !== 'deleted')
            .map(j => ({ id: j.id, company: j.company, role: j.role || j.title, status: j.status }));

        const prompt = `You are an AI Email Assistant specializing in job applications and recruiter correspondence.
Analyze the following email from a recruiter, company, or job board against the user's active tracked applications.

<tracked_applications>
${JSON.stringify(activeJobsList, null, 2)}
</tracked_applications>

<email_content>
${textToAnalyze.slice(0, 3000)}
</email_content>

Identify:
1. Which company and role this email is discussing.
2. If this matches an existing application in <tracked_applications> (matchedJobId).
3. The category of this email:
   - "interview_invite" (invitation for screening, behavioral, technical, or final interview)
   - "offer" (job offer extended or compensation package discussed)
   - "rejection" (position filled, moving forward with other candidates)
   - "assessment" (take-home challenge, HackerRank, Codility test)
   - "confirmation" (application received / acknowledged)
4. The recommended new board status:
   - "interviewing" (for interview_invite or assessment)
   - "offer" (for offer)
   - "rejected" (for rejection)
   - "applied" (for confirmation)
5. A concise 1-sentence summary of the update and the exact 1-sentence quote from the email as evidence.

Return ONLY a JSON array of detected updates (usually 1, but could be multiple if thread contains several companies):
[
  {
    "company": "Company Name",
    "role": "Job Role",
    "matchedJobId": "matching-job-id-or-null",
    "matchedJobCurrentStatus": "current-status-or-null",
    "emailCategory": "interview_invite",
    "suggestedStatus": "interviewing",
    "shouldMove": true,
    "confidence": 95,
    "summary": "Invitation to schedule a 30-minute introductory screen.",
    "keyQuote": "We were very impressed by your background and would love to set up a chat next week..."
  }
]`;

        try {
            let items = [];

            // 1. Try Gemini AI analysis first if available
            try {
                const responseText = await generateWithFallback(prompt, { jsonMode: true });
                const parsed = extractJson(responseText);
                const rawItems = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
                if (rawItems.length > 0) {
                    items = rawItems;
                }
            } catch (aiErr) {
                console.warn('[GmailJobSync] Gemini AI generation skipped or failed, using local deterministic engine:', aiErr?.message || aiErr);
            }

            // 2. If Gemini didn't return items, run local deterministic analyzer
            if (!items || items.length === 0) {
                const emailChunks = textToAnalyze.split(/\n\s*---\s*\n/).filter(c => c.trim().length > 10);
                const chunksToProcess = emailChunks.length > 0 ? emailChunks : [textToAnalyze];

                for (const chunk of chunksToProcess) {
                    const subjectMatch = chunk.match(/Subject:\s*([^\n|]+)/i);
                    const fromMatch = chunk.match(/From:\s*([^\n|]+)/i);
                    const subject = subjectMatch ? subjectMatch[1].trim() : '';
                    const from = fromMatch ? fromMatch[1].trim() : '';

                    const mockEmail = {
                        subject: subject || chunk.slice(0, 80),
                        from: from || chunk.slice(0, 80),
                        snippet: chunk
                    };

                    const matchedJob = findMatchingJob(mockEmail, activeJobsList);
                    const intent = classifyEmailIntent(chunk);

                    if (matchedJob || intent.suggestedStatus) {
                        const companyName = matchedJob?.company || (subject ? subject.split(' ')[0] : 'Company');
                        const roleName = matchedJob?.role || matchedJob?.title || 'Job Application';

                        items.push({
                            company: companyName,
                            role: roleName,
                            matchedJobId: matchedJob?.id || null,
                            matchedJobCurrentStatus: matchedJob?.status || null,
                            emailCategory: intent.category,
                            suggestedStatus: intent.suggestedStatus || (matchedJob?.status === 'applied' ? 'interviewing' : matchedJob?.status || 'applied'),
                            shouldMove: matchedJob ? matchedJob.status !== intent.suggestedStatus : true,
                            confidence: intent.confidence || 85,
                            summary: intent.category === 'interview_invite'
                                ? `Interview / screening invitation received from ${companyName}`
                                : intent.category === 'offer'
                                ? `Job offer extended by ${companyName}!`
                                : intent.category === 'rejection'
                                ? `Application update from ${companyName}`
                                : intent.category === 'assessment'
                                ? `Technical assessment invitation from ${companyName}`
                                : `Recruiter status update from ${companyName}`,
                            keyQuote: chunk.slice(0, 160).replace(/\n/g, ' ') + '...'
                        });
                    }
                }
            }

            // Cross-verify with deterministic company matching to ensure no role is missed
            items = items.map(item => {
                if (!item.matchedJobId) {
                    const fallbackMatch = findMatchingJob({
                        subject: item.role || item.company,
                        from: item.company,
                        snippet: `${item.company} ${item.summary || ''} ${item.keyQuote || ''}`
                    }, activeJobsList);
                    if (fallbackMatch) {
                        return {
                            ...item,
                            matchedJobId: fallbackMatch.id,
                            matchedJobCurrentStatus: fallbackMatch.status,
                            shouldMove: fallbackMatch.status !== item.suggestedStatus
                        };
                    }
                }
                return item;
            });

            if (items.length > 0) {
                setAnalysisResults(items);
            } else {
                setError('No job-related updates detected in the provided text. You can paste the email body directly below to try again.');
            }
        } catch (err) {
            console.error('[GmailJobSync] Analysis failed:', err);
            setError(err.message || 'Failed to analyze email content. Please try again.');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleApplyMove = (item, index) => {
        if (!item.matchedJobId) return;

        const currentJob = jobs.find(j => j.id === item.matchedJobId);
        const dateStr = new Date().toLocaleDateString();
        const updateNote = `[AI Email Update - ${dateStr}]: ${item.summary} ("${item.keyQuote}")`;
        const updatedNotes = currentJob?.notes ? `${currentJob.notes}\n\n${updateNote}` : updateNote;

        // Move status
        moveJob(item.matchedJobId, item.suggestedStatus);
        // Append note with evidence
        updateJob(item.matchedJobId, { notes: updatedNotes, updatedAt: new Date().toISOString() });

        setAppliedUpdates(prev => new Set(prev).add(index));
    };

    const handleAddNewJob = (item, index) => {
        const dateStr = new Date().toLocaleDateString();
        addJob({
            company: item.company || 'Unknown Company',
            role: item.role || 'Role',
            status: item.suggestedStatus || 'applied',
            notes: `[Auto-created from Email on ${dateStr}]: ${item.summary} ("${item.keyQuote}")`
        });
        setAppliedUpdates(prev => new Set(prev).add(index));
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }}>
            <div className="card animate-scale-up" style={{
                width: '100%',
                maxWidth: '720px',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '28px',
                position: 'relative',
                border: '1px solid var(--accent-primary)',
                boxShadow: '0 25px 50px -12px rgba(56, 189, 248, 0.25)'
            }}>
                <button
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(208, 90, 71, 0.15), rgba(94, 135, 110, 0.15))',
                        border: '1px solid rgba(208, 90, 71, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Mail size={22} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                            AI Email & Status Sync
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            Paste recruiter emails, interview invitations, or status updates to automatically sync your board.
                        </p>
                    </div>
                </div>

                {/* 1-Click Live Gmail Connect Option */}
                <div style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(208, 90, 71, 0.08), rgba(94, 135, 110, 0.08))',
                    border: '1px solid rgba(208, 90, 71, 0.25)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    margin: '16px 0',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={16} color="#ef4444" /> Direct Gmail Synchronization
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Scan your Gmail inbox directly for recruiter updates over the past 30 days.
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleDirectGmailFetch}
                        disabled={fetchingGmail || analyzing}
                        className="btn-primary"
                        style={{ fontSize: '0.85rem', padding: '8px 16px', background: 'linear-gradient(135deg, #ef4444, #ea580c)' }}
                    >
                        {fetchingGmail ? (
                            <>
                                <Loader size={14} className="spin" /> Scanning Inbox...
                            </>
                        ) : (
                            <>
                                <Inbox size={15} /> Fetch Directly from Gmail
                            </>
                        )}
                    </button>
                </div>

                {/* Helpful API Setup Banner (if Gmail API is not yet enabled in GCP) */}
                {apiDisabledInfo && (
                    <div style={{
                        padding: '14px 18px',
                        borderRadius: '12px',
                        background: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        color: 'var(--text-primary)',
                        fontSize: '0.88rem',
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#eab308' }}>
                            <AlertTriangle size={18} /> Google Cloud Gmail API Setup Required
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            Google requires the Gmail API to be turned on once in your Google Cloud project (<strong>jobhelper-c3cd7</strong>). Click below to enable it in 1 click:
                        </p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <a
                                href={apiDisabledInfo.enableUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary"
                                style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                            >
                                <ExternalLink size={14} /> Enable Gmail API in Google Cloud
                            </a>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Or use &quot;Paste from Clipboard&quot; below to sync your card immediately!
                            </span>
                        </div>
                    </div>
                )}

                {/* Email Paste Area */}
                <div style={{ margin: '16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                            Or Paste Email Body / Recruiter Thread:
                        </label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={handlePasteClipboard}
                                className="btn-secondary"
                                style={{ fontSize: '0.78rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                title="Paste recruiter email from your clipboard"
                            >
                                <Clipboard size={13} /> Paste from Clipboard
                            </button>
                            <button
                                type="button"
                                onClick={handleInsertAtlassianSample}
                                className="btn-secondary"
                                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                                title="Test the Atlassian recruiter update flow"
                            >
                                Atlassian Recruiter Update
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={emailText}
                        onChange={e => setEmailText(e.target.value)}
                        placeholder={`Paste an email like:\n"Hi Fabian, thank you for your patience. The engineering team reviewed your profile and we would love to schedule a 45-minute technical screen for the Senior Fullstack Engineer role next Tuesday..."`}
                        rows={6}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '10px',
                            background: 'var(--bg-app)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            lineHeight: '1.5',
                            resize: 'vertical'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                    <button
                        onClick={() => handleAnalyze()}
                        disabled={analyzing || !emailText.trim()}
                        className="btn-primary"
                        style={{ padding: '10px 22px', fontSize: '0.95rem' }}
                    >
                        {analyzing ? (
                            <>
                                <Loader size={16} className="spin" /> Scanning with AI Engine...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} /> Scan & Detect Status Updates
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => {
                            setEmailText(`Hi Fabian,\n\nThanks for speaking with our team! We were all very impressed with your background and would love to move you forward to the next round: a 45-minute technical interview with our Lead Engineer.\n\nPlease share your availability for next Tuesday or Wednesday.\n\nBest regards,\nSarah Jenkins\nSenior Technical Recruiter`);
                        }}
                        className="btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                        Sample Interview Invite
                    </button>
                </div>

                {error && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        fontSize: '0.9rem',
                        marginBottom: '16px'
                    }}>
                        <AlertTriangle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                        {error}
                    </div>
                )}

                {/* Detected Actions List */}
                {analysisResults && (
                    <div style={{ display: 'grid', gap: '14px', marginTop: '16px' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                            Detected Application Updates ({analysisResults.length}):
                        </div>

                        {analysisResults.map((item, idx) => {
                            const isApplied = appliedUpdates.has(idx);

                            return (
                                <div key={idx} style={{
                                    padding: '16px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-panel)',
                                    border: '1px solid var(--border-subtle)',
                                    display: 'grid',
                                    gap: '10px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                                {item.company}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginLeft: '8px' }}>
                                                · {item.role}
                                            </span>
                                        </div>

                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            background: 'rgba(56, 189, 248, 0.15)',
                                            color: 'var(--accent-primary)',
                                            fontWeight: 'bold'
                                        }}>
                                            {item.confidence}% Match Confidence
                                        </span>
                                    </div>

                                    {/* Status Change Arrow */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.9rem',
                                        background: 'var(--bg-app)',
                                        padding: '8px 12px',
                                        borderRadius: '8px'
                                    }}>
                                        <span>Current: <strong>{item.matchedJobCurrentStatus || 'Not Tracked'}</strong></span>
                                        <ArrowRight size={16} color="var(--accent-primary)" />
                                        <span>Suggested: <strong style={{ color: 'var(--accent-primary)', textTransform: 'capitalize' }}>{item.suggestedStatus}</strong></span>
                                    </div>

                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                        <strong>Summary:</strong> {item.summary}
                                    </div>

                                    {item.keyQuote && (
                                        <div style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-secondary)',
                                            fontStyle: 'italic',
                                            borderLeft: '2px solid var(--accent-primary)',
                                            paddingLeft: '10px'
                                        }}>
                                            “{item.keyQuote}”
                                        </div>
                                    )}

                                    {/* Action Button */}
                                    <div style={{ marginTop: '4px' }}>
                                        {isApplied ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                <CheckCircle2 size={18} /> Board Updated Successfully!
                                            </div>
                                        ) : item.matchedJobId ? (
                                            <button
                                                onClick={() => handleApplyMove(item, idx)}
                                                className="btn-primary"
                                                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                                            >
                                                <Check size={16} /> Apply Suggested Move ({item.matchedJobCurrentStatus} ➔ {item.suggestedStatus})
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleAddNewJob(item, idx)}
                                                className="btn-primary"
                                                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
                                            >
                                                <Plus size={16} /> Add to Board as New Job ({item.suggestedStatus})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
