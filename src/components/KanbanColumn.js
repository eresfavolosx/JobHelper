"use client";
import React, { memo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Ghost } from 'lucide-react';
import JobCard from './JobCard';

function ColumnDroppable({ id, children }) {
    const { setNodeRef } = useDroppable({ id });
    return <div ref={setNodeRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>;
}

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
                        {jobs.length === 0 && (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                padding: '24px',
                                border: '2px dashed var(--glass-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-secondary)',
                                opacity: 0.7,
                                minHeight: '150px',
                                pointerEvents: 'none'
                            }}>
                                <Ghost size={48} strokeWidth={1.5} style={{ opacity: 0.5 }} />
                                <p style={{ fontSize: '0.9rem', fontWeight: '500' }}>No jobs yet</p>
                            </div>
                        )}
                    </ColumnDroppable>
                </div>
            </SortableContext>
        </div>
    );
});

export default KanbanColumn;
