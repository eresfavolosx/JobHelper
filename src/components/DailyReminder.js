'use client';

import { useEffect } from 'react';
import { safeDate } from '@/lib/utils';

export default function DailyReminder() {
    useEffect(() => {
        const checkReminder = () => {
            if (typeof window === 'undefined') return;
            const lastCheck = localStorage.getItem('lastJobCheckDate');
            const now = new Date();
            const oneDay = 24 * 60 * 60 * 1000;

            if (!lastCheck || now - safeDate(lastCheck) > oneDay) {
                localStorage.setItem('lastJobCheckDate', now.toISOString());
                // Guard: Notification API is not available on iOS Safari; only fire if already granted
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('NovuJobs Reminder', {
                        body: 'It takes consistency to land a job! Check for new listings today.',
                        icon: '/icon.png'
                    });
                }
            }
        };

        // Check on mount
        checkReminder();

        // Check periodically (e.g., every hour) if the app is left open
        const interval = setInterval(checkReminder, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return null; // Logic only component
}
