import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';

export async function POST(req) {
    try {
        const { pageText, pageUrl } = await req.json();

        if (!pageText) {
            return NextResponse.json({ error: 'No page text provided' }, { status: 400 });
        }

        const model = getGeminiModel();

        // Limit text to avoid token limits - first 5000 chars should contain job info
        const truncatedText = pageText.substring(0, 5000);

        const prompt = `You are extracting job posting information from a webpage. 
        
Given the following text content from a job posting page, extract:
1. The exact job title/role (e.g., "Senior Software Engineer", "Product Manager")
2. The company name (e.g., "Google", "Meta", "Acme Corp")

Page URL: ${pageUrl || 'unknown'}

Page content:
${truncatedText}

Respond ONLY with valid JSON in this exact format, no markdown code blocks:
{"jobTitle": "extracted job title here", "company": "extracted company name here"}

If you cannot find a field, use an empty string. Do not guess or make up values.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        // Parse the JSON response
        let parsed;
        try {
            // Remove any markdown code blocks if present
            const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            console.error('Failed to parse AI response:', responseText);
            return NextResponse.json({
                jobTitle: '',
                company: '',
                error: 'Failed to parse AI response'
            });
        }

        return NextResponse.json({
            jobTitle: parsed.jobTitle || '',
            company: parsed.company || ''
        });

    } catch (error) {
        console.error('AI extraction error:', error);
        return NextResponse.json({
            jobTitle: '',
            company: '',
            error: error.message
        }, { status: 500 });
    }
}
