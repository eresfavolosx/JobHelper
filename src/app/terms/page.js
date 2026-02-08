"use client";
import Link from 'next/link';
import { ArrowLeft, FileText, Scale, AlertTriangle } from 'lucide-react';

export default function TermsPage() {
    const lastUpdated = "February 8, 2026";

    return (
        <div className="container" style={{ maxWidth: '800px', marginTop: '40px', marginLeft: 'auto', marginRight: 'auto', width: '100%', paddingBottom: '60px' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '24px', textDecoration: 'none' }}>
                <ArrowLeft size={18} /> Back to Dashboard
            </Link>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Scale size={32} color="var(--accent-primary)" />
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '8px' }}>Terms of Service</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Last updated: {lastUpdated}</p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={20} color="var(--accent-primary)" /> Acceptance of Terms
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    By accessing or using JobTracker ("the Service"), you agree to be bound by these Terms of Service.
                    If you do not agree to these terms, please do not use the Service.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Description of Service</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    JobTracker is a personal job application tracking tool that allows you to:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px', marginTop: '12px' }}>
                    <li>Track job applications across different stages</li>
                    <li>Store job details, notes, and application status</li>
                    <li>Use a browser extension to capture job postings</li>
                    <li>Access AI-powered features for job extraction</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>User Accounts</h2>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px' }}>
                    <li>You must sign in with a valid Google account to use the Service</li>
                    <li>You are responsible for maintaining the security of your account</li>
                    <li>You must be at least 13 years old to use this Service</li>
                    <li>One person or legal entity may not maintain more than one account</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Acceptable Use</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '12px' }}>
                    You agree NOT to use the Service to:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px' }}>
                    <li>Violate any laws or regulations</li>
                    <li>Infringe on intellectual property rights</li>
                    <li>Transmit malware or harmful code</li>
                    <li>Attempt to gain unauthorized access to other accounts</li>
                    <li>Use automated systems to scrape or collect data</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Your Content</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    You retain ownership of all content you submit to JobTracker. By using the Service, you grant us
                    a limited license to store and display your content solely for the purpose of providing the Service to you.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Third-Party Services</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    The Service integrates with third-party services including:
                </p>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '2', paddingLeft: '24px', marginTop: '12px' }}>
                    <li><strong>Google:</strong> For authentication (subject to Google's Terms of Service)</li>
                    <li><strong>Google Gemini API:</strong> For AI-powered job extraction (requires your own API key)</li>
                    <li><strong>Firebase:</strong> For data storage and hosting</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '24px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={20} color="var(--warning)" /> Disclaimer of Warranties
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. We do not guarantee that the Service
                    will be uninterrupted, secure, or error-free. Use at your own risk.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Limitation of Liability</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    To the maximum extent permitted by law, JobTracker shall not be liable for any indirect, incidental,
                    special, consequential, or punitive damages, including loss of data or employment opportunities.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Termination</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    You may delete your account at any time. We reserve the right to suspend or terminate accounts
                    that violate these terms. Upon termination, your data will be deleted in accordance with our Privacy Policy.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Changes to Terms</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    We may update these terms from time to time. Continued use of the Service after changes constitutes
                    acceptance of the new terms. We will notify users of significant changes via email or in-app notification.
                </p>
            </div>

            <div className="card" style={{ background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '16px' }}>Contact</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                    For questions about these Terms of Service, contact us at:
                </p>
                <p style={{ marginTop: '12px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                    legal@jobtracker.app
                </p>
            </div>
        </div>
    );
}
