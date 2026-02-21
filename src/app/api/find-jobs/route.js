import { NextResponse } from 'next/server';
import { fetchJobsFromRSS, scoreJobsWithGemini } from '@/lib/job-service';

export async function POST(req) {
    try {
        const { keywords, resumeData } = await req.json();

        // 1. Fetch
        const rawJobs = await fetchJobsFromRSS(keywords);

        // 2. Score
        const scoredJobs = await scoreJobsWithGemini(rawJobs, resumeData);

        return NextResponse.json(scoredJobs);

    } catch (error) {
        console.error('Find jobs error:', error);
        return NextResponse.json(
            { error: 'Failed to find jobs: ' + error.message },
            { status: 500 }
        );
    }
}
