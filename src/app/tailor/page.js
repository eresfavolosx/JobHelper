"use client";
import { useState, useEffect } from 'react';
import { FileText, Sparkles, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function TailorPage() {
    const [file, setFile] = useState(null);
    const [contextFiles, setContextFiles] = useState([]);
    const [jobDesc, setJobDesc] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        // Clean URL if it has credentials to avoid "Request cannot be constructed from a URL that includes credentials"
        // and for better UX. 
        // We construct the origin manually (protocol + host) to ensure NO credentials are included.
        // window.location.origin might sometimes include them depending on browser behavior if they are in the address bar.
        const cleanOrigin = window.location.protocol + '//' + window.location.host;
        const cleanUrl = cleanOrigin + window.location.pathname + window.location.search + window.location.hash;

        if (window.location.href !== cleanUrl) {
            console.log("Replacing URL with clean version:", cleanUrl);
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }, []);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleContextFilesChange = (e) => {
        if (e.target.files) {
            setContextFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || !jobDesc) return;

        setLoading(true);
        setResult(null);

        const formData = new FormData();
        formData.append('resume', file);
        formData.append('jobDescription', jobDesc);
        contextFiles.forEach(f => formData.append('contextfiles', f));

        try {
            // Use manually constructed origin to ensure clean URL fetch
            const cleanOrigin = window.location.protocol + '//' + window.location.host;
            const res = await fetch(cleanOrigin + '/api/tailor', {
                method: 'POST',
                // Rely on browser session for auth - DO NOT hardcode Basic Auth headers here
                body: formData
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Server error');
            }
            if (data.error) throw new Error(data.error);
            setResult(data.suggestion);
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '1000px' }}>
            <header style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold' }}>AI Resume Tailor</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Upload your generic resume, any extra context (cover letter, portfolio), and the job usage to get AI suggestions.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                {/* Input Column */}
                <div className="card" style={{ height: 'fit-content' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* File Upload */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>1. Upload Resume (PDF)</label>
                            <div
                                style={{
                                    border: '2px dashed var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '20px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: file ? 'rgba(46, 160, 67, 0.1)' : 'transparent'
                                }}
                                onClick={() => document.getElementById('resume-upload').click()}
                            >
                                <input
                                    id="resume-upload"
                                    type="file"
                                    accept=".pdf"
                                    hidden
                                    onChange={handleFileChange}
                                />
                                <Upload size={24} color="var(--text-secondary)" style={{ marginBottom: '10px' }} />
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {file ? file.name : "Click to upload Resume"}
                                </p>
                            </div>
                        </div>

                        {/* Context Files Upload */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>2. Additional Context (Optional)</label>
                            <div
                                style={{
                                    border: '2px dashed var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '20px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: contextFiles.length > 0 ? 'rgba(88, 166, 255, 0.1)' : 'transparent'
                                }}
                                onClick={() => document.getElementById('context-upload').click()}
                            >
                                <input
                                    id="context-upload"
                                    type="file"
                                    multiple
                                    hidden
                                    onChange={handleContextFilesChange}
                                />
                                <FileText size={24} color="var(--text-secondary)" style={{ marginBottom: '10px' }} />
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {contextFiles.length > 0 ? `${contextFiles.length} files selected` : "Upload files (Cover Letter, etc.)"}
                                </p>
                            </div>
                        </div>

                        {/* Job Description */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>3. Job Description</label>
                            <textarea
                                style={{
                                    width: '100%',
                                    height: '200px',
                                    padding: '12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-app)',
                                    color: 'var(--text-primary)',
                                    resize: 'vertical'
                                }}
                                placeholder="Paste the job requirements here..."
                                value={jobDesc}
                                onChange={(e) => setJobDesc(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading || !file || !jobDesc}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: (loading || !file || !jobDesc) ? 0.5 : 1 }}
                        >
                            <Sparkles size={18} />
                            {loading ? 'Analyzing...' : 'Generate Suggestions'}
                        </button>
                    </form>
                </div>

                {/* Output Column */}
                <div
                    className="card"
                    style={{
                        minHeight: '500px',
                        backgroundColor: 'var(--bg-panel)',
                        maxHeight: '800px',
                        overflowY: 'auto'
                    }}
                >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                        <FileText size={20} color="var(--accent-primary)" />
                        <h3 style={{ fontWeight: 'bold' }}>Tailored Suggestions</h3>
                    </div>

                    {loading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                            <Sparkles size={48} className="spin-animation" style={{ marginBottom: '20px', animation: 'spin 2s linear infinite' }} />
                            <p>Analyzing resume against job description...</p>
                            <style jsx>{`
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
                        </div>
                    )}

                    {!loading && !result && (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '100px' }}>
                            Suggestions will appear here.
                        </div>
                    )}

                    {result && (
                        <div className="prose" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.95rem' }}>
                            <ReactMarkdown>{result}</ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
