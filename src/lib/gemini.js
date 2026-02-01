// Google Generative AI Library
import { GoogleGenerativeAI } from '@google/generative-ai';

export const processFile = async (file) => {
    const bytes = await file.arrayBuffer();
    return Buffer.from(bytes).toString('base64');
};

export const getMimeType = (file, defaultType) => {
    if (!file.type || file.type === 'application/octet-stream') {
        return defaultType;
    }
    return file.type;
};

export const getGeminiModel = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('API Key not configured');

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use the latest confirmed working model
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
};

export const fileToGenerativePart = async (file) => {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    return {
        inlineData: {
            data: base64,
            mimeType: file.type || 'application/pdf',
        },
    };
};
