"use client";
import { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { format, parseISO, startOfDay, eachDayOfInterval, subDays } from 'date-fns';
import { safeDate } from '@/lib/utils';

export default function ApplicationHistoryChart({ jobs }) {
    const data = useMemo(() => {
        if (!jobs || jobs.length === 0) return [];

        // 1. Sort jobs by dateAdded
        const sortedJobs = [...jobs].sort((a, b) => {
            const dateA = safeDate(a.dateAdded || a.createdAt);
            const dateB = safeDate(b.dateAdded || b.createdAt);
            return dateA - dateB;
        });

        // 2. Get date range (from first job to today)
        const firstJobDate = safeDate(sortedJobs[0].dateAdded || sortedJobs[0].createdAt);
        const today = new Date();
        // Ensure we show at least the last 7 days if only 1 job
        const startDate = subDays(today, 7) < firstJobDate ? subDays(today, 7) : firstJobDate;

        const days = eachDayOfInterval({
            start: startOfDay(startDate),
            end: startOfDay(today)
        });

        // 3. Build cumulative data
        let cumulativeCount = 0;
        let jobIndex = 0;

        return days.map(day => {
            // Add jobs that happened on or before this day
            while (
                jobIndex < sortedJobs.length &&
                safeDate(sortedJobs[jobIndex].dateAdded || sortedJobs[jobIndex].createdAt) < day
            ) {
                cumulativeCount++;
                jobIndex++;
            }

            // Handle jobs added exactly on this day (simplified)
            // Re-check current index for exact match if needed, but < day logic holds for cumulative
            // Actually, let's just count how many jobs satisfy date <= end of this day
            const count = sortedJobs.filter(j => safeDate(j.dateAdded || j.createdAt) <= new Date(day.setHours(23, 59, 59))).length;

            return {
                date: format(day, 'MMM d'),
                count: count
            };
        });
    }, [jobs]);

    if (jobs.length < 2) {
        return (
            <div className="card" style={{ marginTop: '20px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                <p>Add more jobs to see your history graph!</p>
            </div>
        );
    }

    return (
        <div className="card" style={{ marginTop: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '20px', color: 'var(--text-primary)' }}>Application History</h3>
            <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                        <XAxis
                            dataKey="date"
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                            itemStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="var(--accent-primary)"
                            fillOpacity={1}
                            fill="url(#colorCount)"
                            strokeWidth={3}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
