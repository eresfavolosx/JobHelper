import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import JobCard from './JobCard';

function ColumnDroppable({ id, children }) {
    const { setNodeRef } = useDroppable({ id });
    return <div ref={setNodeRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>;
}

const KanbanColumn = memo(function KanbanColumn({ column, jobs, index }) {
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
});

export default KanbanColumn;
