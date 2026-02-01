'use client';

import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

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
                        icon: '/icon.png' // Assuming an icon exists or default
                    });
                }

                // Show in-app toast
                toast('Time to check for new jobs!', {
                    description: 'Consistency is key. Click to open LinkedIn.',
                    action: {
                        label: 'Open LinkedIn',
                        onClick: () => window.open('https://www.linkedin.com/jobs', '_blank')
                    },
                    duration: 10000,
                    icon: <Bell className="w-5 h-5 text-yellow-500" />
                });
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
