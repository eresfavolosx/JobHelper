
import { NextResponse } from 'next/server';
import { getGeminiModel, processFile, getMimeType } from '@/lib/gemini';

export async function POST(req) {
    try {
        const formData = await req.formData();
        const resume = formData.get('resume');
        const jobDescription = formData.get('jobDescription');
        const contextFiles = formData.getAll('contextfiles'); // Get all other files

        if (!resume || !jobDescription) {
            return NextResponse.json({ error: 'Missing resume or job description' }, { status: 400 });
        }

        const model = getGeminiModel();

        // Prepare resume
        const resumePart = {
            inlineData: {
                mimeType: getMimeType(resume, 'application/pdf'),
                data: await processFile(resume)
            }
        };

        // Prepare context files
        const contextParts = await Promise.all(contextFiles.map(async (file) => ({
            inlineData: {
                // Default context files to text/plain if unknown (safer for cover letters etc)
                // If the user uploads a PDF as context, we might want to default to PDF, but text is a safe fallback for "octet-stream" 
                // unless we check extension. For now, defaulting to text/plain for context is reasonable.
                // Actually, let's try to be smarter. If generic, assume text unless it looks like a PDF (magic bytes check is hard here).
                // Let's stick to text/plain for context context to be safe.
                mimeType: getMimeType(file, 'text/plain'),
                data: await processFile(file)
            }
        })));

        const promptPart = {
            text: `You are an expert resume editor.
        I have attached a Resume(first file) and potential additional context files.

    TASK:
        Analyze the resume against the provided Job Description.
        Output ONLY the specific sections of the resume that should be changed to target this job.
        Provide the EXACT text for me to copy and paste.
        NO conversational filler(e.g., "Here is a tailored version...").
        NO explanations.JUST the content.

        REQUIRED SECTIONS:
        
        ## Professional Summary
    (Rewrite the summary to strictly target the job keywords and requirements)

        ## Key Skills
    (List the top 10 most relevant skills for this specific job, comma - separated)

        ## Experience Updates
    (Suggest 3 - 4 specific bullet points from the resume that should be rewritten to better highlight results relevant to this job.key: "Old Bullet" -> "New Bullet")

        JOB DESCRIPTION:
        ${jobDescription}

Output in Markdown format.
        `
        };

        const parts = [resumePart, ...contextParts, promptPart];

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ suggestion: text });
    } catch (error) {
        console.error('AI Error Details:', error);
        return NextResponse.json({
            error: 'Failed to process resume: ' + (error.message || error.toString())
        }, { status: 500 });
    }
}
