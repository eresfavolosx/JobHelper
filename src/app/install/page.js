"use client";
import { Download, Monitor } from "lucide-react";
import { useState, useEffect } from "react";

export default function InstallPage() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Check if device is mobile
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (isMobile) {
        return (
            <div className="container" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', paddingTop: '60px' }}>
                <div className="card" style={{ padding: '48px 32px' }}>
                    <Monitor size={64} color="var(--accent-primary)" style={{ marginBottom: '24px' }} />
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '16px' }}>Desktop Only</h1>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        The Job Tracker browser extension is only available for desktop browsers like Chrome.
                        Please visit this page on your computer to download and install the extension.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header className="animate-slide-up" style={{ marginBottom: '40px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '16px' }}>Install Job Extension</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    Track jobs from LinkedIn, Indeed, and more with a single click.
                </p>
            </header>

            <div className="card animate-scale-in delay-100" style={{ padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px', background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                <a
                    href="/extension.zip"
                    download="job-tracker-extension.zip"
                    className="btn-primary"
                    style={{
                        fontSize: '1.2rem',
                        padding: '16px 32px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 0 30px rgba(14, 165, 233, 0.4)'
                    }}
                >
                    <Download size={24} />
                    Download Extension
                </a>
                <p style={{ marginTop: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Version 1.1.0 • .zip format • AI Context Enabled
                </p>
            </div>

            <div className="card animate-slide-up delay-200" style={{ padding: '32px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px' }}>Installation Instructions</h2>

                <ol style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '24px', color: 'var(--text-primary)' }}>
                    <li>
                        <strong style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>1. Unzip the file</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Extract the downloaded <code>extension.zip</code> to a folder on your computer.</p>
                    </li>
                    <li>
                        <strong style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>2. Open Chrome Extensions</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Go to <code>chrome://extensions</code> in your address bar.</p>
                    </li>
                    <li>
                        <strong style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>3. Enable Developer Mode</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Toggle the switch in the top-right corner of the Extensions page.</p>
                    </li>
                    <li>
                        <strong style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>4. Load Unpacked</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Click "Load unpacked" button (top-left) and select the folder you extracted in step 1.</p>
                    </li>
                    <li>
                        <strong style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>5. Pin & Use</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Pin the extension to your toolbar. Don't forget to add your Gemini API Key!</p>
                    </li>
                </ol>
            </div>
        </div>
    );
}
