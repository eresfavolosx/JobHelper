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
    { id: 'accepted', title: 'Accepted' },
    { id: 'rejected', title: 'Rejected' },
    { id: 'deleted', title: 'Deleted', isTrash: true },
];

// ⚡ Bolt: Extract constant IDs to a Set for O(1) lookups during drag operations,
// avoiding O(N) Array.some() overhead on every drag end.
const COLUMN_IDS = new Set(COLUMNS.map(c => c.id));

export default function KanbanBoard() {
    // ⚡ Bolt: Use specific selectors instead of destructuring the whole store to prevent
    // unnecessary re-renders when other state (like profile) changes
    const jobs = useAppStore(state => state.jobs);
    const moveJob = useAppStore(state => state.moveJob);

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

    // ⚡ Bolt: Generate a jobsMap for O(1) lookups during drag operations instead of O(N) Array.find
    const { columnsData, jobsMap } = useMemo(() => {
        const data = {};
        const map = new Map();

        COLUMNS.forEach(c => data[c.id] = []);

        jobs.forEach(j => {
            map.set(j.id, j);
            if (data[j.status]) {
                data[j.status].push(j);
            }
        });

        return { columnsData: data, jobsMap: map };
    }, [jobs]);

    if (!mounted) return null;

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        // ⚡ Bolt: O(1) map lookup instead of jobs.find()
        const activeJob = jobsMap.get(active.id);
        if (!activeJob) return;

        const overId = over.id;

        // Check if dropped over a column container or a card
        let newStatus = overId;

        // If overId is a job ID (not a column ID), find that job's status
        // ⚡ Bolt: O(1) map lookup instead of jobs.find()
        const overJob = jobsMap.get(overId);
        if (overJob) {
            newStatus = overJob.status;
        }

        // ⚡ Bolt: Use O(1) Set lookup instead of O(N) COLUMNS.some()
        if (activeJob.status !== newStatus && COLUMN_IDS.has(newStatus)) {
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
                        {/* ⚡ Bolt: O(1) map lookup instead of jobs.find() */}
                        <JobCard job={jobsMap.get(activeId)} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext >
    );
}
