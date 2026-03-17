
import test from 'node:test';
import assert from 'node:assert';

// Mock Dependencies
const safeDate = (input) => {
    if (!input) return new Date();
    if (input instanceof Date) return input;
    return new Date(input);
};

const startOfDay = (d) => {
    const newD = new Date(d);
    newD.setHours(0, 0, 0, 0, 0);
    return newD;
};

const subDays = (d, days) => {
    const newD = new Date(d);
    newD.setDate(newD.getDate() - days);
    return newD;
};

const eachDayOfInterval = ({ start, end }) => {
    const days = [];
    let current = new Date(start);
    while (current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return days;
};

const format = (d) => d.toISOString().split('T')[0]; // Simple format for test

// The Optimized Logic to Test
function calculateChartData(jobs) {
    if (!jobs || jobs.length === 0) return [];

    // 1. Sort jobs by dateAdded (O(N log N))
    const sortedJobs = [...jobs].sort((a, b) => {
        const dateA = safeDate(a.dateAdded || a.createdAt).getTime();
        const dateB = safeDate(b.dateAdded || b.createdAt).getTime();
        return dateA - dateB;
    });

    // 2. Get date range (from first job to today)
    const firstJobDate = safeDate(sortedJobs[0].dateAdded || sortedJobs[0].createdAt);
    const today = new Date(); // In real app this is "now", for test we might need to control it

    // Ensure we show at least the last 7 days if only 1 job
    // Note: The logic in component uses subDays(today, 7) < firstJobDate
    // This seems to imply if first job is older than 7 days, start from there.
    // If first job is newer than 7 days, start from 7 days ago.
    // Wait, subDays(today, 7) < firstJobDate means "7 days ago is BEFORE the first job".
    // So if first job is VERY RECENT (e.g. today), we start 7 days ago.
    // If first job is OLD (e.g. last year), we start from last year.
    // Correct.

    const startDate = subDays(today, 7) < firstJobDate ? subDays(today, 7) : firstJobDate;

    const days = eachDayOfInterval({
        start: startOfDay(startDate),
        end: startOfDay(today)
    });

    // 3. Single Pass Calculation (O(M + N))
    let jobIndex = 0;
    let cumulativeCount = 0;

    // Pre-calculate job timestamps
    const jobTimestamps = sortedJobs.map(j => safeDate(j.dateAdded || j.createdAt).getTime());

    return days.map(day => {
        const endOfDayTime = new Date(day).setHours(23, 59, 59, 999);

        // Advance the job pointer
        while (
            jobIndex < jobTimestamps.length &&
            jobTimestamps[jobIndex] <= endOfDayTime
        ) {
            cumulativeCount++;
            jobIndex++;
        }

        return {
            date: format(day), // utilizing mock format
            count: cumulativeCount
        };
    });
}

test('calculateChartData handles basic case correctly', (t) => {
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const twoDaysAgo = new Date(today); twoDaysAgo.setDate(today.getDate() - 2);

    const jobs = [
        { id: 1, createdAt: twoDaysAgo.toISOString() }, // Job 1: 2 days ago
        { id: 2, createdAt: yesterday.toISOString() },  // Job 2: 1 day ago
        { id: 3, createdAt: today.toISOString() }       // Job 3: Today
    ];

    const data = calculateChartData(jobs);

    // We expect at least 3 days in the output if range logic holds
    // Actually, logic says if first job (2 days ago) is NEWER than 7 days ago, start 7 days ago.
    // So we should have ~8 points (7 days ago ... today).

    const lastPoint = data[data.length - 1];
    assert.strictEqual(lastPoint.count, 3, 'Cumulative count today should be 3');

    const secondLast = data[data.length - 2]; // yesterday
    // If test runs late in day, yesterday is full day.
    // Job 2 added yesterday. Job 1 added 2 days ago. So count is 2.
    assert.strictEqual(secondLast.count, 2, 'Cumulative count yesterday should be 2');
});

test('calculateChartData handles multiple jobs on same day', (t) => {
    const today = new Date();
    const jobs = [
        { id: 1, createdAt: today.toISOString() },
        { id: 2, createdAt: today.toISOString() }
    ];

    const data = calculateChartData(jobs);
    const lastPoint = data[data.length - 1];
    assert.strictEqual(lastPoint.count, 2, 'Should count both jobs for today');
});

test('calculateChartData handles empty jobs', (t) => {
    const data = calculateChartData([]);
    assert.deepStrictEqual(data, [], 'Should return empty array for no jobs');
});
