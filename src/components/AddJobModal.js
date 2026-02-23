"use client";
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { X } from 'lucide-react';

export default function AddJobModal({ isOpen, onClose, initialData = {} }) {
    const addJob = useAppStore((state) => state.addJob);
    const updateJob = useAppStore((state) => state.updateJob);

    const [formData, setFormData] = useState({
        company: '',
        role: '',
        salary: '',
        url: '',
        notes: '',
        status: 'wishlist'
    });

    useEffect(() => {
        if (isOpen && initialData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData(prev => ({
                ...prev,
                // If it's a new scrape (no ID), creating new. If it's from board (has ID), editing.
                ...initialData
            }));
        } else if (!isOpen) {
            // Reset
            setFormData({ company: '', role: '', salary: '', url: '', notes: '', status: 'wishlist' });
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        if (initialData && initialData.id) {
            // Edit Mode
            updateJob(initialData.id, formData);
        } else {
            // Create Mode
            addJob(formData);
        }

        onClose();
        // Don't clear form immediately if we want to preserve animations, but whatever
        setFormData({ company: '', role: '', url: '', salary: '', notes: '', status: 'wishlist' });
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            style={{
                position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <div
                className="card animate-scale-in"
                style={{
                    width: '500px',
                    maxWidth: '90%',
                    background: 'rgba(20, 20, 30, 0.95)', // Much more opaque
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
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
                        aria-label="Close modal"
                        style={{
                            width: '36px',
                            height: '36px',
                            minWidth: '36px',
                            minHeight: '36px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.05)',
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

                    <div>
                        <label htmlFor="job-salary" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Salary</label>
                        <input
                            id="job-salary"
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.salary}
                            onChange={e => setFormData({ ...formData, salary: e.target.value })}
                            placeholder="e.g. $120k"
                        />
                    </div>

                    <div>
                        <label htmlFor="job-url" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Job URL</label>
                        <input
                            id="job-url"
                            type="url"
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.url}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                            placeholder="https://..."
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
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="job-notes" style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Notes</label>
                        <textarea
                            id="job-notes"
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)', height: '100px' }}
                            value={formData.notes || ''}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Interviewer name, feedback, etc."
                        />
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
                        {(initialData && initialData.id) ? 'Save Changes' : 'Add Application'}
                    </button>
                </form>
            </div>
        </div>
    );
}
