"use client";
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Plus, X } from 'lucide-react';

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
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                        {(initialData && initialData.id) ? 'Edit Application' : 'Add Application'}
                    </h2>
                    <button onClick={onClose}><X size={24} color="var(--text-secondary)" /></button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Company</label>
                        <input
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.company}
                            onChange={e => setFormData({ ...formData, company: e.target.value })}
                            placeholder="e.g. Google"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Role</label>
                        <input
                            required
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            placeholder="e.g. Software Engineer"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Salary</label>
                        <input
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.salary}
                            onChange={e => setFormData({ ...formData, salary: e.target.value })}
                            placeholder="e.g. $120k"
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Job URL</label>
                        <input
                            type="url"
                            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
                            value={formData.url}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Status</label>
                        <select
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
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Notes</label>
                        <textarea
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
