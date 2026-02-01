"use client";
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Plus, X } from 'lucide-react';

export default function AddJobModal({ isOpen, onClose }) {
    const { addJob } = useAppStore();
    const [formData, setFormData] = useState({
        company: '',
        role: '',
        url: '',
        salary: '',
        description: ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        addJob(formData);
        setFormData({ company: '', role: '', url: '', salary: '', description: '' });
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="card" style={{ width: '500px', maxWidth: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Add Application</h2>
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

                    <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>
                        Add Application
                    </button>
                </form>
            </div>
        </div>
    );
}
