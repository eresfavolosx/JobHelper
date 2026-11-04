"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
    Search, X, Building2, MapPin, DollarSign, FileText,
    ArrowUpRight, Pencil, ExternalLink, Filter, CornerDownLeft
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useUIStore } from '@/lib/uiStore';
import { evaluateJobMatch, extractJobFacets, STAGE_LABELS } from '@/lib/job-search';
import { sanitizeUrl } from '@/lib/utils';

const STAGE_OPTIONS = [
    { id: 'all', label: 'All Stages' },
    { id: 'wishlist', label: 'Wishlist', dot: '#9DA7AE' },
    { id: 'applied', label: 'Applied', dot: '#6B7E67' },
    { id: 'screening', label: 'Initial Screening', dot: '#0ea5e9' },
    { id: 'interviewing', label: 'Interviewing', dot: '#D4A373' },
    { id: 'offer', label: 'Offer', dot: '#10b981' },
    { id: 'accepted', label: 'Accepted', dot: '#22c55e' },
    { id: 'rejected', label: 'Rejected', dot: '#ef4444' },
    { id: 'archived', label: 'Archived', dot: '#94a3b8' }
];

const LOCATION_OPTIONS = [
    { id: 'all', label: 'Any Modality' },
    { id: 'remote', label: 'Remote' },
    { id: 'hybrid', label: 'Hybrid' },
    { id: 'onsite', label: 'On-Site' }
];

const SYNTAX_CHIPS = [
    { prefix: 'company:', label: 'company:' },
    { prefix: 'role:', label: 'role:' },
    { prefix: 'location:', label: 'location:' },
    { prefix: 'stage:', label: 'stage:' },
    { prefix: 'salary:', label: 'salary:' },
    { prefix: 'resume:', label: 'resume:' }
];

export default function GlobalJobSearchModal() {
    const jobs = useAppStore(state => state.jobs);
    const isGlobalSearchOpen = useUIStore(state => state.isGlobalSearchOpen);
    const globalSearchInitialQuery = useUIStore(state => state.globalSearchInitialQuery);
    const closeGlobalSearch = useUIStore(state => state.closeGlobalSearch);
    const openEditJobModal = useUIStore(state => state.openEditJobModal);
    const setBoardFilters = useUIStore(state => state.setBoardFilters);
    const setHighlightedJobId = useUIStore(state => state.setHighlightedJobId);

    const router = useRouter();
    const pathname = usePathname();

    const dialogRef = useRef(null);
    const inputRef = useRef(null);

    const [query, setQuery] = useState('');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [stageFilter, setStageFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('all');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [wasOpen, setWasOpen] = useState(false);

    if (isGlobalSearchOpen !== wasOpen) {
        setWasOpen(isGlobalSearchOpen);
        if (isGlobalSearchOpen) {
            setQuery(globalSearchInitialQuery || '');
            setSelectedIndex(0);
        }
    }

    // Manage native <dialog> showModal() / close() + Safari closedby fallback
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isGlobalSearchOpen) {
            if (!dialog.open) {
                try {
                    dialog.showModal();
                } catch {
                    // Fallback if already open
                }
            }
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 30);
            return () => clearTimeout(timer);
        } else if (dialog.open) {
            dialog.close();
        }
    }, [isGlobalSearchOpen]);

    // Native dialog close listener & mandatory fallback for browsers without <dialog closedby> support
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const handleClose = () => {
            closeGlobalSearch();
        };

        dialog.addEventListener('close', handleClose);

        let handleBackdropClick;
        if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
            handleBackdropClick = (event) => {
                if (event.target !== dialog) return;
                const rect = dialog.getBoundingClientRect();
                const isDialogContent = (
                    rect.top <= event.clientY &&
                    event.clientY <= rect.top + rect.height &&
                    rect.left <= event.clientX &&
                    event.clientX <= rect.left + rect.width
                );
                if (isDialogContent) return;
                dialog.close();
            };
            dialog.addEventListener('click', handleBackdropClick);
        }

        return () => {
            dialog.removeEventListener('close', handleClose);
            if (handleBackdropClick) {
                dialog.removeEventListener('click', handleBackdropClick);
            }
        };
    }, [closeGlobalSearch]);

    const facets = useMemo(() => extractJobFacets(jobs), [jobs]);

    const results = useMemo(() => {
        if (!Array.isArray(jobs)) return [];
        const matched = [];

        for (const job of jobs) {
            if (!job || job.status === 'deleted') continue;
            const evalResult = evaluateJobMatch(job, {
                query,
                companyFilter,
                stageFilter,
                locationFilter
            });
            if (evalResult.matches) {
                matched.push({
                    job,
                    score: evalResult.score,
                    matchedFields: evalResult.matchedFields
                });
            }
        }

        // Sort by match score desc, then most recently updated
        matched.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const aTime = new Date(a.job.updatedAt || a.job.appliedAt || a.job.createdAt || a.job.dateAdded || 0).getTime() || 0;
            const bTime = new Date(b.job.updatedAt || b.job.appliedAt || b.job.createdAt || b.job.dateAdded || 0).getTime() || 0;
            return bTime - aTime;
        });

        return matched;
    }, [jobs, query, companyFilter, stageFilter, locationFilter]);

    const safeSelectedIndex = results.length > 0
        ? Math.min(selectedIndex, results.length - 1)
        : 0;

    const handleViewOnBoard = useCallback((job) => {
        if (!job) return;
        setBoardFilters({
            boardSearchQuery: '',
            boardCompanyFilter: 'all',
            boardStageFilter: 'all',
            boardLocationFilter: 'all',
            boardQuickFilter: 'all'
        });
        setHighlightedJobId(job.id);
        closeGlobalSearch();

        if (pathname !== '/kanban') {
            router.push(`/kanban#${job.status || 'wishlist'}`);
        } else {
            const cardEl = document.getElementById(`job-card-${job.id}`) || document.getElementById(job.status);
            if (cardEl) {
                cardEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }
    }, [setBoardFilters, setHighlightedJobId, closeGlobalSearch, pathname, router]);

    const handleApplyFilterToBoard = useCallback(() => {
        setBoardFilters({
            boardSearchQuery: query,
            boardCompanyFilter: companyFilter,
            boardStageFilter: stageFilter,
            boardLocationFilter: locationFilter
        });
        closeGlobalSearch();
        if (pathname !== '/kanban') {
            router.push('/kanban');
        }
    }, [query, companyFilter, stageFilter, locationFilter, setBoardFilters, closeGlobalSearch, pathname, router]);

    const handleEditJob = useCallback((job, e) => {
        if (e) e.stopPropagation();
        closeGlobalSearch();
        openEditJobModal(job);
    }, [closeGlobalSearch, openEditJobModal]);

    const handleKeyDown = (e) => {
        if (e.nativeEvent?.isComposing || e.isComposing) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (results.length > 0) {
                setSelectedIndex(prev => (prev + 1) % results.length);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (results.length > 0) {
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
                handleApplyFilterToBoard();
            } else if (results[safeSelectedIndex]?.job) {
                handleViewOnBoard(results[safeSelectedIndex].job);
            } else if (query.trim() || companyFilter !== 'all' || stageFilter !== 'all' || locationFilter !== 'all') {
                handleApplyFilterToBoard();
            }
        }
    };

    const insertPrefix = (prefix) => {
        setQuery(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${prefix}` : prefix;
        });
        inputRef.current?.focus();
    };

    const hasActiveFilters = Boolean(
        query.trim() || companyFilter !== 'all' || stageFilter !== 'all' || locationFilter !== 'all'
    );

    return (
        <dialog
            ref={dialogRef}
            {...({ closedby: 'any' })}
            aria-labelledby="global-search-title"
            className="global-search-dialog"
            style={{
                width: 'min(94vw, 720px)',
                maxHeight: '86vh',
                margin: '6vh auto auto',
                padding: 0,
                border: '1px solid var(--border-subtle)',
                borderRadius: '18px',
                background: 'var(--bg-panel)',
                color: 'var(--text-primary)',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
                overflow: 'hidden'
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '86vh' }}>
                {/* Header & Semantic <search> Landmark */}
                <div style={{
                    padding: '16px 18px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '10px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Search size={16} color="var(--accent-primary)" aria-hidden="true" />
                            <h2 id="global-search-title" style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>
                                Find Roles Across System
                            </h2>
                            <span style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: 'rgba(107, 126, 103, 0.16)',
                                color: 'var(--accent-primary)',
                                fontWeight: 700
                            }}>
                                {results.length} {results.length === 1 ? 'role' : 'roles'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery('');
                                        setCompanyFilter('all');
                                        setStageFilter('all');
                                        setLocationFilter('all');
                                        inputRef.current?.focus();
                                    }}
                                    style={{
                                        padding: '4px 9px',
                                        borderRadius: '999px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        background: 'rgba(200, 90, 62, 0.12)',
                                        border: '1px solid rgba(200, 90, 62, 0.32)',
                                        color: 'var(--error)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Reset All
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={closeGlobalSearch}
                                aria-label="Close role search"
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    background: 'var(--glass-highlight)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    <search>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleApplyFilterToBoard();
                            }}
                        >
                            <label htmlFor="global-role-search-input" className="sr-only">
                                Search roles by company, title, location, stage, salary, resume, or notes
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Search
                                    size={17}
                                    color="var(--text-secondary)"
                                    aria-hidden="true"
                                    style={{
                                        position: 'absolute',
                                        left: '13px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        pointerEvents: 'none'
                                    }}
                                />
                                <input
                                    ref={inputRef}
                                    id="global-role-search-input"
                                    name="q"
                                    type="search"
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        setSelectedIndex(0);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    autocorrect="off"
                                    autocapitalize="off"
                                    spellCheck={false}
                                    placeholder="Search by company, role, location, salary, resume, or notes..."
                                    style={{
                                        width: '100%',
                                        padding: '11px 38px 11px 40px',
                                        fontSize: '0.95rem',
                                        borderRadius: '12px',
                                        background: 'var(--bg-panel)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                                {query && (
                                    <button
                                        type="button"
                                        aria-label="Clear search query"
                                        onClick={() => {
                                            setQuery('');
                                            inputRef.current?.focus();
                                        }}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            display: 'inline-flex'
                                        }}
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        </form>
                    </search>

                    {/* Quick Parameter Prefix Helpers */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        flexWrap: 'wrap',
                        marginTop: '8px'
                    }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Parameters:
                        </span>
                        {SYNTAX_CHIPS.map(chip => (
                            <button
                                key={chip.prefix}
                                type="button"
                                onClick={() => insertPrefix(chip.prefix)}
                                style={{
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    fontSize: '0.69rem',
                                    fontFamily: 'monospace',
                                    background: 'var(--glass-highlight)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                                title={`Filter specifically by ${chip.label.replace(':', '')}`}
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    {/* Interactive Parameter Filters: Company Dropdown + Modality + Stage Pills */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-subtle)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Company Selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 180px' }}>
                                <Building2 size={14} color="var(--accent-primary)" aria-hidden="true" />
                                <label htmlFor="global-search-company-select" className="sr-only">Filter by Company</label>
                                <select
                                    id="global-search-company-select"
                                    value={companyFilter}
                                    onChange={(e) => {
                                        setCompanyFilter(e.target.value);
                                        setSelectedIndex(0);
                                    }}
                                    style={{
                                        padding: '5px 10px',
                                        fontSize: '0.78rem',
                                        borderRadius: '8px',
                                        background: 'var(--bg-panel)',
                                        border: companyFilter !== 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)',
                                        fontWeight: companyFilter !== 'all' ? 700 : 500,
                                        width: '100%'
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

                            {/* Location / Modality Selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 150px' }}>
                                <MapPin size={14} color="var(--accent-primary)" aria-hidden="true" />
                                <label htmlFor="global-search-location-select" className="sr-only">Filter by Location or Modality</label>
                                <select
                                    id="global-search-location-select"
                                    value={locationFilter}
                                    onChange={(e) => {
                                        setLocationFilter(e.target.value);
                                        setSelectedIndex(0);
                                    }}
                                    style={{
                                        padding: '5px 10px',
                                        fontSize: '0.78rem',
                                        borderRadius: '8px',
                                        background: 'var(--bg-panel)',
                                        border: locationFilter !== 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)',
                                        fontWeight: locationFilter !== 'all' ? 700 : 500,
                                        width: '100%'
                                    }}
                                >
                                    {LOCATION_OPTIONS.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.label}</option>
                                    ))}
                                    {facets.locations.length > 0 && (
                                        <optgroup label="Saved Locations">
                                            {facets.locations.slice(0, 15).map(l => (
                                                <option key={l.key} value={l.name}>
                                                    {l.name} ({l.count})
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>

                        {/* Top Companies Quick-Filter Strip */}
                        {facets.companies.length > 0 && (
                            <div
                                className="hide-scrollbar"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    overflowX: 'auto',
                                    paddingBottom: '2px'
                                }}
                            >
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
                                    Companies:
                                </span>
                                {facets.companies.slice(0, 10).map(comp => {
                                    const active = companyFilter.toLowerCase() === comp.key;
                                    return (
                                        <button
                                            key={comp.key}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => {
                                                setCompanyFilter(active ? 'all' : comp.name);
                                                setSelectedIndex(0);
                                            }}
                                            style={{
                                                padding: '3px 9px',
                                                borderRadius: '999px',
                                                fontSize: '0.72rem',
                                                fontWeight: active ? 700 : 500,
                                                background: active ? 'rgba(107, 126, 103, 0.22)' : 'var(--bg-panel)',
                                                border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
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
                                            <span style={{ opacity: 0.75, fontSize: '0.67rem' }}>({comp.count})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Stage Filter Strip */}
                        <div
                            className="hide-scrollbar"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                overflowX: 'auto',
                                paddingBottom: '2px'
                            }}
                        >
                            {STAGE_OPTIONS.map(st => {
                                const active = stageFilter === st.id;
                                return (
                                    <button
                                        key={st.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => {
                                            setStageFilter(active && st.id !== 'all' ? 'all' : st.id);
                                            setSelectedIndex(0);
                                        }}
                                        style={{
                                            padding: '3px 9px',
                                            borderRadius: '999px',
                                            fontSize: '0.72rem',
                                            fontWeight: active ? 700 : 500,
                                            background: active ? 'rgba(107, 126, 103, 0.22)' : 'var(--bg-panel)',
                                            border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        {st.dot && (
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    width: '6px',
                                                    height: '6px',
                                                    borderRadius: '50%',
                                                    background: st.dot
                                                }}
                                            />
                                        )}
                                        <span>{st.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Results List */}
                <div
                    role="region"
                    aria-label="Matching roles"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '10px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                    }}
                >
                    {results.length === 0 ? (
                        <div style={{
                            padding: '36px 20px',
                            textAlign: 'center',
                            color: 'var(--text-secondary)'
                        }}>
                            <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                No matching roles found
                            </p>
                            <p style={{ fontSize: '0.8rem' }}>
                                Try searching by company name, role title, location, salary, or clearing active filters.
                            </p>
                        </div>
                    ) : (
                        results.slice(0, 50).map(({ job, matchedFields }, idx) => {
                            const isSelected = idx === safeSelectedIndex;
                            const stageLabel = STAGE_LABELS[job.status] || job.status || 'Wishlist';
                            const stageMeta = STAGE_OPTIONS.find(s => s.id === job.status);
                            const safeJobUrl = job.url ? sanitizeUrl(job.url) : '';

                            return (
                                <div
                                    key={job.id}
                                    onClick={() => handleViewOnBoard(job)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '12px',
                                        background: isSelected ? 'rgba(107, 126, 103, 0.16)' : 'var(--bg-card)',
                                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.12s ease, border-color 0.12s ease'
                                    }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '0.9rem',
                                                fontWeight: 700,
                                                color: 'var(--text-primary)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {job.role || 'Untitled Role'}
                                            </span>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                padding: '2px 8px',
                                                borderRadius: '999px',
                                                background: 'var(--bg-panel)',
                                                border: '1px solid var(--border-subtle)',
                                                color: 'var(--text-primary)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                            }}>
                                                <span
                                                    aria-hidden="true"
                                                    style={{
                                                        width: '6px',
                                                        height: '6px',
                                                        borderRadius: '50%',
                                                        background: stageMeta?.dot || '#9DA7AE'
                                                    }}
                                                />
                                                {stageLabel}
                                            </span>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            flexWrap: 'wrap',
                                            marginTop: '4px',
                                            fontSize: '0.78rem',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                fontWeight: 600,
                                                color: 'var(--accent-primary)'
                                            }}>
                                                <Building2 size={12} aria-hidden="true" />
                                                {job.company || 'Unknown Company'}
                                            </span>

                                            {job.location && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                    <MapPin size={12} aria-hidden="true" />
                                                    {job.location}
                                                </span>
                                            )}

                                            {job.salary && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--success)' }}>
                                                    <DollarSign size={12} aria-hidden="true" />
                                                    {job.salary}
                                                </span>
                                            )}

                                            {(job.resumeName || job.resumeUrl) && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                    <FileText size={12} aria-hidden="true" />
                                                    {job.resumeName || 'Resume linked'}
                                                </span>
                                            )}

                                            {matchedFields.length > 0 && (
                                                <span style={{
                                                    fontSize: '0.67rem',
                                                    padding: '1px 6px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(107, 126, 103, 0.14)',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    Matched: {matchedFields.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                        <button
                                            type="button"
                                            onClick={(e) => handleEditJob(job, e)}
                                            title="Edit role details"
                                            aria-label={`Edit ${job.role} at ${job.company}`}
                                            style={{
                                                padding: '6px 8px',
                                                borderRadius: '8px',
                                                background: 'var(--bg-panel)',
                                                border: '1px solid var(--border-subtle)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.73rem',
                                                fontWeight: 600,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Pencil size={12} />
                                            <span>Edit</span>
                                        </button>

                                        {safeJobUrl && (
                                            <a
                                                href={safeJobUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Open original job posting"
                                                aria-label={`Open job posting for ${job.role} at ${job.company}`}
                                                style={{
                                                    padding: '6px 8px',
                                                    borderRadius: '8px',
                                                    background: 'var(--bg-panel)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-secondary)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <ExternalLink size={12} />
                                            </a>
                                        )}

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewOnBoard(job);
                                            }}
                                            title="Locate role on Board"
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '8px',
                                                background: 'var(--accent-primary)',
                                                color: '#fff',
                                                fontSize: '0.73rem',
                                                fontWeight: 700,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <span>Board</span>
                                            <ArrowUpRight size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Modal Footer: Keyboard hints + Apply filter to Board */}
                <div style={{
                    padding: '10px 16px',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CornerDownLeft size={12} /> Jump to role
                        </span>
                        <span>↑↓ Navigate</span>
                        <span>Esc Close</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleApplyFilterToBoard}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'rgba(107, 126, 103, 0.18)',
                            border: '1px solid var(--accent-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        <Filter size={12} color="var(--accent-primary)" />
                        <span>Filter Board with Current Search</span>
                    </button>
                </div>
            </div>
        </dialog>
    );
}
