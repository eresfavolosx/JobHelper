"use client";
import React, { memo, useMemo, useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Ghost, Archive, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useUIStore } from '@/lib/uiStore';
import {
    getVisibleColumnCount,
    LOAD_MORE_STEP,
    DEFERRED_CARD_THRESHOLD
} from '@/lib/kanban-utils';
import JobCard from './JobCard';

const COLUMN_ACCENTS = {
    wishlist: '#9DA7AE',
    applied: '#6B7E67',
    screening: '#0ea5e9',
    interviewing: '#D4A373',
    offer: '#10b981',
    accepted: '#22c55e',
    rejected: '#ef4444',
    archived: '#94a3b8',
    deleted: '#ef4444'
};

function ColumnDroppable({ id, children, isEmpty, isStacked }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            style={{
                minHeight: isStacked ? (isEmpty ? '48px' : 'auto') : '100%',
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
                        minHeight: isStacked ? '46px' : '200px',
                        padding: isStacked ? '10px 14px' : '16px',
                        display: 'flex',
                        flexDirection: isStacked ? 'row' : 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isOver
                            ? '2px dashed var(--accent-primary)'
                            : '1.5px dashed var(--glass-border)',
                        background: isOver
                            ? 'rgba(94, 135, 110, 0.12)'
                            : 'transparent',
                        borderRadius: '12px',
                        color: isOver ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        gap: '8px',
                        opacity: isOver ? 1 : 0.65,
                        pointerEvents: 'none',
                        userSelect: 'none',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                    }}
                >
                    <Ghost size={isStacked ? 16 : 28} />
                    <span style={{ fontSize: isStacked ? '0.8rem' : '0.88rem', fontWeight: 500 }}>
                        {isOver ? 'Drop card here' : 'No cards in this stage'}
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
    if (prevProps.isStacked !== nextProps.isStacked) return false;
    if (prevProps.isCollapsed !== nextProps.isCollapsed) return false;
    if (prevProps.onToggleCollapse !== nextProps.onToggleCollapse) return false;
    if (prevProps.isFiltering !== nextProps.isFiltering) return false;
    if (prevProps.highlightedJobId !== nextProps.highlightedJobId) return false;
    if (prevProps.hasAiKey !== nextProps.hasAiKey) return false;
    if (prevProps.resetKey !== nextProps.resetKey) return false;
    if (prevProps.jobs === nextProps.jobs) return true;
    if (!prevProps.jobs || !nextProps.jobs) return false;
    if (prevProps.jobs.length !== nextProps.jobs.length) return false;

    for (let i = 0; i < prevProps.jobs.length; i++) {
        if (prevProps.jobs[i] !== nextProps.jobs[i]) return false;
    }

    return true;
};

const KanbanColumn = memo(({
    column,
    jobs,
    isStacked = false,
    isCollapsed = false,
    onToggleCollapse,
    isFiltering = false,
    highlightedJobId = null,
    hasAiKey,
    resetKey = ''
}) => {
    const openNewJobModal = useUIStore(state => state.openNewJobModal);

    const scopeKey = `${column.id}:${isStacked ? 'stacked' : 'columns'}:${resetKey}`;
    const [batchState, setBatchState] = useState({ scope: scopeKey, extra: 0 });
    const extraCount = batchState.scope === scopeKey ? batchState.extra : 0;

    const highlightedIndex = useMemo(() => {
        if (!highlightedJobId || !Array.isArray(jobs)) return -1;
        return jobs.findIndex(j => j && j.id === highlightedJobId);
    }, [jobs, highlightedJobId]);

    const visibleCount = getVisibleColumnCount({
        total: jobs?.length || 0,
        isStacked,
        isFiltering,
        extraCount,
        highlightedIndex
    });

    const visibleJobs = useMemo(
        () => (Array.isArray(jobs) ? jobs.slice(0, visibleCount) : []),
        [jobs, visibleCount]
    );

    // ⚡ Bolt: Memoize SortableContext items array matching rendered DOM cards
    const itemIds = useMemo(() => visibleJobs.map(j => j.id), [visibleJobs]);
    const remainingCount = Math.max(0, (jobs?.length || 0) - visibleJobs.length);
    const dotColor = COLUMN_ACCENTS[column.id] || 'var(--accent-primary)';

    const paginationBar = remainingCount > 0 ? (
        <div
            className={isStacked ? undefined : 'kanban-column-footer'}
            onPointerDown={e => e.stopPropagation()}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
                paddingTop: isStacked ? '4px' : '10px',
                marginTop: isStacked ? 0 : '10px',
                borderTop: isStacked ? 'none' : '1px solid var(--border-subtle)',
                flexShrink: 0,
                flexWrap: 'wrap'
            }}
        >
            <button
                type="button"
                data-agent-action="column-load-more"
                data-agent-stage={column.id}
                onClick={() =>
                    setBatchState({
                        scope: scopeKey,
                        extra: extraCount + LOAD_MORE_STEP
                    })
                }
                style={{
                    flex: '1 1 auto',
                    padding: isStacked ? '8px 12px' : '6px 10px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: isStacked ? '0.78rem' : '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                }}
            >
                Load {Math.min(LOAD_MORE_STEP, remainingCount)} more ({remainingCount} left)
            </button>
            <button
                type="button"
                data-agent-action="column-show-all"
                data-agent-stage={column.id}
                onClick={() =>
                    setBatchState({
                        scope: scopeKey,
                        extra: jobs.length
                    })
                }
                style={{
                    padding: isStacked ? '8px 10px' : '6px 9px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: 'var(--accent-primary)',
                    fontSize: isStacked ? '0.76rem' : '0.73rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                }}
            >
                Show all ({jobs.length})
            </button>
        </div>
    ) : null;

    return (
        <div
            id={column.id}
            data-agent-column={column.id}
            className={`kanban-column ${isStacked ? 'kanban-column-stacked' : ''} ${isCollapsed ? 'kanban-column-collapsed' : ''}`}
        >
            <div
                className="kanban-column-header"
                style={{
                    marginBottom: isCollapsed ? 0 : '12px',
                    cursor: onToggleCollapse ? 'pointer' : 'default'
                }}
                onClick={onToggleCollapse ? () => onToggleCollapse(column.id) : undefined}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                        aria-hidden="true"
                        style={{
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            background: dotColor,
                            flexShrink: 0,
                            boxShadow: `0 0 8px ${dotColor}66`
                        }}
                    />
                    {column.isArchive && <Archive size={15} color={dotColor} style={{ flexShrink: 0 }} />}
                    {column.isTrash && <Trash2 size={15} color={dotColor} style={{ flexShrink: 0 }} />}
                    <h2 style={{ fontSize: isStacked ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>
                        {column.title}
                    </h2>
                    <span style={{
                        fontSize: '0.76rem',
                        background: jobs.length > 0 ? 'rgba(107, 126, 103, 0.18)' : 'var(--glass-highlight)',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        border: jobs.length > 0 ? '1px solid rgba(107, 126, 103, 0.36)' : '1px solid var(--glass-border)',
                        color: jobs.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: 700
                    }}>
                        {jobs.length}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!column.isArchive && !column.isTrash && (
                        <button
                            type="button"
                            data-agent-action="column-add-job"
                            data-agent-stage={column.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                openNewJobModal(column.id);
                            }}
                            aria-label={`Add application to ${column.title}`}
                            title={`Add application to ${column.title}`}
                            style={{
                                background: 'var(--glass-highlight)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '7px',
                                color: 'var(--text-secondary)',
                                width: '26px',
                                height: '26px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <Plus size={14} />
                        </button>
                    )}

                    {onToggleCollapse && (
                        <button
                            type="button"
                            data-agent-action="column-toggle-collapse"
                            data-agent-stage={column.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleCollapse(column.id);
                            }}
                            aria-expanded={!isCollapsed}
                            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${column.title} section`}
                            title={`${isCollapsed ? 'Expand' : 'Collapse'} ${column.title}`}
                            style={{
                                background: 'var(--glass-highlight)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                color: 'var(--text-secondary)',
                                width: '28px',
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        >
                            {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                        </button>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <>
                    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                        <div className="kanban-cards-list">
                            <ColumnDroppable id={column.id} isEmpty={jobs.length === 0} isStacked={isStacked}>
                                {visibleJobs.map((job, idx) => (
                                    <JobCard
                                        key={job.id}
                                        job={job}
                                        hasAiKey={hasAiKey}
                                        isDeferred={idx >= DEFERRED_CARD_THRESHOLD}
                                    />
                                ))}
                                {isStacked && paginationBar}
                            </ColumnDroppable>
                        </div>
                    </SortableContext>
                    {!isStacked && paginationBar}
                </>
            )}
        </div>
    );
}, arePropsEqual);

KanbanColumn.displayName = 'KanbanColumn';

export default KanbanColumn;
