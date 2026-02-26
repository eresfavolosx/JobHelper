"use client";
import { useAppStore } from '@/lib/store';
import { DndContext, DragOverlay, closestCorners, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, useEffect, useMemo, useRef } from 'react';
import JobCard from './JobCard';
import KanbanColumn from './KanbanColumn';

const COLUMNS = [
    { id: 'wishlist', title: 'Wishlist' },
    { id: 'applied', title: 'Applied' },
    { id: 'interviewing', title: 'Interviewing' },
    { id: 'offer', title: 'Offer' },
    { id: 'rejected', title: 'Rejected' },
    { id: 'deleted', title: 'Deleted', isTrash: true },
];

export default function KanbanBoard() {
    const { jobs, moveJob } = useAppStore();
    const [mounted, setMounted] = useState(false);
    const [activeId, setActiveId] = useState(null);

    useEffect(() => {
        // eslint-disable-next-line
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
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Optimization: Track previous column data to prevent unnecessary re-renders
    const prevColumnsDataRef = useRef({});

    const columnsData = useMemo(() => {
        const newData = {};
        COLUMNS.forEach(c => newData[c.id] = []);
        jobs.forEach(j => {
            if (newData[j.status]) {
                newData[j.status].push(j);
            }
        });

        const finalData = {};
        COLUMNS.forEach(c => {
            const colId = c.id;
            const newJobs = newData[colId];
            const oldJobs = prevColumnsDataRef.current[colId];

            // Reuse array reference if content is identical (shallow comparison of job objects)
            if (oldJobs && newJobs.length === oldJobs.length &&
                newJobs.every((job, i) => job === oldJobs[i])) {
                finalData[colId] = oldJobs;
            } else {
                finalData[colId] = newJobs;
            }
        });

        prevColumnsDataRef.current = finalData;
        return finalData;
    }, [jobs]);

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
                        jobs={columnsData[column.id] || []}
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
        </DndContext >
    );
}
