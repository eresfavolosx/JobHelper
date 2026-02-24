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

        // 1. Sort jobs by dateAdded and pre-calculate timestamps
        // Map to object with timestamp to avoid repeated parsing and O(N*M) complexity
        const sortedJobs = jobs.map(job => {
            const date = safeDate(job.dateAdded || job.createdAt);
            return {
                ...job,
                _ts: date.getTime(),
                _date: date
            };
        }).sort((a, b) => a._ts - b._ts);

        // 2. Get date range (from first job to today)
        const firstJobDate = sortedJobs[0]._date;
        const today = new Date();
        // Ensure we show at least the last 7 days if only 1 job
        const startDate = subDays(today, 7) < firstJobDate ? subDays(today, 7) : firstJobDate;

        const days = eachDayOfInterval({
            start: startOfDay(startDate),
            end: startOfDay(today)
        });

        // 3. Build cumulative data
        let jobIndex = 0;

        return days.map(day => {
            // Calculate end of day timestamp once per day
            const endOfDayTs = new Date(day).setHours(23, 59, 59, 999);

            // Efficient O(N+M) single pass: advance pointer while job date is <= end of current day
            while (
                jobIndex < sortedJobs.length &&
                sortedJobs[jobIndex]._ts <= endOfDayTs
            ) {
                jobIndex++;
            }

            return {
                date: format(day, 'MMM d'),
                count: jobIndex
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
