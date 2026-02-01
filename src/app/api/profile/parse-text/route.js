import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
    try {
        const { text } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "No text provided" }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            I am providing the raw text content of a LinkedIn Profile. 
            Please extract the following information in strict JSON format:
            
            {
                "fullName": "Name of the person",
                "targetRole": "Headline or current Title",
                "location": "Location listed",
                "keywords": "Top 10 comma-separated technical skills or expertise areas found",
                "experienceLevel": "Estimated level (Intern, Junior, Mid-Level, Senior, Lead, Executive) based on years of experience years found in text",
                "summary": "A brief professional summary derived from the text (max 3 sentences)"
            }
            
            Here is the profile text:
            ${text.substring(0, 30000)} // Limit to avoid token limits, usually enough
            
            Return ONLY the JSON.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(jsonText);

        return NextResponse.json(data, {
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow Extension to call this
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    } catch (error) {
        console.error('Error parsing profile text:', error);
        return NextResponse.json({ error: "Failed to parse text" }, { status: 500 });
    }
}

export async function OPTIONS(req) {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
