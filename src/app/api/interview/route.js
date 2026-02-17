import { NextResponse } from 'next/server';
import { getGeminiModel, processFile, getMimeType } from '@/lib/gemini';
import { verifyAuth } from '@/lib/auth-util';

export async function POST(req) {
    // 🔒 Security: Check authentication
    const user = await verifyAuth(req);
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const resume = formData.get('resume');
        const jobDescription = formData.get('jobDescription');

        if (!jobDescription) {
            return NextResponse.json({ error: 'Missing job description' }, { status: 400 });
        }

        const model = getGeminiModel();
        const parts = [];

        // Resume is optional but recommended
        if (resume && resume.size > 0) {
            parts.push({
                inlineData: {
                    mimeType: getMimeType(resume, 'application/pdf'),
                    data: await processFile(resume)
                }
            });
        }

        // Prompt
        parts.push({
            text: `You are an expert technical interviewer and hiring manager.
            
            TASK:
            Generate a list of interview questions based on the provided Job Description (and Resume if attached).
            
            OUTPUT FORMAT:
            Provide exactly 10 questions in this structure:
            
            ### Technical Deep Dive
            1. [Question] - (Brief hint on what to look for in the answer)
            2. ...
            
            ### Behavioral & Experience
            4. ...
            
            ### Situational / "What If"
            7. ...

            JOB DESCRIPTION:
            ${jobDescription}
            
            Keep questions challenging but realistic for the role.
            Output in Markdown.`
        });

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ questions: text });

    } catch (error) {
        console.error('Interview API Error:', error);
        return NextResponse.json({
            error: 'Failed to generate questions: ' + (error.message || error.toString())
        }, { status: 500 });
    }
}
