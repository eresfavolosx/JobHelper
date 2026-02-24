import { getGeminiModel } from './gemini-client.js';
import { escapeXml } from './utils.js';

// RSS Feed URLs
const FEEDS = [
    { name: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-jobs.rss' },
    { name: 'RemoteOK', url: 'https://remoteok.com/rss' }
];

// Helper to parse XML (simple regex/string manip to avoid heavy xml2js dependency if possible, or use a lightweight parser)
// For robustness, we'll use a simple regex extractor for standard RSS fields: title, link, description, pubDate
function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];
        const title = (itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemContent.match(/<title>(.*?)<\/title>/))?.[1] || '';
        const link = (itemContent.match(/<link>(.*?)<\/link>/))?.[1] || '';
        const description = (itemContent.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || itemContent.match(/<description>(.*?)<\/description>/))?.[1] || '';
        const pubDate = (itemContent.match(/<pubDate>(.*?)<\/pubDate>/))?.[1] || '';

        // Simple company extraction if possible, often in title like "Company: Role" or inside description
        // For WWR, title is usually "Role: Company" or similar.

        items.push({ title, link, description, pubDate, source: 'RSS' });
    }
    return items;
}

export async function fetchJobsFromRSS(keywords = []) {
    let allJobs = [];

    // Fetch from all feeds
    // Note: This needs to be called from a server component/route to avoid CORS
    for (const feed of FEEDS) {
        try {
            const response = await fetch(feed.url, { next: { revalidate: 3600 } });
            if (!response.ok) continue;
            const xml = await response.text();
            const jobs = parseRSS(xml);
            allJobs = [...allJobs, ...jobs.map(j => ({ ...j, source: feed.name }))];
        } catch (e) {
            console.error(`Failed to fetch ${feed.name}:`, e);
        }
    }

    // Basic keyword filtering to reduce Gemini load
    if (keywords.length > 0) {
        const lowerKeywords = keywords.map(k => k.toLowerCase());
        allJobs = allJobs.filter(job => {
            const content = (job.title + ' ' + job.description).toLowerCase();
            // Match at least one keyword
            return lowerKeywords.some(k => content.includes(k));
        });
    }

    return allJobs.slice(0, 20); // Limit to top 20 to save tokens
}

export async function scoreJobsWithGemini(jobs, resumeData, modelOverride = null) {
    if (!jobs.length || !resumeData) return jobs;

    const model = modelOverride || getGeminiModel();

    // Construct XML-based prompt to prevent injection
    const candidateProfile = `
    <candidate_profile>
        <target_role>${escapeXml(resumeData.targetRoles?.join(', ') || resumeData.targetRole)}</target_role>
        <skills>${escapeXml(resumeData.skills?.join(', '))}</skills>
        <experience>${escapeXml(resumeData.experienceLevel)}</experience>
    </candidate_profile>
    `;

    const jobsXml = jobs.map((j, i) => `
    <job index="${i}">
        <title>${escapeXml(j.title)}</title>
        <description>${escapeXml(j.description.substring(0, 500))}</description>
    </job>`).join('\n');

    const prompt = `
    You are a recruiter matching a candidate to jobs.
    
    Candidate Profile:
    ${candidateProfile}

    Jobs:
    <jobs>
    ${jobsXml}
    </jobs>

    Task:
    Analyze the <jobs> data against the <candidate_profile>.
    Rate each job's relevance to the candidate on a scale of 0-100.
    Return a JSON array of objects: [{ "index": 0, "score": 85, "reason": "Matches skill X and Y" }, ...]
    Only return the JSON.
    `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const scores = JSON.parse(cleanJson);

        // Merge scores back into jobs
        return jobs.map((job, i) => {
            const scoreData = scores.find(s => s.index === i);
            return {
                ...job,
                relevanceScore: scoreData?.score || 0,
                matchReason: scoreData?.reason || 'Analysis failed'
            };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);

    } catch (e) {
        console.error("Gemini scoring failed:", e);
        return jobs.map(j => ({ ...j, relevanceScore: 0, matchReason: "Scoring unavailable" }));
    }
}
