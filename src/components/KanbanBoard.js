"use client";
import { useAppStore } from '@/lib/store';
import { DndContext, DragOverlay, closestCorners, MouseSensor, TouchSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState, useEffect, memo, useMemo } from 'react';
import JobCard from './JobCard';

const COLUMNS = [
    { id: 'wishlist', title: 'Wishlist' },
    { id: 'applied', title: 'Applied' },
    { id: 'interviewing', title: 'Interviewing' },
    { id: 'offer', title: 'Offer' },
    { id: 'rejected', title: 'Rejected' },
    { id: 'deleted', title: 'Deleted', isTrash: true },
];

// Helper for dropping into empty columns
function ColumnDroppable({ id, children }) {
    const { setNodeRef } = useDroppable({ id });
    return <div ref={setNodeRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>;
}

const KanbanColumn = memo(({ column, jobs, index }) => {
    const columnJobs = useMemo(() => jobs.filter(j => j.status === column.id), [jobs, column.id]);
    const columnJobIds = useMemo(() => columnJobs.map(j => j.id), [columnJobs]);

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
                <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>{columnJobs.length}</span>
            </h3>

            <SortableContext items={columnJobIds} strategy={verticalListSortingStrategy}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100px' }} id={column.id}>
                    <ColumnDroppable id={column.id}>
                        {columnJobs.map(job => (
                            <JobCard key={job.id} job={job} />
                        ))}
                    </ColumnDroppable>
                </div>
            </SortableContext>
        </div>
    );
});

KanbanColumn.displayName = 'KanbanColumn';

export default function KanbanBoard() {
    const { jobs, moveJob } = useAppStore();
    const [mounted, setMounted] = useState(false);
    const [activeId, setActiveId] = useState(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Scroll to column based on URL hash
    useEffect(() => {
        if (mounted && typeof window !== 'undefined') {
            const hash = window.location.hash.replace('#', '');
            if (hash) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    const element = document.getElementById(hash);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        }
    }, [mounted]);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 5, // Lowered to 5px for snappier feel
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250, // Increased to 250ms to distinguish from scroll
                tolerance: 5, // Reduced tolerance to avoid accidental drags
            },
        })
    );

    if (!mounted) return null;

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeJob = jobs.find(j => j.id === active.id);
        const overId = over.id;

        // Check if dropped over a column container or a card
        let newStatus = overId;

        // If overId is a job ID (not a column ID), find that job's status
        const overJob = jobs.find(j => j.id === overId);
        if (overJob) {
            newStatus = overJob.status;
        }

        if (activeJob.status !== newStatus && COLUMNS.some(c => c.id === newStatus)) {
            moveJob(activeJob.id, newStatus);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="kanban-board">
                {COLUMNS.map((column, index) => (
                    <KanbanColumn
                        key={column.id}
                        column={column}
                        jobs={jobs}
                        index={index}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeId ? (
                    <div style={{ transform: 'rotate(3deg)' }}> {/* Tilt effect */}
                        <JobCard job={jobs.find(j => j.id === activeId)} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
