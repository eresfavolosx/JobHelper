'use client';

import { useEffect } from 'react';

export default function DailyReminder() {
    useEffect(() => {
        const checkReminder = () => {
            const lastCheck = localStorage.getItem('lastJobCheckDate');
            const now = new Date();
            const oneDay = 24 * 60 * 60 * 1000;

            if (!lastCheck || now - new Date(lastCheck) > oneDay) {
                // Request notification permission
                if (Notification.permission !== 'granted') {
                    Notification.requestPermission();
                }

                // Show browser notification
                if (Notification.permission === 'granted') {
                    new Notification('Job Tracker Reminder', {
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
