"use client";
import { useMemo } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { format, startOfDay, eachDayOfInterval, subDays } from 'date-fns';
import { safeDate } from '@/lib/utils';

export default function ApplicationHistoryChart({ jobs }) {
    const data = useMemo(() => {
        if (!jobs || jobs.length === 0) return [];

        // 1. Convert jobs to sorted timestamps for O(N) access
        // Using timestamps avoids repeated Date object creation and comparisons
        const sortedTimestamps = jobs
            .map(j => safeDate(j.dateAdded || j.createdAt).getTime())
            .sort((a, b) => a - b);

        // 2. Get date range (from first job to today)
        const firstJobDate = new Date(sortedTimestamps[0]);
        const today = new Date();
        // Ensure we show at least the last 7 days if only 1 job
        const startDate = subDays(today, 7) < firstJobDate ? subDays(today, 7) : firstJobDate;

        const days = eachDayOfInterval({
            start: startOfDay(startDate),
            end: startOfDay(today)
        });

        // 3. Build cumulative data in a single pass O(N + M)
        let currentCount = 0;
        let jobIndex = 0;

        return days.map(day => {
            // Use primitive timestamp comparison for performance
            // Create a new Date to avoid mutating the original 'day' object
            const endOfDayTimestamp = new Date(day).setHours(23, 59, 59, 999);

            while (
                jobIndex < sortedTimestamps.length &&
                sortedTimestamps[jobIndex] <= endOfDayTimestamp
            ) {
                currentCount++;
                jobIndex++;
            }

            return {
                date: format(day, 'MMM d'),
                count: currentCount
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
