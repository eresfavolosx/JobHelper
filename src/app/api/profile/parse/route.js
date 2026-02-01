import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { fileToGenerativePart } from '@/lib/gemini';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get("resume");

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const filePart = await fileToGenerativePart(file);

        const prompt = `
            You are an expert Resume Parser. 
            I am providing a LinkedIn Profile PDF. 
            Please extract the following information in strict JSON format:
            
            {
                "fullName": "Name of the person",
                "targetRole": "Current headline or most recent job title",
                "location": "Location listed in profile",
                "keywords": "Top 5-10 comma-separated technical skills found in the profile",
                "experienceLevel": "Estimated level (Intern, Junior, Mid-Level, Senior, Lead, Executive) based on years of experience"
            }
            
            Return ONLY the JSON. Do not use Markdown blocking.
        `;

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(text);

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error parsing LinkedIn PDF:', error);
        return NextResponse.json({ error: "Failed to parse profile" }, { status: 500 });
    }
}
