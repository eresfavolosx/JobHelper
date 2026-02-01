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
    return genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
};
