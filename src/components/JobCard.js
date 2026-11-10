"use client";
import { formatDistanceToNow } from 'date-fns';
import { memo, useState, useMemo, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Trash2, Pencil, ExternalLink, MapPin, Sparkles, Clock, FileText, Plus, Check, X, ChevronDown, Archive, ArchiveRestore, GripVertical, Send } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { safeDate, sanitizeUrl } from '@/lib/utils';
import { getMapsSearchUrl } from '@/lib/maps-service';
import AiCareerCoachModal from './AiCareerCoachModal';
import UpgradeModal from './UpgradeModal';

const STAGE_META = {
    wishlist: {
        label: 'Wishlist',
        dot: '#9DA7AE',
        bg: 'rgba(157, 167, 174, 0.12)',
        border: 'rgba(157, 167, 174, 0.28)'
    },
    applied: {
        label: 'Applied',
        dot: '#6B7E67',
        bg: 'rgba(107, 126, 103, 0.16)',
        border: 'rgba(107, 126, 103, 0.36)'
    },
    screening: {
        label: 'Initial Screening',
        dot: '#0ea5e9',
        bg: 'rgba(14, 165, 233, 0.15)',
        border: 'rgba(14, 165, 233, 0.35)'
    },
    interviewing: {
        label: 'Interviewing',
        dot: '#D4A373',
        bg: 'rgba(212, 163, 115, 0.16)',
        border: 'rgba(212, 163, 115, 0.38)'
    },
    offer: {
        label: 'Offer',
        dot: '#10b981',
        bg: 'rgba(16, 185, 129, 0.14)',
        border: 'rgba(16, 185, 129, 0.36)'
    },
    accepted: {
        label: 'Accepted',
        dot: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.16)',
        border: 'rgba(34, 197, 94, 0.4)'
    },
    rejected: {
        label: 'Rejected',
        dot: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.3)'
    },
    archived: {
        label: 'Archived',
        dot: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.14)',
        border: 'rgba(148, 163, 184, 0.34)'
    },
    deleted: {
        label: 'Deleted',
        dot: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.3)'
    }
};

const JobCard = memo(function JobCard({ job }) {
    const deleteJob = useAppStore(s => s.deleteJob);
    const archiveJob = useAppStore(s => s.archiveJob);
    const restoreJob = useAppStore(s => s.restoreJob);
    const moveJob = useAppStore(s => s.moveJob);
    const updateJob = useAppStore(s => s.updateJob);
    const logJobFollowUp = useAppStore(s => s.logJobFollowUp);
    const openEditJobModal = useUIStore(s => s.openEditJobModal);
    const isHighlighted = useUIStore(s => s.highlightedJobId === job.id);
    const setBoardFilters = useUIStore(s => s.setBoardFilters);
    const [coachOpen, setCoachOpen] = useState(false);
    const [upgradeOpen, setUpgradeOpen] = useState(false);
    const [isEditingResume, setIsEditingResume] = useState(false);
    const [resumeUrlDraft, setResumeUrlDraft] = useState(job.resumeUrl || '');
    const [resumeNameDraft, setResumeNameDraft] = useState(job.resumeName || '');

    // Follow-up outreach logger state
    const [followUpOpen, setFollowUpOpen] = useState(false);
    const [followUpChannel, setFollowUpChannel] = useState('email');
    const [followUpNote, setFollowUpNote] = useState('');
    const [followUpSuccess, setFollowUpSuccess] = useState(false);

    const [today] = useState(() => new Date());
    const followUpTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (followUpTimerRef.current) {
                clearTimeout(followUpTimerRef.current);
            }
        };
    }, []);

    const daysSince = useMemo(() => {
        const latestFollowUp = Array.isArray(job.followUps) && job.followUps.length > 0
            ? job.followUps[0].date
            : null;
        const refDate = job.lastFollowUpAt || latestFollowUp || job.lastInteraction || job.updatedAt || job.appliedAt || job.createdAt || job.dateAdded;
        if (!refDate) return 0;
        const diff = today.getTime() - safeDate(refDate).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        return isNaN(days) ? 0 : Math.max(0, days);
    }, [job, today]);

    const handleLogFollowUp = (e, quick = false) => {
        e.stopPropagation();
        e.preventDefault();
        logJobFollowUp(job.id, {
            date: new Date().toISOString(),
            channel: quick ? 'email' : followUpChannel,
            note: quick ? 'Followed up with recruiter' : (followUpNote.trim() || 'Followed up with recruiter')
        });
        setFollowUpSuccess(true);
        if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
        followUpTimerRef.current = setTimeout(() => {
            setFollowUpSuccess(false);
            setFollowUpOpen(false);
            setFollowUpNote('');
        }, 1200);
    };

    const ghostChip = useMemo(() => {
        if (daysSince >= 10) {
            return { label: `Ghost Alert (${daysSince}d)`, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' };
        }
        if (daysSince >= 5) {
            return { label: `Follow-Up (${daysSince}d)`, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
        }
        return { label: `Active (${daysSince}d)`, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
    }, [daysSince]);

    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: job.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        ...(isHighlighted ? {
            outline: '2px solid var(--accent-primary)',
            boxShadow: '0 0 0 4px rgba(107, 126, 103, 0.28), 0 12px 28px rgba(0, 0, 0, 0.35)'
        } : {})
    };

    const handleDelete = (e) => {
        e.stopPropagation(); // Prevent drag start
        e.preventDefault();
        deleteJob(job.id);
    };

    const handleArchive = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (job.status === 'archived' || job.status === 'deleted') {
            restoreJob(job.id);
        } else {
            archiveJob(job.id);
        }
    };

    const handleEdit = (e) => {
        e.stopPropagation();
        e.preventDefault();
        openEditJobModal(job);
    };

    const handleStatusChange = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const nextStatus = e.target.value;
        if (nextStatus === 'archived') {
            archiveJob(job.id);
        } else {
            moveJob(job.id, nextStatus);
        }
    };

    const handleOpenResumeEditor = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setResumeUrlDraft(job.resumeUrl || '');
        setResumeNameDraft(job.resumeName || '');
        setIsEditingResume(true);
    };

    const handleSaveResume = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const rawUrl = (resumeUrlDraft || '').trim();
        const normalizedUrl = rawUrl ? (sanitizeUrl(rawUrl) || rawUrl) : '';
        const trimmedName = (resumeNameDraft || '').trim();
        updateJob(job.id, {
            resumeUrl: normalizedUrl,
            resumeName: trimmedName
        });
        setIsEditingResume(false);
    };

    const sanitizedUrl = sanitizeUrl(job.url);
    const sanitizedResumeUrl = sanitizeUrl(job.resumeUrl);
    const hasResumeInfo = Boolean(sanitizedResumeUrl || (job.resumeName && job.resumeName.trim()));
    const jobDate = safeDate(job.createdAt || job.dateAdded);
    const stageMeta = STAGE_META[job.status] || STAGE_META.wishlist;

    return (
        <>
        <div
            id={`job-card-${job.id}`}
            data-agent-job-id={job.id}
            data-agent-stage={job.status}
            ref={setNodeRef}
            style={style}
            className="card interactive-card group"
        >
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h4 style={{ fontWeight: '600', fontSize: '1.02rem', color: 'var(--text-primary)', lineHeight: 1.35, flex: 1, minWidth: 0 }}>
                        {job.role}
                    </h4>
                    <div className="job-actions-group" style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onPointerDown={e => e.stopPropagation()}>
                        <button
                            type="button"
                            ref={setActivatorNodeRef}
                            {...attributes}
                            {...listeners}
                            data-agent-action="drag-handle"
                            data-agent-job-id={job.id}
                            aria-label={`Drag ${job.role} at ${job.company} to another stage, or use arrow keys`}
                            title="Drag card to move between stages"
                            className={`job-action-btn job-drag-handle ${isDragging ? 'dragging' : ''}`}
                        >
                            <GripVertical size={14} />
                        </button>
                        <button
                            type="button"
                            data-agent-action="edit-job"
                            data-agent-job-id={job.id}
                            aria-label={`Edit ${job.role} at ${job.company}`}
                            title="Edit Application"
                            onClick={handleEdit}
                            className="job-action-btn edit"
                        >
                            <Pencil size={14} />
                        </button>
                        <button
                            type="button"
                            data-agent-action="archive-job"
                            data-agent-job-id={job.id}
                            aria-label={
                                job.status === 'archived' || job.status === 'deleted'
                                    ? `Restore ${job.role} at ${job.company}`
                                    : `Archive ${job.role} at ${job.company}`
                            }
                            title={
                                job.status === 'archived' || job.status === 'deleted'
                                    ? `Restore to ${job.previousStatus || 'Wishlist'}`
                                    : 'Archive Application'
                            }
                            onClick={handleArchive}
                            className="job-action-btn archive"
                        >
                            {job.status === 'archived' || job.status === 'deleted' ? (
                                <ArchiveRestore size={14} />
                            ) : (
                                <Archive size={14} />
                            )}
                        </button>
                        <button
                            type="button"
                            data-agent-action="delete-job"
                            data-agent-job-id={job.id}
                            aria-label={`Delete ${job.role} at ${job.company}`}
                            title="Delete Application"
                            onClick={handleDelete}
                            className="job-action-btn delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (job.company) {
                            setBoardFilters({ boardCompanyFilter: job.company });
                        }
                    }}
                    title={`Filter board by ${job.company}`}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'var(--accent-primary)',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        marginBottom: job.location ? '4px' : '0',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'inline-block'
                    }}
                >
                    {job.company}
                </button>
                {(job.location || job.commuteTime) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        {job.location && (
                            <a
                                href={getMapsSearchUrl(job.company, job.location)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onPointerDown={e => e.stopPropagation()}
                                title={`Open ${job.company} (${job.location}) on Google Maps`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'none',
                                    background: 'var(--glass-highlight)',
                                    padding: '2px 6px',
                                    borderRadius: '4px'
                                }}
                            >
                                <MapPin size={11} color="var(--accent-primary)" />
                                {job.location}
                            </a>
                        )}
                        {job.commuteTime && job.location !== 'Remote' && (
                            <span
                                title="Commute estimate from home location"
                                style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--accent-primary)',
                                    background: 'var(--glass-highlight)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: '500'
                                }}
                            >
                                🚗 {job.commuteTime}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Dedicated Resume Used Section */}
            <div
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                style={{
                    marginTop: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: hasResumeInfo ? 'rgba(107, 126, 103, 0.1)' : 'var(--glass-panel)',
                    border: hasResumeInfo ? '1px solid rgba(107, 126, 103, 0.3)' : '1px dashed var(--border-subtle)',
                    fontSize: '0.78rem'
                }}
            >
                {isEditingResume ? (
                    <form onSubmit={handleSaveResume} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label
                                htmlFor={`resume-url-${job.id}`}
                                style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <FileText size={12} color="var(--accent-primary)" /> Resume Link Used
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsEditingResume(false)}
                                aria-label="Cancel editing resume link"
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                            >
                                <X size={13} />
                            </button>
                        </div>
                        {(() => {
                            const allJobs = useAppStore.getState().jobs || [];
                            const seen = new Set();
                            const recent = [];
                            for (const j of allJobs) {
                                if (!j || j.status === 'deleted') continue;
                                const rUrl = (j.resumeUrl || '').trim();
                                const rName = (j.resumeName || '').trim();
                                if (!rUrl && !rName) continue;
                                const key = `${rUrl}|${rName}`.toLowerCase();
                                if (seen.has(key)) continue;
                                seen.add(key);
                                recent.push({ resumeUrl: rUrl, resumeName: rName || 'Saved Resume' });
                                if (recent.length >= 3) break;
                            }
                            if (recent.length === 0) return null;
                            return (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {recent.map((item, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setResumeUrlDraft(item.resumeUrl || '');
                                                setResumeNameDraft(item.resumeName || '');
                                            }}
                                            title={`Fill ${item.resumeName}`}
                                            style={{
                                                padding: '2px 7px',
                                                borderRadius: '999px',
                                                fontSize: '0.68rem',
                                                fontWeight: 600,
                                                border: '1px solid var(--border-subtle)',
                                                background: 'var(--bg-card)',
                                                color: 'var(--accent-primary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {item.resumeName}
                                        </button>
                                    ))}
                                </div>
                            );
                        })()}
                        <input
                            id={`resume-url-${job.id}`}
                            name="resumeUrl"
                            type="text"
                            inputMode="url"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            value={resumeUrlDraft}
                            onChange={e => setResumeUrlDraft(e.target.value)}
                            placeholder="https://docs.google.com/... or Drive link"
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                fontSize: '0.78rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                                id={`resume-name-${job.id}`}
                                name="resumeName"
                                type="text"
                                aria-label="Resume version or label"
                                value={resumeNameDraft}
                                onChange={e => setResumeNameDraft(e.target.value)}
                                placeholder="Label (e.g. AI Resume v2)"
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    padding: '6px 8px',
                                    fontSize: '0.76rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'var(--accent-primary)',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <Check size={12} /> Save
                            </button>
                        </div>
                    </form>
                ) : hasResumeInfo ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                            <FileText size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', flexShrink: 0 }}>Resume:</span>
                            {sanitizedResumeUrl ? (
                                <a
                                    href={sanitizedResumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Open resume used for ${job.role} at ${job.company}`}
                                    style={{
                                        color: 'var(--accent-primary)',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        minWidth: 0,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {job.resumeName?.trim() || 'Open Resume Link'}
                                    </span>
                                    <ExternalLink size={11} style={{ flexShrink: 0 }} />
                                </a>
                            ) : (
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {job.resumeName}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleOpenResumeEditor}
                            title="Edit resume link for this job"
                            aria-label={`Edit resume link for ${job.role}`}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                flexShrink: 0
                            }}
                        >
                            <Pencil size={12} />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handleOpenResumeEditor}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            color: 'var(--text-secondary)',
                            fontSize: '0.76rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                            textAlign: 'left'
                        }}
                        title="Attach a link to the resume version you used for this job"
                    >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={13} color="var(--accent-primary)" />
                            <span>Resume Used</span>
                        </span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Plus size={12} /> Add Link
                        </span>
                    </button>
                )}
            </div>

            {/* Dedicated Stage Selector & Metadata Row */}
            <div
                onPointerDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    marginTop: '12px'
                }}
            >
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <label htmlFor={`stage-select-${job.id}`} className="sr-only">
                        Application stage for {job.role} at {job.company}
                    </label>
                    <span
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: '9px',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: stageMeta.dot,
                            pointerEvents: 'none'
                        }}
                    />
                    <select
                        id={`stage-select-${job.id}`}
                        name="status"
                        value={job.status || 'wishlist'}
                        onChange={handleStatusChange}
                        title="Change application stage"
                        style={{
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            width: 'auto',
                            padding: '5px 25px 5px 21px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            lineHeight: 1.2,
                            borderRadius: '999px',
                            background: stageMeta.bg,
                            border: `1px solid ${stageMeta.border}`,
                            color: 'var(--text-primary)',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="wishlist">Stage: Wishlist</option>
                        <option value="applied">Stage: Applied</option>
                        <option value="screening">Stage: Initial Screening</option>
                        <option value="interviewing">Stage: Interviewing</option>
                        <option value="offer">Stage: Offer</option>
                        <option value="accepted">Stage: Accepted</option>
                        <option value="rejected">Stage: Rejected</option>
                        <option value="archived">Stage: Archived</option>
                        {job.status === 'deleted' && <option value="deleted">Stage: Deleted</option>}
                    </select>
                    <ChevronDown
                        size={13}
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-secondary)',
                            pointerEvents: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span
                        title={jobDate.toLocaleString()}
                        style={{ background: 'var(--glass-highlight)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.74rem' }}
                    >
                        {formatDistanceToNow(jobDate, { addSuffix: true })}
                    </span>
                    {sanitizedUrl && (
                        <a
                            aria-label={`Source for ${job.role} at ${job.company}`}
                            title="View Job Posting"
                            href={sanitizedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onPointerDown={e => e.stopPropagation()}
                            className="job-source-link"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--glass-highlight)', transition: 'background 0.2s' }}
                        >
                            Posting <ExternalLink size={11} />
                        </a>
                    )}
                </div>
            </div>

            {/* Ghosting Radar Chip, Follow-Up Markers & Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '8px' }} onPointerDown={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                        title={`Application communication age: ${daysSince} days since last activity`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            color: ghostChip.color,
                            background: ghostChip.bg,
                            padding: '2px 8px',
                            borderRadius: '12px'
                        }}
                    >
                        <Clock size={11} /> {ghostChip.label}
                    </span>

                    {Array.isArray(job.followUps) && job.followUps.length > 0 && (
                        <span
                            title={`Logged ${job.followUps.length} follow-up${job.followUps.length > 1 ? 's' : ''}. Latest: ${safeDate(job.followUps[0].date).toLocaleDateString()} (${job.followUps[0].channel || 'outreach'})`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.70rem',
                                fontWeight: '600',
                                color: '#8b5cf6',
                                background: 'rgba(139, 92, 246, 0.14)',
                                border: '1px solid rgba(139, 92, 246, 0.28)',
                                padding: '2px 7px',
                                borderRadius: '12px'
                            }}
                        >
                            <Send size={10} /> {job.followUps.length} {job.followUps.length === 1 ? 'follow-up' : 'follow-ups'}
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setFollowUpOpen(prev => !prev);
                        }}
                        onPointerDown={e => e.stopPropagation()}
                        className="job-action-btn"
                        title="Log a follow-up outreach to reset no comms counter"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.74rem',
                            fontWeight: '600',
                            background: followUpOpen ? 'rgba(139, 92, 246, 0.22)' : 'rgba(139, 92, 246, 0.12)',
                            color: '#8b5cf6',
                            border: '1px solid rgba(139, 92, 246, 0.35)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            cursor: 'pointer'
                        }}
                    >
                        <Send size={11} /> Follow Up
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setCoachOpen(true);
                        }}
                        onPointerDown={e => e.stopPropagation()}
                        className="job-action-btn"
                        title="Launch AI Career Agent (Ghosting Buster, STAR Interview Prep & ATS Gap)"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            background: 'linear-gradient(135deg, rgba(94, 135, 110, 0.18), rgba(132, 167, 145, 0.14))',
                            color: 'var(--accent-primary)',
                            border: '1px solid rgba(94, 135, 110, 0.35)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            cursor: 'pointer'
                        }}
                    >
                        <Sparkles size={12} /> AI Coach
                    </button>
                </div>
            </div>

            {/* Inline Follow-Up Outreach Logger Popover */}
            {followUpOpen && (
                <div
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-app)',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Send size={12} color="#8b5cf6" /> Log Follow-Up (Resets Timer)
                        </span>
                        <button
                            type="button"
                            onClick={() => setFollowUpOpen(false)}
                            aria-label="Close follow-up logger"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                            <X size={13} />
                        </button>
                    </div>

                    {followUpSuccess ? (
                        <div style={{ fontSize: '0.74rem', color: 'var(--success)', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={13} /> Follow-up recorded! Communication counter reset to 0 days.
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {[
                                    { id: 'email', label: '📧 Email' },
                                    { id: 'linkedin', label: '💼 LinkedIn' },
                                    { id: 'phone', label: '📞 Phone' },
                                    { id: 'message', label: '💬 Message' },
                                    { id: 'other', label: '🤝 Other' }
                                ].map(ch => (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        onClick={() => setFollowUpChannel(ch.id)}
                                        style={{
                                            padding: '2px 7px',
                                            borderRadius: '6px',
                                            fontSize: '0.68rem',
                                            fontWeight: 600,
                                            border: followUpChannel === ch.id ? '1px solid #8b5cf6' : '1px solid var(--border-subtle)',
                                            background: followUpChannel === ch.id ? 'rgba(139, 92, 246, 0.22)' : 'var(--bg-card)',
                                            color: followUpChannel === ch.id ? '#8b5cf6' : 'var(--text-secondary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {ch.label}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                value={followUpNote}
                                onChange={e => setFollowUpNote(e.target.value)}
                                placeholder="Note (e.g. Sent polite check-in email to recruiter)..."
                                style={{
                                    width: '100%',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.74rem'
                                }}
                            />

                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', marginTop: '2px' }}>
                                <button
                                    type="button"
                                    onClick={(e) => handleLogFollowUp(e, true)}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.70rem',
                                        fontWeight: 600,
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer'
                                    }}
                                    title="Instantly log today with default message and reset counter"
                                >
                                    ⚡ Quick Log Today
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => handleLogFollowUp(e, false)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.70rem',
                                        fontWeight: 700,
                                        background: '#8b5cf6',
                                        border: 'none',
                                        color: '#ffffff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Save &amp; Reset Counter
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {job.notes && <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--glass-panel)', padding: '8px 12px', borderRadius: '8px', lineHeight: '1.4' }}>{job.notes}</div>}
        </div>

        <AiCareerCoachModal
            job={job}
            isOpen={coachOpen}
            onClose={() => setCoachOpen(false)}
            onOpenUpgrade={() => {
                setCoachOpen(false);
                setUpgradeOpen(true);
            }}
        />
        <UpgradeModal
            isOpen={upgradeOpen}
            onClose={() => setUpgradeOpen(false)}
        />
        </>
    );
});

export default JobCard;
