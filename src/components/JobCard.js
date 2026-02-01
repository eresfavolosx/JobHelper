"use client";
import { formatDistanceToNow } from 'date-fns';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function JobCard({ job }) {
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

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, cursor: 'grab' }}
            {...attributes}
            {...listeners}
            className="card"
        >
            <div style={{ marginBottom: '8px' }}>
                <h4 style={{ fontWeight: 'bold' }}>{job.role}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{job.company}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>{new Date(job.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
    );
}
