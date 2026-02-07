"use client";
import { Download } from "lucide-react";

export default function InstallPage() {
    return (
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '40px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '16px' }}>Install Job Extension</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    Track jobs from LinkedIn, Indeed, and more with a single click.
                </p>
            </header>

            <div className="card" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
                <a
                    href="/extension.zip"
                    download="job-tracker-extension.zip"
                    className="btn-primary"
                    style={{
                        fontSize: '1.2rem',
                        padding: '16px 32px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}
                >
                    <Download size={24} />
                    Download Extension
                </a>
                <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Version 1.0.0 • .zip format
                </p>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '12px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '24px' }}>Installation Instructions</h2>

                <ol style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-primary)' }}>
                    <li>
                        <strong>Unzip the file</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Extract the downloaded <code>extension.zip</code> to a folder on your computer.</p>
                    </li>
                    <li>
                        <strong>Open Chrome Extensions</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Go to <code>chrome://extensions</code> in your address bar.</p>
                    </li>
                    <li>
                        <strong>Enable Developer Mode</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Toggle the switch in the top-right corner of the Extensions page.</p>
                    </li>
                    <li>
                        <strong>Load Unpacked</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Click "Load unpacked" button (top-left) and select the folder you extracted in step 1.</p>
                    </li>
                    <li>
                        <strong>Pin & Use</strong>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Pin the extension to your toolbar and start saving jobs!</p>
                    </li>
                </ol>
            </div>
        </div>
    );
}
