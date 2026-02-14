"use client";
import { formatDistanceToNow } from 'date-fns';
import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Trash2, Pencil, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { safeDate } from '@/lib/utils';

const JobCard = memo(function JobCard({ job }) {
    const deleteJob = useAppStore(s => s.deleteJob);
    const openEditJobModal = useUIStore(s => s.openEditJobModal);

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
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

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, cursor: 'grab', touchAction: 'none' }}
            {...attributes}
            {...listeners}
            className="card interactive-card group"
        >
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontWeight: '600', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{job.role}</h4>
                    <div style={{ display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.2s' }} className="group-hover:opacity-100" onPointerDown={e => e.stopPropagation()}>
                        <button onClick={handleEdit} style={{ padding: '6px', color: 'var(--text-secondary)', cursor: 'pointer', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', backdropFilter: 'blur(4px)' }}><Pencil size={14} /></button>
                        <button onClick={handleDelete} style={{ padding: '6px', color: '#f87171', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '6px', backdropFilter: 'blur(4px)' }}><Trash2 size={14} /></button>
                    </div>
                </div>
                <p style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '500' }}>{job.company}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '16px' }}>
                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>{formatDistanceToNow(safeDate(job.createdAt || job.dateAdded), { addSuffix: true })}</span>
                {job.url && (
                    <a
                        href={job.url}
                        target="_blank"
                        onPointerDown={e => e.stopPropagation()}
                        className="hover:text-blue-400"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', transition: 'background 0.2s' }}
                    >
                        Source <ExternalLink size={12} />
                    </a>
                )}
            </div>
            {job.notes && <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', lineHeight: '1.4' }}>{job.notes}</div>}
        </div>
    );
});

export default JobCard;
