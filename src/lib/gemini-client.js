import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppStore } from './store';

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
    let apiKey = '';

    // 1. Try to get key from user settings (secure, per-user)
    try {
        const state = useAppStore.getState();
        if (state.profile && state.profile.geminiApiKey) {
            apiKey = state.profile.geminiApiKey;
        }
    } catch (e) {
        console.warn("[Gemini] Failed to read key from store:", e);
    }

    // 2. Fallback to environment variable (legacy/dev)
    if (!apiKey) {
        apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    }

    if (!apiKey) {
        console.error("Missing Gemini API Key. Please set it in Settings or provide NEXT_PUBLIC_GEMINI_API_KEY.");
        throw new Error('API Key not configured. Please add your Gemini API Key in Profile settings.');
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
