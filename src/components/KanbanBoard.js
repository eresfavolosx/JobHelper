"use client";
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { DndContext, DragOverlay, closestCorners, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, X,
    Clock, FileText, Sparkles, SlidersHorizontal, Columns3, Rows3,
    Archive, Building2, MapPin, DollarSign, ArrowUpDown, BarChart3
} from 'lucide-react';
import JobCard from './JobCard';
import KanbanColumn from './KanbanColumn';
import JobSettingsBanner from './JobSettingsBanner';
import CycleFilterBar from './CycleFilterBar';
import { filterJobsByCycle } from '@/lib/cycle-utils';
import { evaluateJobMatch, extractJobFacets, sortJobsList, STAGE_LABELS } from '@/lib/job-search';

const COLUMNS = [
    { id: 'wishlist', title: 'Wishlist', dot: '#9DA7AE' },
    { id: 'applied', title: 'Applied', dot: '#6B7E67' },
    { id: 'screening', title: 'Initial Screening', dot: '#0ea5e9' },
    { id: 'interviewing', title: 'Interviewing', dot: '#D4A373' },
    { id: 'offer', title: 'Offer', dot: '#10b981' },
    { id: 'accepted', title: 'Accepted', dot: '#22c55e' },
    { id: 'rejected', title: 'Rejected', dot: '#ef4444' },
    { id: 'archived', title: 'Archived', dot: '#94a3b8', isArchive: true },
    { id: 'deleted', title: 'Deleted', dot: '#ef4444', isTrash: true },
];

const COLUMN_IDS = new Set(COLUMNS.map(c => c.id));

const QUICK_FILTERS = [
    { id: 'all', label: 'All Cards' },
    { id: 'today', label: 'Logged Today', icon: Sparkles },
    { id: 'followup', label: 'Follow-Up (5+d)', icon: Clock },
    { id: 'has-salary', label: 'Has Salary', icon: DollarSign },
    { id: 'has-resume', label: 'Has Resume Link', icon: FileText },
    { id: 'missing-resume', label: 'Missing Resume', icon: FileText },
    { id: 'archived', label: 'Archived Only', icon: Archive }
];

export default function KanbanBoard() {
    const rawJobs = useAppStore(state => state.jobs);
    const cycles = useAppStore(state => state.cycles);
    const selectedCycleId = useAppStore(state => state.selectedCycleId);
    const moveJob = useAppStore(state => state.moveJob);

    const jobs = useMemo(() => {
        return filterJobsByCycle(rawJobs, cycles, selectedCycleId);
    }, [rawJobs, cycles, selectedCycleId]);

    // Cross-system shared search & filter state
    const searchQuery = useUIStore(state => state.boardSearchQuery);
    const companyFilter = useUIStore(state => state.boardCompanyFilter);
    const stageFilter = useUIStore(state => state.boardStageFilter);
    const locationFilter = useUIStore(state => state.boardLocationFilter);
    const quickFilter = useUIStore(state => state.boardQuickFilter);
    const sortBy = useUIStore(state => state.boardSortBy);
    const highlightedJobId = useUIStore(state => state.highlightedJobId);
    const setSearchQuery = useUIStore(state => state.setBoardSearchQuery);
    const setBoardFilters = useUIStore(state => state.setBoardFilters);
    const resetBoardFilters = useUIStore(state => state.resetBoardFilters);
    const setHighlightedJobId = useUIStore(state => state.setHighlightedJobId);

    const [mounted, setMounted] = useState(false);
    const [activeId, setActiveId] = useState(null);
    // Filters drawer hidden by default so all board sections are immediately visible, while the primary search input stays always visible
    const [filtersOpen, setFiltersOpen] = useState(false);
    // Board layout mode: 'stacked' (All Sections overview, default on mobile) or 'columns' (Horizontal Kanban, default on desktop)
    const [viewMode, setViewMode] = useState(() => (
        typeof window !== 'undefined' && window.innerWidth <= 768 ? 'stacked' : 'columns'
    ));
    // Track manually collapsed/expanded columns in 'stacked' (All Sections) view
    const [collapsedSections, setCollapsedSections] = useState({});
    const [nowMs] = useState(() => Date.now());
    const boardRef = useRef(null);
    const searchInputRef = useRef(null);
    const filtersDrawerRef = useRef(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Keyboard shortcut: press '/' to focus the always-visible board search input
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
            if (e.key === '/') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Synchronize hidden="until-found" native find-in-page reveal
    useEffect(() => {
        const el = filtersDrawerRef.current;
        if (!el) return;
        const handleBeforeMatch = () => {
            setFiltersOpen(true);
        };
        el.addEventListener('beforematch', handleBeforeMatch);
        return () => el.removeEventListener('beforematch', handleBeforeMatch);
    }, [mounted]);

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

    // Scroll to and pulse a highlighted job card selected from Global Search
    useEffect(() => {
        if (!mounted || !highlightedJobId) return;
        const targetJob = Array.isArray(jobs) ? jobs.find(j => j && j.id === highlightedJobId) : null;
        let expandTimer;
        if (targetJob?.status) {
            expandTimer = setTimeout(() => {
                setCollapsedSections(prev => (
                    prev[targetJob.status] ? { ...prev, [targetJob.status]: false } : prev
                ));
            }, 0);
        }
        const scrollTimer = setTimeout(() => {
            const el = document.getElementById(`job-card-${highlightedJobId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }, 80);
        const clearTimer = setTimeout(() => {
            setHighlightedJobId(null);
        }, 3500);

        return () => {
            if (expandTimer) clearTimeout(expandTimer);
            clearTimeout(scrollTimer);
            clearTimeout(clearTimer);
        };
    }, [mounted, highlightedJobId, jobs, setHighlightedJobId]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const facets = useMemo(() => extractJobFacets(jobs), [jobs]);

    const { columnsData, jobsMap, filteredCount, matchedJobs } = useMemo(() => {
        const data = {};
        const map = new Map();
        const matchedList = [];
        let matched = 0;

        COLUMNS.forEach(c => data[c.id] = []);

        if (Array.isArray(jobs)) {
            jobs.forEach(j => {
                if (!j) return;
                map.set(j.id, j);

                const result = evaluateJobMatch(j, {
                    query: searchQuery,
                    companyFilter,
                    stageFilter,
                    locationFilter,
                    quickFilter,
                    includeDeleted: true,
                    nowMs
                });

                if (!result.matches) return;

                if (data[j.status]) {
                    data[j.status].push(j);
                    if (j.status !== 'deleted') {
                        matched++;
                        matchedList.push(j);
                    }
                }
            });
        }

        if (sortBy && sortBy !== 'default') {
            COLUMNS.forEach(c => {
                data[c.id] = sortJobsList(data[c.id], sortBy);
            });
        }

        return { columnsData: data, jobsMap: map, filteredCount: matched, matchedJobs: matchedList };
    }, [jobs, searchQuery, companyFilter, stageFilter, locationFilter, quickFilter, sortBy, nowMs]);

    // Determine whether a section is collapsed in 'stacked' (All Sections) mode:
    // By default on load, all sections start expanded (not collapsed) so users can easily
    // view and move cards between any section immediately upon loading the board.
    const isSectionCollapsed = useCallback((columnId) => {
        if (viewMode !== 'stacked') return false;
        return Boolean(collapsedSections[columnId]);
    }, [viewMode, collapsedSections]);

    const toggleSectionCollapse = useCallback((columnId) => {
        setCollapsedSections(prev => ({
            ...prev,
            [columnId]: !prev[columnId]
        }));
    }, []);

    const expandAllSections = useCallback(() => {
        setCollapsedSections({});
    }, []);

    const collapseEmptySections = useCallback(() => {
        const next = {};
        COLUMNS.forEach(c => {
            next[c.id] = (columnsData[c.id]?.length || 0) === 0;
        });
        setCollapsedSections(next);
    }, [columnsData]);

    // Horizontal scroll arrow buttons
    const scrollBoard = useCallback((direction) => {
        if (!boardRef.current) return;
        const scrollDistance = 340;
        boardRef.current.scrollBy({
            left: direction === 'left' ? -scrollDistance : scrollDistance,
            behavior: 'smooth'
        });
    }, []);

    // Jump to specific column (and expand it if in All Sections stacked view)
    const scrollToColumn = useCallback((columnId) => {
        if (viewMode === 'stacked') {
            setCollapsedSections(prev => ({ ...prev, [columnId]: false }));
        }
        setTimeout(() => {
            const element = document.getElementById(columnId);
            if (element) {
                element.scrollIntoView({
                    behavior: 'smooth',
                    inline: viewMode === 'columns' ? 'center' : 'nearest',
                    block: 'nearest'
                });
            }
        }, 30);
    }, [viewMode]);

    // Intelligent mouse wheel handling for horizontal Columns mode
    const handleBoardWheel = useCallback((e) => {
        if (viewMode !== 'columns' || !boardRef.current) return;

        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

        const scrollableList = e.target.closest('.kanban-cards-list');
        if (scrollableList) {
            const hasMoreDown = e.deltaY > 0 && scrollableList.scrollTop + scrollableList.clientHeight < scrollableList.scrollHeight - 2;
            const hasMoreUp = e.deltaY < 0 && scrollableList.scrollTop > 2;
            if (hasMoreDown || hasMoreUp) {
                return;
            }
        }

        boardRef.current.scrollLeft += e.deltaY;
    }, [viewMode]);

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

    const activeFilterCount =
        (searchQuery.trim() ? 1 : 0) +
        (companyFilter !== 'all' ? 1 : 0) +
        (stageFilter !== 'all' ? 1 : 0) +
        (locationFilter !== 'all' ? 1 : 0) +
        (quickFilter !== 'all' ? 1 : 0) +
        (sortBy !== 'default' ? 1 : 0);

    const isFiltering = activeFilterCount > 0;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {/* Compact Top Control Bar: Always-Visible Search + Toggle Parameter Filters + View Switcher */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '10px',
                flexShrink: 0
            }}>
                {/* Search Cycles Selector */}
                <CycleFilterBar />

                {/* Row 1: Instant Board Search Input + Parameter Filters Toggle + View Switcher */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 320px' }}>
                        {/* Always-Visible Semantic <search> Bar on Board */}
                        <search style={{ flex: '1 1 220px', maxWidth: '420px', minWidth: '180px' }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <label htmlFor="kanban-board-search-input" className="sr-only">
                                    Search roles on board by company, title, location, salary, resume, or notes
                                </label>
                                <Search
                                    size={14}
                                    color="var(--text-secondary)"
                                    aria-hidden="true"
                                    style={{
                                        position: 'absolute',
                                        left: '11px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        pointerEvents: 'none'
                                    }}
                                />
                                <input
                                    ref={searchInputRef}
                                    id="kanban-board-search-input"
                                    name="board-search"
                                    type="search"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.nativeEvent?.isComposing || e.isComposing) return;
                                        if (e.key === 'Escape') {
                                            setSearchQuery('');
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    autocorrect="off"
                                    autocapitalize="off"
                                    spellCheck={false}
                                    placeholder="Search company, role, location, salary... (/)"
                                    style={{
                                        width: '100%',
                                        padding: '6px 30px 6px 32px',
                                        fontSize: '0.8rem',
                                        borderRadius: '999px',
                                        background: 'var(--bg-card)',
                                        border: searchQuery.trim()
                                            ? '1px solid var(--accent-primary)'
                                            : '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        aria-label="Clear board search"
                                        onClick={() => {
                                            setSearchQuery('');
                                            searchInputRef.current?.focus();
                                        }}
                                        style={{
                                            position: 'absolute',
                                            right: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            display: 'inline-flex'
                                        }}
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </search>

                        {/* Collapsible Parameter Filters & Goal Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(prev => !prev)}
                            aria-expanded={filtersOpen}
                            aria-controls="board-filters-drawer"
                            className="btn-secondary"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '999px',
                                fontSize: '0.77rem',
                                fontWeight: 700,
                                border: filtersOpen || isFiltering
                                    ? '1px solid var(--accent-primary)'
                                    : '1px solid var(--border-subtle)',
                                background: filtersOpen || isFiltering
                                    ? 'rgba(107, 126, 103, 0.18)'
                                    : 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <SlidersHorizontal size={13} color="var(--accent-primary)" />
                            <span>{filtersOpen ? 'Hide Filters' : 'Filters & Goal'}</span>
                            {activeFilterCount > 0 && (
                                <span style={{
                                    padding: '1px 6px',
                                    borderRadius: '999px',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    background: 'var(--accent-primary)',
                                    color: '#fff'
                                }}>
                                    {activeFilterCount}
                                </span>
                            )}
                            {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {/* Single entry point to the consolidated Insights hub */}
                        <Link
                            href="/insights"
                            className="btn-secondary"
                            title="Open Insights: pipeline flow, timeline, benchmarks & trends for the selected cycle"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '999px',
                                fontSize: '0.77rem',
                                fontWeight: 700,
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <BarChart3 size={13} color="var(--accent-primary)" />
                            <span>Insights</span>
                        </Link>
                    </div>

                    {/* Board View Switcher: All Sections (Stacked) vs Columns (Horizontal) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {viewMode === 'stacked' && (
                            <button
                                type="button"
                                onClick={() => {
                                    const anyCollapsed = COLUMNS.some(c => isSectionCollapsed(c.id));
                                    if (anyCollapsed) {
                                        expandAllSections();
                                    } else {
                                        collapseEmptySections();
                                    }
                                }}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '999px',
                                    fontSize: '0.73rem',
                                    fontWeight: 600,
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {COLUMNS.some(c => isSectionCollapsed(c.id)) ? 'Expand All' : 'Collapse Empty'}
                            </button>
                        )}

                        <div
                            role="group"
                            aria-label="Board layout view"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '999px',
                                padding: '2px'
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => setViewMode('stacked')}
                                aria-pressed={viewMode === 'stacked'}
                                title="See all board sections at once in a vertical overview"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    border: 'none',
                                    background: viewMode === 'stacked' ? 'var(--accent-primary)' : 'transparent',
                                    color: viewMode === 'stacked' ? '#ffffff' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Rows3 size={12} />
                                <span>All Sections</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('columns')}
                                aria-pressed={viewMode === 'columns'}
                                title="Side-by-side horizontal columns"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    border: 'none',
                                    background: viewMode === 'columns' ? 'var(--accent-primary)' : 'transparent',
                                    color: viewMode === 'columns' ? '#ffffff' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Columns3 size={12} />
                                <span>Columns</span>
                            </button>
                        </div>

                        {viewMode === 'columns' && (
                            <div className="desktop-only" style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button
                                    type="button"
                                    onClick={() => scrollBoard('left')}
                                    aria-label="Scroll board left"
                                    title="Scroll board left"
                                    style={{
                                        width: '28px',
                                        height: '28px',
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
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollBoard('right')}
                                    aria-label="Scroll board right"
                                    title="Scroll board right"
                                    style={{
                                        width: '28px',
                                        height: '28px',
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
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Active Search & Parameter Summary Chips (Visible whenever any filter is active) */}
                {isFiltering && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            padding: '2px 0'
                        }}
                    >
                        <span style={{
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            color: 'var(--accent-primary)',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: 'rgba(107, 126, 103, 0.14)'
                        }}>
                            {filteredCount} {filteredCount === 1 ? 'role' : 'roles'} matched
                        </span>

                        {companyFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setBoardFilters({ boardCompanyFilter: 'all' })}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--accent-primary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <Building2 size={11} color="var(--accent-primary)" />
                                <span>Company: {companyFilter}</span>
                                <X size={11} />
                            </button>
                        )}

                        {stageFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setBoardFilters({ boardStageFilter: 'all' })}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--accent-primary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>Stage: {STAGE_LABELS[stageFilter] || stageFilter}</span>
                                <X size={11} />
                            </button>
                        )}

                        {locationFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setBoardFilters({ boardLocationFilter: 'all' })}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--accent-primary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <MapPin size={11} color="var(--accent-primary)" />
                                <span>Location: {locationFilter}</span>
                                <X size={11} />
                            </button>
                        )}

                        {quickFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setBoardFilters({ boardQuickFilter: 'all' })}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--accent-primary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <span>Filter: {QUICK_FILTERS.find(f => f.id === quickFilter)?.label || quickFilter}</span>
                                <X size={11} />
                            </button>
                        )}

                        {sortBy !== 'default' && (
                            <button
                                type="button"
                                onClick={() => setBoardFilters({ boardSortBy: 'default' })}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--accent-primary)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <ArrowUpDown size={11} color="var(--accent-primary)" />
                                <span>Sorted: {sortBy}</span>
                                <X size={11} />
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={resetBoardFilters}
                            style={{
                                padding: '3px 9px',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                border: '1px solid rgba(200, 90, 62, 0.35)',
                                background: 'rgba(200, 90, 62, 0.12)',
                                color: 'var(--error)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Clear All
                        </button>
                    </div>
                )}

                {/* Collapsible Parameter Filters, Company Selector & Target Settings Drawer */}
                <div
                    id="board-filters-drawer"
                    ref={filtersDrawerRef}
                    hidden={!filtersOpen ? 'until-found' : undefined}
                    style={{
                        display: filtersOpen ? 'flex' : 'none',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '14px',
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                >
                    {/* Multi-Parameter Selectors Row: Company, Location/Modality, Stage, Sort */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
                        gap: '8px'
                    }}>
                        {/* Company Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label
                                htmlFor="board-company-filter"
                                style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Building2 size={12} color="var(--accent-primary)" />
                                Company
                            </label>
                            <select
                                id="board-company-filter"
                                value={companyFilter}
                                onChange={e => setBoardFilters({ boardCompanyFilter: e.target.value })}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '0.78rem',
                                    borderRadius: '8px',
                                    background: 'var(--bg-card)',
                                    border: companyFilter !== 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <option value="all">All Companies ({facets.companies.length})</option>
                                {facets.companies.map(c => (
                                    <option key={c.key} value={c.name}>
                                        {c.name} ({c.count})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Location / Modality Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label
                                htmlFor="board-location-filter"
                                style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <MapPin size={12} color="var(--accent-primary)" />
                                Location / Modality
                            </label>
                            <select
                                id="board-location-filter"
                                value={locationFilter}
                                onChange={e => setBoardFilters({ boardLocationFilter: e.target.value })}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '0.78rem',
                                    borderRadius: '8px',
                                    background: 'var(--bg-card)',
                                    border: locationFilter !== 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <option value="all">All Locations</option>
                                <option value="remote">Remote</option>
                                <option value="hybrid">Hybrid</option>
                                <option value="onsite">On-Site</option>
                                {facets.locations.length > 0 && (
                                    <optgroup label="Specific Locations">
                                        {facets.locations.slice(0, 15).map(l => (
                                            <option key={l.key} value={l.name}>
                                                {l.name} ({l.count})
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>

                        {/* Stage Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label
                                htmlFor="board-stage-filter"
                                style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Columns3 size={12} color="var(--accent-primary)" />
                                Stage
                            </label>
                            <select
                                id="board-stage-filter"
                                value={stageFilter}
                                onChange={e => setBoardFilters({ boardStageFilter: e.target.value })}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '0.78rem',
                                    borderRadius: '8px',
                                    background: 'var(--bg-card)',
                                    border: stageFilter !== 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <option value="all">All Stages</option>
                                {COLUMNS.map(col => (
                                    <option key={col.id} value={col.id}>
                                        {col.title} ({facets.stages[col.id] || 0})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Sort Order */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label
                                htmlFor="board-sort-select"
                                style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <ArrowUpDown size={12} color="var(--accent-primary)" />
                                Sort Cards By
                            </label>
                            <select
                                id="board-sort-select"
                                value={sortBy}
                                onChange={e => setBoardFilters({ boardSortBy: e.target.value })}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '0.78rem',
                                    borderRadius: '8px',
                                    background: 'var(--bg-card)',
                                    border: sortBy !== 'default' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <option value="default">Board Default</option>
                                <option value="updated">Recently Updated</option>
                                <option value="newest">Newest Added</option>
                                <option value="company-asc">Company (A–Z)</option>
                                <option value="role-asc">Role Title (A–Z)</option>
                            </select>
                        </div>
                    </div>

                    {/* Top Companies One-Tap Strip */}
                    {facets.companies.length > 0 && (
                        <div
                            className="hide-scrollbar"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                overflowX: 'auto',
                                paddingBottom: '2px'
                            }}
                        >
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                                Top Companies:
                            </span>
                            {facets.companies.slice(0, 12).map(comp => {
                                const active = companyFilter.toLowerCase() === comp.key;
                                return (
                                    <button
                                        key={comp.key}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => setBoardFilters({ boardCompanyFilter: active ? 'all' : comp.name })}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '999px',
                                            fontSize: '0.73rem',
                                            fontWeight: active ? 700 : 500,
                                            border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            background: active ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-card)',
                                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <span>{comp.name}</span>
                                        <span style={{ opacity: 0.75, fontSize: '0.68rem' }}>({comp.count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Quick Filters Strip */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px'
                        }}
                    >
                        {QUICK_FILTERS.map(f => {
                            const Icon = f.icon;
                            const active = quickFilter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setBoardFilters({ boardQuickFilter: active && f.id !== 'all' ? 'all' : f.id })}
                                    style={{
                                        padding: '5px 11px',
                                        borderRadius: '999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                        background: active ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-card)',
                                        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {Icon && <Icon size={12} color={active ? 'var(--accent-primary)' : 'var(--text-secondary)'} />}
                                    {f.label}
                                </button>
                            );
                        })}

                        {isFiltering && (
                            <button
                                type="button"
                                onClick={resetBoardFilters}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '999px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    border: '1px solid rgba(200, 90, 62, 0.35)',
                                    background: 'rgba(200, 90, 62, 0.12)',
                                    color: 'var(--error)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Reset ({filteredCount} shown)
                            </button>
                        )}
                    </div>

                    {/* Target Role, Modality, Level & Application Goal Banner inside the collapsible drawer */}
                    <JobSettingsBanner compact={true} showAddJobButton={false} />
                </div>

                {/* Stage Section Quick-Jump Strip (Single compact horizontal row for instant navigation between sections) */}
                <div
                    className="board-stage-pills hide-scrollbar"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'nowrap',
                        overflowX: 'auto',
                        gap: '6px',
                        paddingBottom: '2px'
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
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    fontSize: '0.75rem',
                                    border: count > 0 ? '1px solid rgba(107, 126, 103, 0.38)' : '1px solid var(--glass-border)',
                                    background: count > 0 ? 'rgba(107, 126, 103, 0.14)' : 'var(--glass-highlight)',
                                    color: col.isTrash
                                        ? 'var(--error)'
                                        : count > 0
                                            ? 'var(--text-primary)'
                                            : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    transition: 'all 0.2s',
                                    fontWeight: count > 0 ? 700 : 500
                                }}
                                title={`Jump to ${col.title} (${count})`}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: col.dot
                                    }}
                                />
                                <span>{col.title}</span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    opacity: 0.9,
                                    background: 'rgba(255,255,255,0.08)',
                                    padding: '0 5px',
                                    borderRadius: '999px'
                                }}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Kanban Board (Supports 'stacked' All-Sections View & 'columns' Horizontal View) */}
            <div
                ref={boardRef}
                onWheel={handleBoardWheel}
                className={`kanban-board ${viewMode === 'stacked' ? 'kanban-board-stacked' : 'kanban-board-columns'}`}
            >
                {COLUMNS.map((column, index) => (
                    <KanbanColumn
                        key={column.id}
                        column={column}
                        jobs={columnsData[column.id] || []}
                        index={index}
                        isStacked={viewMode === 'stacked'}
                        isCollapsed={isSectionCollapsed(column.id)}
                        onToggleCollapse={viewMode === 'stacked' ? toggleSectionCollapse : undefined}
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
