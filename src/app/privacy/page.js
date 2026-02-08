"use client";
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Trash2, Mail } from 'lucide-react';

export default function PrivacyPage() {
    const lastUpdated = "February 8, 2026";

    return (
        <div className="container" style={{ maxWidth: '800px', marginTop: '40px', marginLeft: 'auto', marginRight: 'auto', width: '100%', paddingBottom: '60px' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '24px', textDecoration: 'none' }}>
                <ArrowLeft size={18} /> Back to Dashboard
            </Link>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Shield size={32} color="var(--accent-primary)" />
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>Privacy Policy</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Last updated: {lastUpdated}</p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Lock size={20} color="var(--accent-primary)" /> Data We Collect
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '16px' }}>
                    JobTracker collects minimal data to provide our service:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px' }}>
                    <li><strong>Google Account Info:</strong> Email and display name for authentication</li>
                    <li><strong>Job Applications:</strong> Company, role, salary, and notes you add</li>
                    <li><strong>Profile Data:</strong> Optional career preferences you provide</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Shield size={20} color="var(--success)" /> How We Use Your Data
                </h2>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px' }}>
                    <li>To authenticate you and secure your account</li>
                    <li>To store and display your job applications</li>
                    <li>To sync data across your devices</li>
                </ul>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    🔒 We do <strong>NOT</strong> sell, share, or use your data for advertising. Your data is yours alone.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Data Storage & Security</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    Your data is securely stored in Google Firebase with industry-standard encryption.
                    Only you can access your data through your authenticated Google account.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Chrome Extension</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    If you use our Chrome extension:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px', marginTop: '12px' }}>
                    <li>Your Gemini API key is stored locally in your browser only</li>
                    <li>We never transmit or store your API key on our servers</li>
                    <li>Page content is processed directly with Google's Gemini API</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Trash2 size={20} color="var(--error)" /> Your Rights (GDPR)
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '16px' }}>
                    Under GDPR and similar privacy laws, you have the right to:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px' }}>
                    <li><strong>Access:</strong> View all data we store about you</li>
                    <li><strong>Rectification:</strong> Update or correct your data anytime</li>
                    <li><strong>Erasure:</strong> Delete your account and all associated data</li>
                    <li><strong>Portability:</strong> Export your job application data</li>
                    <li><strong>Withdraw Consent:</strong> Stop using the service anytime</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Cookies & Tracking</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    We use essential cookies only for authentication. We do <strong>not</strong> use:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px', marginTop: '12px' }}>
                    <li>❌ Third-party tracking cookies</li>
                    <li>❌ Advertising networks</li>
                    <li>❌ Analytics that track individual users</li>
                </ul>
            </div>

            <div className="card" style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Mail size={20} color="var(--accent-primary)" /> Contact Us
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    For privacy-related inquiries or to exercise your data rights, contact us at:
                </p>
                <p style={{ marginTop: '12px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                    privacy@jobtracker.app
                </p>
            </div>
        </div>
    );
}
