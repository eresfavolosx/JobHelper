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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{column.title}</h2>
                <span style={{ fontSize: '0.8rem', background: 'var(--glass-highlight)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>{jobs.length}</span>
            </div>

            <SortableContext items={jobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100px' }} id={column.id}>
                    <ColumnDroppable id={column.id}>
                        {jobs.length === 0 ? (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px dashed var(--glass-border)',
                                borderRadius: '12px',
                                color: 'var(--text-secondary)',
                                opacity: 0.5,
                                minHeight: '120px',
                                pointerEvents: 'none',
                                userSelect: 'none'
                            }}>
                                <Ghost size={24} style={{ marginBottom: '8px' }} />
                                <span style={{ fontSize: '0.9rem' }}>Empty</span>
                            </div>
                        ) : (
                            jobs.map(job => (
                                <JobCard key={job.id} job={job} />
                            ))
                        )}
                    </ColumnDroppable>
                </div>
            </SortableContext>
        </div>
    );
});

export default KanbanColumn;
