"use client";
import { formatDistanceToNow } from 'date-fns';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Trash2, Pencil, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';

export default function JobCard({ job }) {
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
            className="card group" // added group for hover effects
        >
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontWeight: 'bold' }}>{job.role}</h4>
                    <div style={{ display: 'flex', gap: '8px' }} onPointerDown={e => e.stopPropagation()}>
                        <button onClick={handleEdit} style={{ padding: '6px', color: '#888', cursor: 'pointer', background: 'none', border: 'none' }}><Pencil size={16} /></button>
                        <button onClick={handleDelete} style={{ padding: '6px', color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none' }}><Trash2 size={16} /></button>
                    </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{job.company}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                {job.url && (
                    <a
                        href={job.url}
                        target="_blank"
                        onPointerDown={e => e.stopPropagation()}
                        className="hover:text-blue-400"
                    >
                        <ExternalLink size={14} />
                    </a>
                )}
            </div>
            {job.notes && <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px' }}>{job.notes}</div>}
        </div>
    );
}
