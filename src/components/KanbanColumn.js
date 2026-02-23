"use client";
import React, { memo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import JobCard from './JobCard';

function ColumnDroppable({ id, children }) {
    const { setNodeRef } = useDroppable({ id });
    return <div ref={setNodeRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>;
}

// Custom comparison for memo to prevent re-renders when parent creates new array ref
// but jobs inside are same objects (common in this app's store updates)
const arePropsEqual = (prevProps, nextProps) => {
    // Basic prop checks
    // Column object reference is stable (defined as constant outside component)
    if (prevProps.column !== nextProps.column) return false;
    if (prevProps.index !== nextProps.index) return false;

    // Array reference check (fast path)
    if (prevProps.jobs === nextProps.jobs) return true;

    // Safety check for jobs array
    if (!prevProps.jobs || !nextProps.jobs) return false;

    // Length check (fast path)
    if (prevProps.jobs.length !== nextProps.jobs.length) return false;

    // Shallow item comparison
    // Since store updates return same object reference for unchanged items,
    // we can just check reference equality for each item.
    for (let i = 0; i < prevProps.jobs.length; i++) {
        if (prevProps.jobs[i] !== nextProps.jobs[i]) return false;
    }

    return true;
};

const KanbanColumn = memo(({ column, jobs, index }) => {
    return (
        <div
            className="glass-panel kanban-column animate-scale-in"
            style={{
                padding: '20px',
                animationDelay: `${index * 100}ms`
            }}
        >
            <h3 style={{ marginBottom: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                {column.title}
                <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>{jobs.length}</span>
            </h3>

            <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100px' }} id={column.id}>
                    <ColumnDroppable id={column.id}>
                        {jobs.map(job => (
                            <JobCard key={job.id} job={job} />
                        ))}
                    </ColumnDroppable>
                </div>
            </SortableContext>
        </div>
    );
}, arePropsEqual);

KanbanColumn.displayName = 'KanbanColumn';

export default KanbanColumn;
