"use client";
import { useAppStore } from '@/lib/store';
import { DndContext, DragOverlay, closestCorners, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const COLUMN_IDS = new Set(COLUMNS.map(c => c.id));

export default function KanbanBoard() {
    const jobs = useAppStore(state => state.jobs);
    const moveJob = useAppStore(state => state.moveJob);

    const [mounted, setMounted] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const boardRef = useRef(null);

    useEffect(() => {
        // eslint-disable-next-line
        setMounted(true);
    }, []);

    // Scroll to column based on URL hash
    useEffect(() => {
        if (mounted && typeof window !== 'undefined') {
            const hash = window.location.hash.replace('#', '');
            if (hash) {
                setTimeout(() => {
                    const element = document.getElementById(hash);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }
                }, 100);
            }
        }
    }, [mounted]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    // Horizontal scroll arrow buttons
    const scrollBoard = useCallback((direction) => {
        if (!boardRef.current) return;
        const scrollDistance = 340;
        boardRef.current.scrollBy({
            left: direction === 'left' ? -scrollDistance : scrollDistance,
            behavior: 'smooth'
        });
    }, []);

    // Jump to specific column
    const scrollToColumn = useCallback((columnId) => {
        const element = document.getElementById(columnId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, []);

    // Intelligent mouse wheel handling:
    // If scrolling vertically and the mouse is not inside an overflowing card list,
    // translate vertical mouse wheel into horizontal board panning.
    const handleBoardWheel = useCallback((e) => {
        if (!boardRef.current) return;

        // If native horizontal scroll is occurring (trackpad swipe or shift+wheel), let browser handle it
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

        // Check if cursor is over a vertically scrollable card list with remaining scroll room
        const scrollableList = e.target.closest('.kanban-cards-list');
        if (scrollableList) {
            const hasMoreDown = e.deltaY > 0 && scrollableList.scrollTop + scrollableList.clientHeight < scrollableList.scrollHeight - 2;
            const hasMoreUp = e.deltaY < 0 && scrollableList.scrollTop > 2;
            if (hasMoreDown || hasMoreUp) {
                // Let the column scroll vertically!
                return;
            }
        }

        // Pan board horizontally
        boardRef.current.scrollLeft += e.deltaY;
    }, []);

    if (!mounted) return null;

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeJob = jobsMap.get(active.id);
        if (!activeJob) return;

        const overId = over.id;
        let newStatus = overId;

        const overJob = jobsMap.get(overId);
        if (overJob) {
            newStatus = overJob.status;
        }

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
            {/* Horizontal Stage Pills & Pan Controls */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '12px',
                flexShrink: 0
            }}>
                <div
                    className="hide-scrollbar"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflowX: 'auto',
                        paddingBottom: '2px',
                        flex: 1
                    }}
                >
                    {COLUMNS.map(col => {
                        const count = columnsData[col.id]?.length || 0;
                        return (
                            <button
                                key={col.id}
                                type="button"
                                onClick={() => scrollToColumn(col.id)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '16px',
                                    fontSize: '0.8rem',
                                    border: '1px solid var(--glass-border)',
                                    background: 'var(--glass-highlight)',
                                    color: col.isTrash ? 'var(--error)' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s',
                                    fontWeight: 500
                                }}
                                className="hover:border-white/30 hover:text-white"
                                title={`Jump to ${col.title}`}
                            >
                                <span>{col.title}</span>
                                <span style={{
                                    fontSize: '0.72rem',
                                    opacity: 0.85,
                                    background: 'rgba(255,255,255,0.08)',
                                    padding: '1px 6px',
                                    borderRadius: '10px'
                                }}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Arrow Navigation */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                        type="button"
                        onClick={() => scrollBoard('left')}
                        aria-label="Scroll board left"
                        title="Scroll board left"
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'var(--glass-highlight)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => scrollBoard('right')}
                        aria-label="Scroll board right"
                        title="Scroll board right"
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'var(--glass-highlight)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Main Horizontal Scrollable Kanban Board */}
            <div
                ref={boardRef}
                onWheel={handleBoardWheel}
                className="kanban-board"
            >
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
                    <div style={{ transform: 'rotate(3deg)' }}>
                        <JobCard job={jobsMap.get(activeId)} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
