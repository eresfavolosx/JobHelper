"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function LoginPage() {
    alignItems: 'center',
        justifyContent: 'center',
            minHeight: '100vh',
                background: 'var(--bg-app)'
}}>
    <div className="card" style={{ width: '400px', textAlign: 'center', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Briefcase size={48} color="var(--accent-primary)" />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px' }}>JobTracker</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Sign in to manage your applications</p>

        {error && (
            <div style={{ padding: '10px', background: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', borderRadius: '6px', marginBottom: '20px', fontSize: '0.9rem' }}>
                {error}
            </div>
        )}

        <button
            onClick={handleLogin}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
        >
            Sign in with Google
        </button>
    </div>
        </div >
    );
}
