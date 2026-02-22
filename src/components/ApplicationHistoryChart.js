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

        // 1. Pre-process and sort timestamps
        // Map to timestamp first to avoid repeated safeDate calls and object creations
        const jobTimestamps = jobs
            .map(j => safeDate(j.dateAdded || j.createdAt).getTime())
            .sort((a, b) => a - b);

        if (jobTimestamps.length === 0) return [];

        // 2. Get date range (from first job to today)
        const firstJobDate = new Date(jobTimestamps[0]);
        const today = new Date();
        // Ensure we show at least the last 7 days if only 1 job
        const startDate = subDays(today, 7) < firstJobDate ? subDays(today, 7) : firstJobDate;

        const days = eachDayOfInterval({
            start: startOfDay(startDate),
            end: startOfDay(today)
        });

        // 3. Single pass accumulation (O(N) instead of O(N^2))
        let currentJobIndex = 0;

        return days.map(day => {
            // Create a new date object for end of day to avoid mutating the original day object
            const endOfDay = new Date(day);
            endOfDay.setHours(23, 59, 59, 999);
            const endOfDayTime = endOfDay.getTime();

            // Advance index while job date is before or equal to end of day
            while (
                currentJobIndex < jobTimestamps.length &&
                jobTimestamps[currentJobIndex] <= endOfDayTime
            ) {
                currentJobIndex++;
            }

            return {
                date: format(day, 'MMM d'),
                count: currentJobIndex // The index represents the cumulative count
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
