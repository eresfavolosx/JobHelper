"use client";
import { formatDistanceToNow } from 'date-fns';
import { memo, useState, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Trash2, Pencil, ExternalLink, MapPin, Sparkles, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { safeDate, sanitizeUrl } from '@/lib/utils';
import { getMapsSearchUrl } from '@/lib/maps-service';
import AiCareerCoachModal from './AiCareerCoachModal';
import UpgradeModal from './UpgradeModal';

const JobCard = memo(function JobCard({ job }) {
    const deleteJob = useAppStore(s => s.deleteJob);
    const moveJob = useAppStore(s => s.moveJob);
    const openEditJobModal = useUIStore(s => s.openEditJobModal);
    const [coachOpen, setCoachOpen] = useState(false);
    const [upgradeOpen, setUpgradeOpen] = useState(false);

    const [today] = useState(() => new Date());
    const daysSince = useMemo(() => {
        const refDate = job.updatedAt || job.appliedAt || job.createdAt || job.dateAdded;
        if (!refDate) return 0;
        const diff = today.getTime() - new Date(refDate).getTime();
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }, [job, today]);

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
        transform,
        transition,
        isDragging,
    } = useSortable({ id: job.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleDelete = (e) => {
        e.stopPropagation(); // Prevent drag start
        e.preventDefault();
        deleteJob(job.id);
    };

    const handleEdit = (e) => {
        e.stopPropagation();
        e.preventDefault();
        openEditJobModal(job);
    };

    const handleStatusChange = (e) => {
        e.stopPropagation();
        e.preventDefault();
        moveJob(job.id, e.target.value);
    };

    const sanitizedUrl = sanitizeUrl(job.url);
    const jobDate = safeDate(job.createdAt || job.dateAdded);

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            {...attributes}
            {...listeners}
            className="card interactive-card group"
        >
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontWeight: '600', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{job.role}</h4>
                    <div className="job-actions-group" style={{ display: 'flex', gap: '4px' }} onPointerDown={e => e.stopPropagation()}>
                        <select
                            value={job.status}
                            onChange={handleStatusChange}
                            onPointerDown={e => e.stopPropagation()}
                            className="job-action-btn"
                            style={{ 
                                padding: '0 8px', 
                                fontSize: '0.8rem', 
                                height: '26px', 
                                border: 'none', 
                                background: 'var(--glass-highlight)',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                            title="Move to column"
                        >
                            <option value="wishlist">Wishlist</option>
                            <option value="applied">Applied</option>
                            <option value="interviewing">Interviewing</option>
                            <option value="offer">Offer</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <button
                            aria-label={`Edit ${job.role} at ${job.company}`}
                            title="Edit Application"
                            onClick={handleEdit}
                            className="job-action-btn edit"
                        >
                            <Pencil size={14} />
                        </button>
                        <button
                            aria-label={`Delete ${job.role} at ${job.company}`}
                            title="Delete Application"
                            onClick={handleDelete}
                            className="job-action-btn delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                <p style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '500', marginBottom: job.location ? '4px' : '0' }}>{job.company}</p>
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '16px' }}>
                <span
                    title={jobDate.toLocaleString()}
                    style={{ background: 'var(--glass-highlight)', padding: '4px 8px', borderRadius: '6px' }}
                >
                    {formatDistanceToNow(jobDate, { addSuffix: true })}
                </span>
                {sanitizedUrl && (
                    <a
                        aria-label={`Source for ${job.role} at ${job.company}`}
                        title="View Job Source"
                        href={sanitizedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onPointerDown={e => e.stopPropagation()}
                        className="job-source-link"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', transition: 'background 0.2s' }}
                    >
                        Source <ExternalLink size={12} />
                    </a>
                )}
            </div>

            {/* Ghosting Radar Chip & AI Coach Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }} onPointerDown={e => e.stopPropagation()}>
                <span
                    title={`Application status age: ${daysSince} days`}
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

            {job.notes && <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--glass-panel)', padding: '8px 12px', borderRadius: '8px', lineHeight: '1.4' }}>{job.notes}</div>}

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
        </div>
    );
});

export default JobCard;
