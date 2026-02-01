'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function InterviewPage() {
    const [file, setFile] = useState(null);
    const [jobDesc, setJobDesc] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!jobDesc) return;

        setLoading(true);
        setResult(null);

        const formData = new FormData();
        if (file) formData.append('resume', file);
        formData.append('jobDescription', jobDesc);

        try {
            const cleanOrigin = window.location.protocol + '//' + window.location.host;
            const res = await fetch(cleanOrigin + '/api/interview', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server error');
            setResult(data.questions);
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100">
                AI Interview Prep 🎤
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="glass-panel p-6 h-fit">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Job Description (Required)
                            </label>
                            <textarea
                                className="w-full h-48 p-4 rounded-xl border border-gray-600 bg-gray-900/50 text-white focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                                placeholder="Paste the job description here..."
                                value={jobDesc}
                                onChange={(e) => setJobDesc(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Your Resume (Optional, for tailored questions)
                            </label>
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-xl cursor-pointer bg-gray-800/50 hover:bg-gray-700/50 hover:border-blue-400 transition-all group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg className="w-8 h-8 mb-4 text-gray-400 group-hover:text-blue-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                        </svg>
                                        <p className="mb-2 text-sm text-gray-400 group-hover:text-gray-200">
                                            <span className="font-semibold">Click to upload</span>
                                        </p>
                                    </div>
                                    <input type="file" className="hidden" onChange={handleFileChange} />
                                </label>
                            </div>
                            {file && <p className="mt-2 text-sm text-green-400 font-medium flex items-center gap-1">✓ Selected: {file.name}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg transition-all transform ${loading
                                    ? 'bg-gray-600 cursor-not-allowed opacity-70'
                                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1'
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">⚡</span> Generating...
                                </span>
                            ) : 'Prepare Me for this Interview! 🚀'}
                        </button>
                    </form>
                </div>

                {/* Results Section */}
                <div className="glass-panel p-8 min-h-[600px] border-l-4 border-l-blue-500">
                    <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3 border-b border-gray-700 pb-4">
                        <span className="text-3xl">🎤</span> Your Interview Plan
                    </h2>

                    {result ? (
                        <div className="prose prose-invert max-w-none prose-headings:text-blue-300 prose-p:text-gray-300 prose-li:text-gray-300">
                            <ReactMarkdown>{result}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                            <div className="text-6xl">💭</div>
                            <p className="text-lg">Paste a job description to get started.</p>
                            <p className="text-sm max-w-xs text-center">
                                AI will analyze the role and your experience to generate the 10 most likely questions you'll face.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
