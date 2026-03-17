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

        // ⚡ Bolt: Single O(N) pass to pre-calculate primitive timestamps
        // This avoids expensive Date parsing inside the O(N log N) sort.
        const jobsWithTime = jobs.map(job => ({
            _timestamp: safeDate(job.dateAdded || job.createdAt).getTime()
        })).sort((a, b) => a._timestamp - b._timestamp);

        // 2. Get date range (from first job to today)
        const firstJobTime = jobsWithTime[0]._timestamp;
        const today = new Date();
        const weekAgo = subDays(today, 7);
        // Ensure we show at least the last 7 days
        const startMillis = Math.min(weekAgo.getTime(), firstJobTime);
        const startDate = new Date(startMillis);

        const days = eachDayOfInterval({
            start: startOfDay(startDate),
            end: startOfDay(today)
        });

        // 3. Single pass accumulation (O(N) instead of O(N^2))
        let currentJobIndex = 0;

        return days.map(day => {
            const endOfDay = new Date(day).setHours(23, 59, 59, 999);

            // Add jobs that happened on or before the end of this day
            while (
                jobIndex < jobsWithTime.length &&
                jobsWithTime[jobIndex]._timestamp <= endOfDay
            ) {
                jobIndex++;
            }

            return {
                date: format(day, 'MMM d'),
                count: cumulativeCount
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
