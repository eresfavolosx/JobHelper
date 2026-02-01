"use client";
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }) {
    const [authorized, setAuthorized] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkAuth = () => {
            const isAuth = localStorage.getItem("is_authenticated") === "true";

            if (!isAuth && pathname !== '/login') {
                router.push('/login');
                setAuthorized(false);
            } else {
                setAuthorized(true);
            }

            // Redirect away from login if already auth
            if (isAuth && pathname === '/login') {
                router.push('/');
            }
        };

        checkAuth();

        // Listen for storage events (multi-tab support)
        window.addEventListener('storage', checkAuth);
        return () => window.removeEventListener('storage', checkAuth);

    }, [pathname, router]);

    // Simple loading check - we can just render null while redirecting
    if (!authorized && pathname !== '/login') {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
            </div>
        );
    }

    // specific check: if no user and not on login, don't render children (prevent flash)
    if (!user && pathname !== '/login') {
        return null;
    }

    return children;
}
