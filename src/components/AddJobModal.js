"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/lib/store';
import { X, MapPin, Navigation, ExternalLink, Loader, FileText, ChevronDown, Send, Trash2, Clock, Plus } from 'lucide-react';
import { getMapsSearchUrl, calculateCommute } from '@/lib/maps-service';
import { sanitizeUrl } from '@/lib/utils';
import UpgradeModal from './UpgradeModal';

export default function AddJobModal({ isOpen, onClose, initialData = {} }) {
    if (!isOpen) return null;

    return (
        <AddJobModalDialog
            key={initialData?.id || initialData?.url || initialData?.role || 'new'}
            onClose={onClose}
            initialData={initialData}
        />
    );
}

function AddJobModalDialog({ onClose, initialData = {} }) {
    const addJob = useAppStore((state) => state.addJob);
    const updateJob = useAppStore((state) => state.updateJob);
    const logJobFollowUp = useAppStore((state) => state.logJobFollowUp);
    const deleteJobFollowUp = useAppStore((state) => state.deleteJobFollowUp);
    const profile = useAppStore((state) => state.profile);
    const jobs = useAppStore((state) => state.jobs);

    // Follow-ups state
    const [today] = useState(() => new Date());
    const [followUps, setFollowUps] = useState(() => initialData?.followUps || []);
    const [newFollowUpChannel, setNewFollowUpChannel] = useState('email');
    const [newFollowUpDate, setNewFollowUpDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [newFollowUpNote, setNewFollowUpNote] = useState('');

    const currentNoCommsDays = useMemo(() => {
        const latestFollowUp = followUps.length > 0 ? followUps[0].date : null;
        const refDate = initialData?.lastFollowUpAt || latestFollowUp || initialData?.lastInteraction || initialData?.updatedAt || initialData?.appliedAt || initialData?.createdAt;
        if (!refDate) return 0;
        const diff = today.getTime() - new Date(refDate).getTime();
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }, [followUps, initialData, today]);

    const handleQuickFollowUpToday = () => {
        const nowIso = new Date().toISOString();
        const newEntry = {
            id: `fu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: nowIso,
            channel: 'email',
            note: 'Followed up with recruiter / hiring team',
            createdAt: nowIso
        };
        const nextList = [newEntry, ...followUps];
        nextList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setFollowUps(nextList);
        if (initialData?.id) {
            logJobFollowUp(initialData.id, newEntry);
        }
    };

    const handleAddCustomFollowUp = () => {
        const targetDate = newFollowUpDate ? new Date(newFollowUpDate).toISOString() : new Date().toISOString();
        const newEntry = {
            id: `fu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: targetDate,
            channel: newFollowUpChannel,
            note: newFollowUpNote.trim() || 'Followed up with recruiter',
            createdAt: new Date().toISOString()
        };
        const nextList = [newEntry, ...followUps];
        nextList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setFollowUps(nextList);
        setNewFollowUpNote('');
        if (initialData?.id) {
            logJobFollowUp(initialData.id, newEntry);
        }
    };

    const handleDeleteFollowUp = (followUpId) => {
        const nextList = followUps.filter(f => f.id !== followUpId);
        setFollowUps(nextList);
        if (initialData?.id) {
            deleteJobFollowUp(initialData.id, followUpId);
        }
    };

    // Extract up to 4 recently used resume links/labels so the user can attach a resume in 1 click
    const recentResumes = useMemo(() => {
        if (!Array.isArray(jobs)) return [];
        const seen = new Set();
        const list = [];
        for (const j of jobs) {
            if (!j || j.status === 'deleted') continue;
            const rUrl = (j.resumeUrl || '').trim();
            const rName = (j.resumeName || '').trim();
            if (!rUrl && !rName) continue;
            const key = `${rUrl}|${rName}`.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            list.push({
                resumeUrl: rUrl,
                resumeName: rName || 'Saved Resume Link'
            });
            if (list.length >= 4) break;
        }
        return list;
    }, [jobs]);

    const [formData, setFormData] = useState(() => ({
        company: initialData?.company || '',
        role: initialData?.role || initialData?.title || '',
        salary: initialData?.salary || '',
        url: initialData?.url || initialData?.link || '',
        resumeUrl: initialData?.resumeUrl || '',
        resumeName: initialData?.resumeName || '',
        location: initialData?.location || '',
        commuteTime: initialData?.commuteTime || '',
        notes: initialData?.notes || '',
        status: initialData?.status || 'applied'
    }));
    const [calculatingCommute, setCalculatingCommute] = useState(false);
    const [commuteMessage, setCommuteMessage] = useState({ type: '', text: '' });
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const mouseDownTargetRef = useRef(null);

    const handleBackdropMouseDown = (e) => {
        mouseDownTargetRef.current = e.target;
    };

    const handleBackdropClick = (e) => {
        // Only trigger close if both mousedown AND click originated directly on the backdrop itself,
        // preventing accidental closes when users click and drag to select text inside input fields or textareas.
        if (mouseDownTargetRef.current === e.currentTarget && e.target === e.currentTarget) {
            onClose();
        }
        mouseDownTargetRef.current = null;
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    const handleCalculateCommute = async () => {
        const destination = formData.location || formData.company;
        const origin = profile?.location;

        if (!destination) {
            setCommuteMessage({ type: 'error', text: 'Please enter a location or company name first.' });
            return;
        }

        if (!origin) {
            setCommuteMessage({ type: 'error', text: 'Set your home location in Profile to calculate commute.' });
            return;
        }

        setCalculatingCommute(true);
        setCommuteMessage({ type: '', text: '' });

        const result = await calculateCommute(origin, destination, profile?.googleMapsApiKey);
        setCalculatingCommute(false);

        if (result.success) {
            const formatted = `${result.duration} (${result.distance})`;
            setFormData(prev => ({ ...prev, commuteTime: formatted }));
            setCommuteMessage({ type: 'success', text: `Calculated: ${formatted} from ${origin}` });
        } else {
            setCommuteMessage({ type: 'error', text: result.error || 'Could not calculate commute.' });
        }
    };



    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitError('');

        try {
            const payload = {
                ...formData,
                url: formData.url ? sanitizeUrl(formData.url) || formData.url.trim() : '',
                resumeUrl: formData.resumeUrl ? sanitizeUrl(formData.resumeUrl) || formData.resumeUrl.trim() : '',
                resumeName: (formData.resumeName || '').trim(),
                followUps,
                ...(followUps.length > 0 ? {
                    lastFollowUpAt: followUps[0].date,
                    lastInteraction: followUps[0].date
                } : {})
            };
            if (initialData && initialData.id) {
                // Edit Mode
                updateJob(initialData.id, payload);
            } else {
                // Create Mode
                addJob(payload);
            }

            onClose();
            setFormData({
                company: '',
                role: '',
                url: '',
                resumeUrl: '',
                resumeName: '',
                salary: '',
                location: '',
                commuteTime: '',
                notes: '',
                status: 'applied'
            });
        } catch (err) {
            if (err?.code === 'LIMIT_REACHED') {
                setSubmitError(err.message);
                setUpgradeModalOpen(true);
            } else {
                setSubmitError(err?.message || 'Failed to save job application.');
            }
        }
    };

    const mapsUrl = getMapsSearchUrl(formData.company, formData.location);
    const previewResumeUrl = sanitizeUrl(formData.resumeUrl);

    const modalContent = (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onMouseDown={handleBackdropMouseDown}
            onClick={handleBackdropClick}
            style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
                padding: '16px',
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <div
                data-agent-target="add-job-modal"
                onClick={(e) => e.stopPropagation()}
                className="card animate-scale-in"
                style={{
                    width: '540px',
                    maxWidth: '92%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    background: 'var(--bg-app)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid var(--glass-border)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                    <h2
                        id="modal-title"
                        style={{ fontSize: '1.4rem', fontWeight: '800', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                        {(initialData && initialData.id) ? 'Edit Application' : 'Add Application'}
                    </h2>
                    <button
                        type="button"
                        data-agent-action="close-job-modal"
                        onClick={onClose}
                        aria-label="Close modal (Esc)"
                        title="Close modal (Esc)"
                        style={{
                            width: '36px',
                            height: '36px',
                            minWidth: '36px',
                            minHeight: '36px',
                            borderRadius: '50%',
                            background: 'var(--glass-highlight)',
                            transition: 'background 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        className="hover:bg-white/10"
                    >
                        <X size={20} color="var(--text-secondary)" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label htmlFor="job-company" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Company <span style={{ color: 'var(--error)' }}>*</span>
                        </label>
                        <input
                            id="job-company"
                            name="company"
                            data-agent-input="job-company"
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.company}
                            onChange={e => setFormData({ ...formData, company: e.target.value })}
                            placeholder="e.g. Google"
                        />
                    </div>

                    <div>
                        <label htmlFor="job-role" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Role <span style={{ color: 'var(--error)' }}>*</span>
                        </label>
                        <input
                            id="job-role"
                            name="role"
                            data-agent-input="job-role"
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            placeholder="e.g. Software Engineer"
                        />
                    </div>

                    {/* Location & Google Maps Intelligence */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label htmlFor="job-location" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <MapPin size={15} color="var(--accent-primary)" /> Location / Office
                            </label>
                            {formData.company && (
                                <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                >
                                    View on Google Maps <ExternalLink size={12} />
                                </a>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                id="job-location"
                                name="location"
                                data-agent-input="job-location"
                                style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                                value={formData.location || ''}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                placeholder="e.g. Austin, TX or Remote"
                            />
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, location: 'Remote', commuteTime: 'Remote' }))}
                                style={{
                                    padding: '0 12px',
                                    fontSize: '0.8rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: formData.location === 'Remote' ? 'var(--accent-primary)' : 'var(--glass-highlight)',
                                    color: formData.location === 'Remote' ? '#fff' : 'var(--text-primary)',
                                    border: '1px solid var(--border-subtle)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Remote
                            </button>
                        </div>
                    </div>

                    {/* Commute Intelligence */}
                    {formData.location !== 'Remote' && (
                        <div style={{ background: 'var(--glass-panel)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Navigation size={14} color="var(--accent-primary)" /> Commute from {profile?.location || 'Home'}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCalculateCommute}
                                    disabled={calculatingCommute}
                                    style={{
                                        fontSize: '0.8rem',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        background: 'var(--accent-primary)',
                                        color: '#fff',
                                        border: 'none',
                                        cursor: calculatingCommute ? 'wait' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {calculatingCommute ? (
                                        <>
                                            <Loader size={12} className="animate-spin" /> Calculating...
                                        </>
                                    ) : (
                                        'Calculate with Google Maps'
                                    )}
                                </button>
                            </div>
                            {formData.commuteTime && (
                                <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--success)', fontWeight: '600' }}>
                                    🚗 {formData.commuteTime}
                                </p>
                            )}
                            {commuteMessage.text && (
                                <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: commuteMessage.type === 'error' ? 'var(--error)' : 'var(--success)' }}>
                                    {commuteMessage.text}
                                </p>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px' }}>
                        <div>
                            <label htmlFor="job-salary" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Salary</label>
                            <input
                                id="job-salary"
                                name="salary"
                                data-agent-input="job-salary"
                                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                                value={formData.salary || ''}
                                onChange={e => setFormData({ ...formData, salary: e.target.value })}
                                placeholder="e.g. $120k"
                            />
                        </div>

                        <div>
                            <label htmlFor="job-status" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Application Stage</label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    id="job-status"
                                    name="status"
                                    data-agent-input="job-status"
                                    style={{
                                        width: '100%',
                                        padding: '10px 34px 10px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-app)',
                                        color: 'var(--text-primary)',
                                        appearance: 'none',
                                        WebkitAppearance: 'none',
                                        MozAppearance: 'none',
                                        cursor: 'pointer'
                                    }}
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="wishlist">Bookmarked (Wishlist)</option>
                                    <option value="applied">Applied</option>
                                    <option value="screening">Initial Screening</option>
                                    <option value="interviewing">Interviewing</option>
                                    <option value="offer">Offer</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="archived">Archived</option>
                                </select>
                                <ChevronDown
                                    size={16}
                                    aria-hidden="true"
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-secondary)',
                                        pointerEvents: 'none'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="job-url" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Job Posting URL</label>
                        <input
                            id="job-url"
                            name="url"
                            type="url"
                            inputMode="url"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.url || ''}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>

                    {/* Dedicated Resume Used Section */}
                    <fieldset
                        style={{
                            margin: 0,
                            padding: '14px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--glass-panel)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <legend style={{ padding: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={15} color="var(--accent-primary)" /> Resume Used for This Application
                            </legend>
                            {previewResumeUrl && (
                                <a
                                    href={previewResumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                >
                                    Open Resume <ExternalLink size={12} />
                                </a>
                            )}
                        </div>

                        {recentResumes.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    Quick-fill recent:
                                </span>
                                {recentResumes.map((item, idx) => {
                                    const isSelected = formData.resumeUrl === item.resumeUrl && formData.resumeName === item.resumeName;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setFormData(prev => ({
                                                ...prev,
                                                resumeUrl: item.resumeUrl || prev.resumeUrl,
                                                resumeName: item.resumeName || prev.resumeName
                                            }))}
                                            style={{
                                                padding: '3px 9px',
                                                borderRadius: '999px',
                                                fontSize: '0.74rem',
                                                fontWeight: 600,
                                                border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                                background: isSelected ? 'rgba(107, 126, 103, 0.2)' : 'var(--bg-app)',
                                                color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                            title={item.resumeUrl || item.resumeName}
                                        >
                                            <FileText size={11} color="var(--accent-primary)" />
                                            {item.resumeName}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '10px' }}>
                            <div>
                                <label htmlFor="job-resume-url" style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                    Resume Link (Drive, Docs, Notion, PDF)
                                </label>
                                <input
                                    id="job-resume-url"
                                    name="resumeUrl"
                                    type="text"
                                    inputMode="url"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    style={{ width: '100%', padding: '9px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                                    value={formData.resumeUrl || ''}
                                    onChange={e => setFormData({ ...formData, resumeUrl: e.target.value })}
                                    placeholder="https://docs.google.com/..."
                                />
                            </div>
                            <div>
                                <label htmlFor="job-resume-name" style={{ display: 'block', marginBottom: '4px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                    Resume Version / Label (Optional)
                                </label>
                                <input
                                    id="job-resume-name"
                                    name="resumeName"
                                    type="text"
                                    style={{ width: '100%', padding: '9px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                                    value={formData.resumeName || ''}
                                    onChange={e => setFormData({ ...formData, resumeName: e.target.value })}
                                    placeholder="e.g. AI Engineer v3 (Tailored)"
                                />
                            </div>
                        </div>
                    </fieldset>

                    {/* Dedicated Outreach & Follow-Up Markers Section */}
                    <fieldset
                        style={{
                            margin: 0,
                            padding: '14px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            background: 'rgba(139, 92, 246, 0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <legend style={{ padding: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Send size={15} color="#8b5cf6" /> Outreach & Follow-Up Markers
                            </legend>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                Resets the no-communication / ghosting alert counter
                            </span>
                        </div>

                        {/* Current Status & 1-Click Today Action */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                                <Clock size={13} color="var(--accent-primary)" />
                                <span style={{ color: 'var(--text-secondary)' }}>Current Status:</span>
                                <strong style={{ color: currentNoCommsDays >= 10 ? '#ef4444' : currentNoCommsDays >= 5 ? '#f59e0b' : '#10b981' }}>
                                    {currentNoCommsDays === 0 ? 'Contacted Today (0d)' : `${currentNoCommsDays} days since last communication`}
                                </strong>
                            </div>

                            <button
                                type="button"
                                onClick={handleQuickFollowUpToday}
                                className="btn-secondary"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    color: '#8b5cf6',
                                    border: '1px solid rgba(139, 92, 246, 0.35)',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    cursor: 'pointer'
                                }}
                            >
                                <Send size={11} /> ⚡ Log Follow-Up (Today)
                            </button>
                        </div>

                        {/* Custom Follow-Up Entry Form */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <select
                                    value={newFollowUpChannel}
                                    onChange={e => setNewFollowUpChannel(e.target.value)}
                                    style={{
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-app)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.78rem'
                                    }}
                                >
                                    <option value="email">📧 Email Check-In</option>
                                    <option value="linkedin">💼 LinkedIn Message</option>
                                    <option value="phone">📞 Phone Call</option>
                                    <option value="message">💬 Text / ATS Message</option>
                                    <option value="in_person">🤝 In-Person / Meetup</option>
                                    <option value="other">📝 Other Outreach</option>
                                </select>

                                <input
                                    type="date"
                                    value={newFollowUpDate}
                                    onChange={e => setNewFollowUpDate(e.target.value)}
                                    style={{
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-app)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.78rem'
                                    }}
                                />

                                <input
                                    type="text"
                                    value={newFollowUpNote}
                                    onChange={e => setNewFollowUpNote(e.target.value)}
                                    placeholder="Outreach note (e.g. Inquired about timeline with recruiter)..."
                                    style={{
                                        flex: 1,
                                        minWidth: '180px',
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--bg-app)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.78rem'
                                    }}
                                />

                                <button
                                    type="button"
                                    onClick={handleAddCustomFollowUp}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '6px 11px',
                                        borderRadius: '6px',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        background: '#8b5cf6',
                                        color: '#ffffff',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={13} /> Add
                                </button>
                            </div>
                        </div>

                        {/* List of Past Follow-Up Markers */}
                        {followUps.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Follow-up history ({followUps.length}):
                                </span>
                                {followUps.map((item, idx) => (
                                    <div
                                        key={item.id || idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                            padding: '6px 10px',
                                            borderRadius: '6px',
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border-subtle)',
                                            fontSize: '0.76rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                            <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: 'rgba(139, 92, 246, 0.15)',
                                                color: '#8b5cf6',
                                                fontWeight: 700,
                                                fontSize: '0.68rem',
                                                textTransform: 'capitalize'
                                            }}>
                                                {item.channel || 'outreach'}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                                                {new Date(item.date).toLocaleDateString()}
                                            </span>
                                            <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {item.note || 'Follow-up sent'}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteFollowUp(item.id)}
                                            title="Delete this follow-up entry"
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                padding: '2px'
                                            }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </fieldset>

                    <div>
                        <label htmlFor="job-notes" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Notes</label>
                        <textarea
                            id="job-notes"
                            name="notes"
                            data-agent-input="job-notes"
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)', height: '90px' }}
                            value={formData.notes || ''}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Interviewer name, requirements, notes..."
                        />
                    </div>

                    {submitError && (
                        <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px' }}>
                            {submitError}
                        </div>
                    )}

                    <button
                        type="submit"
                        data-agent-action="submit-job-modal"
                        className="btn-primary"
                        style={{ marginTop: '10px' }}
                    >
                        {(initialData && initialData.id) ? 'Save Changes' : 'Add Application'}
                    </button>
                </form>
            </div>

            <UpgradeModal
                isOpen={upgradeModalOpen}
                onClose={() => setUpgradeModalOpen(false)}
                triggerReason="limit"
            />
        </div>
    );

    if (typeof document !== 'undefined' && document.body) {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
}
