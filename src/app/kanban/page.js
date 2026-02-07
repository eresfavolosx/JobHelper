"use client";
import KanbanBoard from '@/components/KanbanBoard';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';

export default function KanbanPage() {
    const { user, loading } = useAuth();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !loading && !user) {
            window.location.href = '/login';
        }
    }, [mounted, loading, user]);

    if (!mounted || loading) return null;
    if (!user) return null;

    return (
        <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>Application Board</h2>
            <KanbanBoard />
        </div>
    );
}
