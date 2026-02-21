import { NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400 }
            );
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        const mimeType = file.type || 'application/pdf';

        const model = getGeminiModel();

        const prompt = `
        You are an expert career coagch and resume analyst.
        Analyze the following resume and extract the key information needed to find relevant job matches and improve the user's profile.

        Return a JSON object with the following structure:
        {
            "skills": ["skill1", "skill2", ...],
            "experienceLevel": "Entry/Mid/Senior/Executive",
            "targetRoles": ["Role Title 1", "Role Title 2"],
            "summary": "A 2-sentence professional summary of the candidate.",
            "keywords": ["keyword1", "keyword2", ...]
        }

        Resume Content:
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64,
                    mimeType: mimeType
                }
            }
        ]);

        const responseText = result.response.text();

        // Clean and parse JSON
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(cleanJson);

        return NextResponse.json(analysis);

    } catch (error) {
        console.error('Resume analysis error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze resume: ' + error.message },
            { status: 500 }
        );
    }
}
