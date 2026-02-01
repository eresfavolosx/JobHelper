"use client";
import { useAppStore } from '@/lib/store';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState, useEffect } from 'react';
import JobCard from './JobCard';

const COLUMNS = [
    { id: 'wishlist', title: 'Wishlist' },
    { id: 'applied', title: 'Applied' },
    { id: 'interviewing', title: 'Interviewing' },
    { id: 'offer', title: 'Offer' },
    { id: 'rejected', title: 'Rejected' },
];

export default function KanbanBoard() {
    const { jobs, moveJob } = useAppStore();
    const [mounted, setMounted] = useState(false);
    const [activeId, setActiveId] = useState(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
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
            <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px', height: 'calc(100vh - 100px)' }}>
                {COLUMNS.map(column => {
                    const columnJobs = jobs.filter(j => j.status === column.id);

                    return (
                        <div key={column.id} style={{ minWidth: '300px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ marginBottom: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                {column.title}
                                <span style={{ fontSize: '0.8rem', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '10px' }}>{columnJobs.length}</span>
                            </h3>

                            <SortableContext items={columnJobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '100px' }} id={column.id}> {/* id matches status for drop target */}
                                    {/* Droppable area logic handled via SortableContext + DndContext detecting collision with this ID if empty, or items otherwise */}
                                    {/* Actually dnd-kit needs a UseDroppable for the Empty column case. 
                       Wait, SortableContext handles items. If list is empty, we need a Droppable on the column.
                       Or we can just rely on collision detection returning the column ID if we make the container droppable.
                   */}
                                    <ColumnDroppable id={column.id}>
                                        {columnJobs.map(job => (
                                            <JobCard key={job.id} job={job} />
                                        ))}
                                    </ColumnDroppable>
                                </div>
                            </SortableContext>
                        </div>
                    );
                })}
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

// Helper for dropping into empty columns
import { useDroppable } from '@dnd-kit/core';
function ColumnDroppable({ id, children }) {
    const { setNodeRef } = useDroppable({ id });
    return <div ref={setNodeRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>;
}
