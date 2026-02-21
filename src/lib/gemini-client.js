import { GoogleGenerativeAI } from '@google/generative-ai';

// Convert a browser File object to a base64 string
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const getMimeType = (file, defaultType) => {
    if (!file.type || file.type === 'application/octet-stream') {
        return defaultType;
    }
    return file.type;
};

// Initialize Gemini directly in the browser
export const getGeminiModel = () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Missing NEXT_PUBLIC_GEMINI_API_KEY environment variable. Gemini features will fail.");
        throw new Error('API Key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
};

// Convert a File to the inlineData structure required by the Gemini API
export const fileToGenerativePart = async (file) => {
    const base64 = await fileToBase64(file);
    return {
        inlineData: {
            data: base64,
            mimeType: file.type || 'application/pdf',
        },
    };
};
