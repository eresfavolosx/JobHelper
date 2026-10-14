"use client";
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { X, MapPin, Navigation, ExternalLink, Loader } from 'lucide-react';
import { getMapsSearchUrl, calculateCommute } from '@/lib/maps-service';
import UpgradeModal from './UpgradeModal';

export default function AddJobModal({ isOpen, onClose, initialData = {} }) {
    const addJob = useAppStore((state) => state.addJob);
    const updateJob = useAppStore((state) => state.updateJob);
    const profile = useAppStore((state) => state.profile);

    const [formData, setFormData] = useState({
        company: '',
        role: '',
        salary: '',
        url: '',
        location: '',
        commuteTime: '',
        notes: '',
        status: 'wishlist'
    });
    const [calculatingCommute, setCalculatingCommute] = useState(false);
    const [commuteMessage, setCommuteMessage] = useState({ type: '', text: '' });
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
        if (isOpen && initialData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData(prev => ({
                company: '',
                role: '',
                salary: '',
                url: '',
                location: '',
                commuteTime: '',
                notes: '',
                status: 'wishlist',
                ...prev,
                ...initialData
            }));
            setCommuteMessage({ type: '', text: '' });
        } else if (!isOpen) {
            setFormData({
                company: '',
                role: '',
                salary: '',
                url: '',
                location: '',
                commuteTime: '',
                notes: '',
                status: 'wishlist'
            });
            setCommuteMessage({ type: '', text: '' });
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

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

        if (!profile?.googleMapsApiKey) {
            setCommuteMessage({
                type: 'error',
                text: 'Add your Google Maps API Key in Profile (covered 100% by your GCP credits).'
            });
            return;
        }

        setCalculatingCommute(true);
        setCommuteMessage({ type: '', text: '' });

        const result = await calculateCommute(origin, destination, profile.googleMapsApiKey);
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
            if (initialData && initialData.id) {
                // Edit Mode
                updateJob(initialData.id, formData);
            } else {
                // Create Mode
                addJob(formData);
            }

            onClose();
            setFormData({
                company: '',
                role: '',
                url: '',
                salary: '',
                location: '',
                commuteTime: '',
                notes: '',
                status: 'wishlist'
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

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <div
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label htmlFor="job-salary" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Salary</label>
                            <input
                                id="job-salary"
                                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                                value={formData.salary || ''}
                                onChange={e => setFormData({ ...formData, salary: e.target.value })}
                                placeholder="e.g. $120k"
                            />
                        </div>

                        <div>
                            <label htmlFor="job-status" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Status</label>
                            <select
                                id="job-status"
                                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="wishlist">Bookmarked (Wishlist)</option>
                                <option value="applied">Applied</option>
                                <option value="interviewing">Interviewing</option>
                                <option value="offer">Offer</option>
                                <option value="accepted">Accepted Offer</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="job-url" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Job URL</label>
                        <input
                            id="job-url"
                            type="url"
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.url || ''}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>

                    <div>
                        <label htmlFor="job-notes" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Notes</label>
                        <textarea
                            id="job-notes"
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

                    <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
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
}
