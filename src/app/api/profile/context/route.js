import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { fileToGenerativePart } from '@/lib/gemini';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
    try {
        const formData = await req.formData();
        const files = formData.getAll("files");

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const processedDocs = [];

        for (const file of files) {
            const filePart = await fileToGenerativePart(file);

            const prompt = `
                Extract the core text content from this document. 
                Summarize it in 1 sentence.
                Return JSON: { "summary": "...", "content": "..." }
            `;

            const result = await model.generateContent([prompt, filePart]);
            const response = await result.response;
            const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(text);

            processedDocs.push({
                name: file.name,
                summary: data.summary,
                content: data.content,
                uploadedAt: new Date().toISOString()
            });
        }

        return NextResponse.json({ documents: processedDocs });
    } catch (error) {
        console.error('Error parsing files:', error);
        return NextResponse.json({ error: "Failed to parse files" }, { status: 500 });
    }
}
