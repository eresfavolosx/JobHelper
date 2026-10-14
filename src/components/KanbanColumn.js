"use client";
import React, { memo, useMemo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Ghost } from 'lucide-react';
import JobCard from './JobCard';

function ColumnDroppable({ id, children, isEmpty }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            style={{
                minHeight: '100%',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative'
            }}
        >
            {isEmpty ? (
                <div
                    style={{
                        flex: 1,
                        minHeight: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isOver
                            ? '2px dashed var(--accent-primary)'
                            : '2px dashed var(--glass-border)',
                        background: isOver
                            ? 'rgba(94, 135, 110, 0.12)'
                            : 'transparent',
                        borderRadius: '12px',
                        color: isOver ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        gap: '8px',
                        opacity: isOver ? 1 : 0.6,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                    }}
                >
                    <Ghost size={28} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                        {isOver ? 'Drop here' : 'Empty'}
                    </span>
                </div>
            ) : (
                children
            )}
        </div>
    );
}

// Custom comparison for memo to prevent re-renders when parent creates new array ref
// but jobs inside are same objects (common in this app's store updates)
const arePropsEqual = (prevProps, nextProps) => {
    if (prevProps.column !== nextProps.column) return false;
    if (prevProps.index !== nextProps.index) return false;
    if (prevProps.jobs === nextProps.jobs) return true;
    if (!prevProps.jobs || !nextProps.jobs) return false;
    if (prevProps.jobs.length !== nextProps.jobs.length) return false;

    for (let i = 0; i < prevProps.jobs.length; i++) {
        if (prevProps.jobs[i] !== nextProps.jobs[i]) return false;
    }

    return true;
};

const KanbanColumn = memo(({ column, jobs, index }) => {
    // ⚡ Bolt: Memoize SortableContext items array
    // Prevents creating a new array reference on every render, avoiding unnecessary
    // recalculations and UI jank in dnd-kit during drag operations.
    const itemIds = useMemo(() => jobs?.map(j => j.id) || [], [jobs]);

    return (
        <div
            id={column.id}
            className="glass-panel kanban-column animate-scale-in"
            style={{
                animationDelay: `${index * 100}ms`
            }}
        >
            <div className="kanban-column-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>{column.title}</h2>
                    <span style={{
                        fontSize: '0.78rem',
                        background: 'var(--glass-highlight)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--text-secondary)',
                        fontWeight: 600
                    }}>
                        {jobs.length}
                    </span>
                </div>
            </div>

            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div className="kanban-cards-list">
                    <ColumnDroppable id={column.id} isEmpty={jobs.length === 0}>
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
