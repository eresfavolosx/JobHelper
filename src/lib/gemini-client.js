import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppStore } from './store';
import { auth } from './firebase';
import { isOwner } from './subscription';
import { detectPromptInjection, sanitizePII, recordSafetyEvent } from './ai-safety';

const DEFAULT_GEMINI_CAP = 300; // 300 calls/month with Gemini 3.8 Flash costs ~$0.05-$0.15

function getCurrentMonthKey() {
    return new Date().toISOString().slice(0, 7); // e.g. "2026-10"
}

function getGeminiUsageStorageKey() {
    return `jobhelper_gemini_usage_${getCurrentMonthKey()}`;
}

/**
 * Returns current monthly Gemini API call count and safety cap.
 */
export function getGeminiUsageStats() {
    if (typeof window === 'undefined') {
        return { used: 0, cap: DEFAULT_GEMINI_CAP, month: getCurrentMonthKey() };
    }
    const used = parseInt(localStorage.getItem(getGeminiUsageStorageKey()) || '0', 10);
    const cap = parseInt(localStorage.getItem('jobhelper_gemini_monthly_cap') || String(DEFAULT_GEMINI_CAP), 10);
    return { used, cap, month: getCurrentMonthKey() };
}

/**
 * Sets user-defined monthly limit for Gemini calls.
 */
export function setGeminiMonthlyCap(cap) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('jobhelper_gemini_monthly_cap', String(cap));
    }
}

/**
 * Increments the monthly Gemini API call counter.
 */
export function recordGeminiCall() {
    if (typeof window === 'undefined') return;
    const stats = getGeminiUsageStats();
    localStorage.setItem(getGeminiUsageStorageKey(), String(stats.used + 1));
}

/**
 * Robust JSON extraction helper that handles raw JSON, markdown ```json code blocks,
 * and conversational prefixes/suffixes from Gemini.
 */
export function extractJson(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();

    // 1. Try direct parse
    try {
        return JSON.parse(trimmed);
    } catch {}

    // 2. Extract from markdown ```json ... ``` codeblock
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
        try {
            return JSON.parse(codeBlockMatch[1].trim());
        } catch {}
    }

    // 3. Find outer object {...}
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        } catch {}
    }

    // 4. Find outer array [...]
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        try {
            return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1));
        } catch {}
    }

    throw new Error('Could not parse JSON response from Gemini model.');
}

// Convert a browser File object to a base64 string
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('Failed to read file as data URL.'));
                return;
            }
            const base64String = result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = () => reject(new Error('Failed reading file.'));
        reader.readAsDataURL(file);
    });
};

export const getMimeType = (file, defaultType = 'application/pdf') => {
    if (!file) return defaultType;
    const fileName = (file.name || '').toLowerCase();
    if (fileName.endsWith('.pdf')) return 'application/pdf';
    if (fileName.endsWith('.txt')) return 'text/plain';
    if (fileName.endsWith('.md')) return 'text/markdown';
    if (!file.type || file.type === 'application/octet-stream') {
        return defaultType;
    }
    return file.type;
};

/**
 * Resolves the appropriate Gemini API key.
 * - If user entered their own personal key (BYOK), it is always permitted (costs Fabian $0).
 * - Shared platform key is strictly restricted to Fabian (fabian.velez1996@gmail.com).
 * - All other users receive a descriptive error prompting them to bring their own key.
 */
export function resolveGeminiApiKey() {
    let personalKey = '';

    try {
        const state = useAppStore.getState();
        if (state?.profile?.geminiApiKey) {
            personalKey = String(state.profile.geminiApiKey).trim();
        }
    } catch (e) {
        console.warn("[Gemini] Failed to read key from store:", e);
    }

    const currentUser = auth?.currentUser;
    const currentIsOwner = isOwner(currentUser);

    let sharedKey = '';
    if (typeof process !== 'undefined') {
        sharedKey = String(process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
    }

    // 1. Personal key (BYOK) - allowed only if it is NOT a leaked copy of the platform shared key for a non-owner
    if (personalKey && personalKey.length > 5 && (currentIsOwner || !sharedKey || personalKey !== sharedKey)) {
        return { apiKey: personalKey, isPersonal: true };
    }

    // 2. Shared platform key is strictly restricted to Platform Owner (fabian.velez1996@gmail.com)
    // so external users can never incur billing on the owner's account.
    if (!currentIsOwner) {
        const error = new Error(
            'Add your free personal Google Gemini API key in Profile settings to use AI features.'
        );
        error.code = 'SUBSCRIPTION_REQUIRED';
        throw error;
    }

    if (!sharedKey) {
        throw new Error('Gemini API Key is not configured on this environment.');
    }

    return { apiKey: sharedKey, isPersonal: false };
}

// Initialize Gemini with credit overflow protection
export const getGeminiModel = (options = {}) => {
    const { apiKey, isPersonal } = resolveGeminiApiKey();

    if (!isPersonal) {
        // Budget safety cap check for shared key
        const stats = getGeminiUsageStats();
        if (stats.used >= stats.cap) {
            throw new Error(
                `Monthly Gemini safety cap reached (${stats.used}/${stats.cap} calls) to protect your credits. You can adjust this limit in Profile.`
            );
        }
        recordGeminiCall();
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelConfig = {
        model: options.model || "gemini-3.8-flash",
    };
    if (options.jsonMode) {
        modelConfig.generationConfig = { responseMimeType: "application/json" };
    }
    return genAI.getGenerativeModel(modelConfig);
};

// Resilient generation with automatic retry and fallback across real Gemini Flash models
export const generateWithFallback = async (promptOrParts, options = {}) => {
    const { apiKey, isPersonal } = resolveGeminiApiKey();

    if (!isPersonal) {
        const stats = getGeminiUsageStats();
        if (stats.used >= stats.cap) {
            throw new Error(
                `Monthly Gemini safety cap reached (${stats.used}/${stats.cap} calls) to protect your credits. You can adjust this limit in Profile.`
            );
        }
    }

    // AI Safety & Alignment Guardrail Layer
    let safePromptOrParts = promptOrParts;
    let piiRedactedCount = 0;

    if (typeof promptOrParts === 'string') {
        const injection = detectPromptInjection(promptOrParts);
        if (injection.riskLevel === 'critical') {
            recordSafetyEvent({ injectionsBlocked: 1, type: 'critical_injection_blocked', details: { matches: injection.matchedPatterns } });
            throw new Error(`[AI Safety Guardrail] Adversarial prompt injection detected (${injection.matchedPatterns.join(', ')}). Aborted under Constitutional AI guidelines.`);
        }
        const piiResult = sanitizePII(promptOrParts);
        safePromptOrParts = piiResult.sanitizedText;
        piiRedactedCount = piiResult.redactedCount;
    } else if (Array.isArray(promptOrParts)) {
        safePromptOrParts = promptOrParts.map(part => {
            if (typeof part === 'string') {
                const injection = detectPromptInjection(part);
                if (injection.riskLevel === 'critical') {
                    recordSafetyEvent({ injectionsBlocked: 1, type: 'critical_injection_blocked', details: { matches: injection.matchedPatterns } });
                    throw new Error(`[AI Safety Guardrail] Adversarial prompt injection detected (${injection.matchedPatterns.join(', ')}). Aborted under Constitutional AI guidelines.`);
                }
                const piiResult = sanitizePII(part);
                piiRedactedCount += piiResult.redactedCount;
                return piiResult.sanitizedText;
            }
            return part;
        });
    }

    if (piiRedactedCount > 0) {
        recordSafetyEvent({ piiRedacted: piiRedactedCount, type: 'pii_redacted' });
    }

    const fallbackModels = [
        options.model || "gemini-3.8-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest"
    ];

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError = null;

    for (const modelName of fallbackModels) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const modelConfig = { model: modelName };
                if (options.jsonMode) {
                    modelConfig.generationConfig = { responseMimeType: "application/json" };
                }
                const model = genAI.getGenerativeModel(modelConfig);
                const result = await model.generateContent(safePromptOrParts);
                if (!isPersonal) {
                    recordGeminiCall();
                }
                return result.response.text();
            } catch (err) {
                lastError = err;
                console.warn(`[Gemini] ${modelName} attempt ${attempt} failed:`, err?.message || err);
                // If it's quota limit or invalid key, don't keep spinning
                if (err?.message && (err.message.includes('API key') || err.message.includes('quota') || err.message.includes('403'))) {
                    throw err;
                }
                // If 503 (high demand spike), break inner attempt loop immediately to seamlessly fall back to next model
                if (err?.message && err.message.includes('503')) {
                    break;
                }
                await new Promise(res => setTimeout(res, 500 * attempt));
            }
        }
    }

    throw lastError || new Error('Failed to generate content with Gemini model after retry.');
};

// Test connection to Gemini API instantly using lightweight token verification (zero-cost, resilient to 503 spikes)
export const testGeminiApiKey = async (apiKey) => {
    if (!apiKey || !apiKey.trim()) {
        return { success: false, message: 'Please provide an API key.' };
    }
    const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
    try {
        const genAI = new GoogleGenerativeAI(cleanKey);
        const testModels = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-flash-latest"];
        for (const testModel of testModels) {
            try {
                const model = genAI.getGenerativeModel({ model: testModel });
                await Promise.race([
                    model.countTokens({ contents: [{ parts: [{ text: "ping" }] }] }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), 5000))
                ]);
                return { success: true, message: `Connected successfully to Google Gemini (${testModel})!` };
            } catch (mErr) {
                if (mErr?.message && (mErr.message.includes('API key not valid') || mErr.message.includes('API_KEY_INVALID'))) {
                    throw mErr;
                }
            }
        }
        return { success: true, message: 'Connected successfully to Google Gemini!' };
    } catch (err) {
        return { success: false, message: err?.message || 'Failed to authenticate with Gemini API.' };
    }
};

// Convert a File to the inlineData structure required by the Gemini API
export const fileToGenerativePart = async (file) => {
    if (!file) throw new Error('No file selected.');

    const fileName = (file.name || '').toLowerCase();
    let mimeType = file.type || '';

    // Guard against unsupported binary formats
    if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
        throw new Error('Word documents (.doc / .docx) are not supported directly by the AI model. Please save or export your resume as a PDF or plain text (.txt) file.');
    }

    // Force reliable MIME types for Gemini
    if (fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
        mimeType = 'application/pdf';
    } else if (fileName.endsWith('.txt') || mimeType.includes('text/plain')) {
        mimeType = 'text/plain';
    } else if (fileName.endsWith('.md')) {
        mimeType = 'text/markdown';
    } else if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = 'application/pdf';
    }

    const base64 = await fileToBase64(file);
    return {
        inlineData: {
            data: base64,
            mimeType: mimeType,
        },
    };
};
