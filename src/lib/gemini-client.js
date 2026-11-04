import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppStore } from './store.js';
import { auth } from './firebase.js';
import { isOwner } from './subscription.js';
import { detectPromptInjection, sanitizePII, recordSafetyEvent } from './ai-safety.js';

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
 * Resolves the available AI providers and user keys from state and environment.
 */
export function getAvailableAiProviders() {
    let profile = {};
    try {
        profile = useAppStore.getState()?.profile || {};
    } catch {}

    const currentUser = auth?.currentUser;
    const currentIsOwner = isOwner(currentUser);

    let envGemini = '';
    if (typeof process !== 'undefined') {
        envGemini = String(process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
    }

    const hasGemini = Boolean(
        (profile.geminiApiKey && profile.geminiApiKey.trim().length > 5) ||
        (currentIsOwner && envGemini)
    );
    const hasClaude = Boolean(profile.claudeApiKey && profile.claudeApiKey.trim().length > 5);
    const hasOpenAI = Boolean(profile.openaiApiKey && profile.openaiApiKey.trim().length > 5);
    const hasCustom = Boolean(profile.customAiApiKey && profile.customAiApiKey.trim().length > 5 && profile.customAiBaseUrl);

    let active = profile.activeAiProvider || 'gemini';
    // If active is unset or unconfigured, default gracefully to the first configured provider
    if (active === 'gemini' && !hasGemini) {
        if (hasClaude) active = 'claude';
        else if (hasOpenAI) active = 'openai';
        else if (hasCustom) active = 'custom';
    } else if (active === 'claude' && !hasClaude) {
        if (hasGemini) active = 'gemini';
        else if (hasOpenAI) active = 'openai';
    } else if (active === 'openai' && !hasOpenAI) {
        if (hasGemini) active = 'gemini';
        else if (hasClaude) active = 'claude';
    }

    return {
        active,
        hasGemini,
        hasClaude,
        hasOpenAI,
        hasCustom,
        geminiKey: profile.geminiApiKey?.trim() || (currentIsOwner ? envGemini : ''),
        claudeKey: profile.claudeApiKey?.trim() || '',
        openaiKey: profile.openaiApiKey?.trim() || '',
        customKey: profile.customAiApiKey?.trim() || '',
        customBaseUrl: profile.customAiBaseUrl?.trim() || '',
        customModel: profile.customAiModel?.trim() || ''
    };
}

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

// Internal runner: Anthropic Claude (claude-3-5-sonnet / claude-3-5-haiku / claude-3-7-sonnet)
async function generateClaudeContent(safePromptOrParts, options = {}, claudeKey) {
    if (!claudeKey) {
        throw new Error('Anthropic Claude API Key is not configured. Please add it in Profile settings.');
    }

    let contentBlocks = [];
    if (typeof safePromptOrParts === 'string') {
        contentBlocks = [{ type: 'text', text: safePromptOrParts }];
    } else if (Array.isArray(safePromptOrParts)) {
        for (const part of safePromptOrParts) {
            if (typeof part === 'string') {
                contentBlocks.push({ type: 'text', text: part });
            } else if (part?.inlineData) {
                const { mimeType, data } = part.inlineData;
                if (mimeType === 'application/pdf') {
                    contentBlocks.push({
                        type: 'document',
                        source: {
                            type: 'base64',
                            media_type: 'application/pdf',
                            data: data
                        }
                    });
                } else if (mimeType?.startsWith('image/')) {
                    contentBlocks.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimeType,
                            data: data
                        }
                    });
                } else {
                    // Plain text / markdown document
                    try {
                        const decoded = typeof atob !== 'undefined' ? atob(data) : Buffer.from(data, 'base64').toString('utf8');
                        contentBlocks.push({ type: 'text', text: decoded });
                    } catch {
                        contentBlocks.push({ type: 'text', text: data });
                    }
                }
            }
        }
    }

    const systemPrompt = options.jsonMode
        ? 'You are an expert AI assistant. Output ONLY valid, parseable JSON conforming strictly to the requested schema. Do not enclose the output in Markdown codeblocks (no ```json). Do not include any introduction, conversational text, or explanation.'
        : undefined;

    const modelsToTry = [
        options.model || 'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-7-sonnet-20250219'
    ];

    let lastErr = null;
    for (const model of modelsToTry) {
        try {
            const bodyPayload = {
                model,
                max_tokens: options.maxTokens || 4096,
                messages: [{ role: 'user', content: contentBlocks }]
            };
            if (systemPrompt) bodyPayload.system = systemPrompt;

            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': claudeKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();
            if (!res.ok) {
                const msg = data.error?.message || `Claude API error HTTP ${res.status}`;
                throw new Error(msg);
            }

            const text = data.content?.map(c => c.text).filter(Boolean).join('\n') || '';
            return text;
        } catch (err) {
            lastErr = err;
            console.warn(`[Claude] Model ${model} failed:`, err?.message || err);
            if (err?.message && (err.message.includes('credit balance') || err.message.includes('invalid x-api-key') || err.message.includes('authentication'))) {
                throw err;
            }
        }
    }
    throw lastErr || new Error('Failed to generate response with Anthropic Claude.');
}

// Internal runner: OpenAI ChatGPT & Custom OpenAI-Compatible (GPT-4o, DeepSeek, Groq, OpenRouter)
async function generateOpenAIContent(safePromptOrParts, options = {}, apiKey, endpoint = 'https://api.openai.com/v1/chat/completions', defaultModel = 'gpt-4o', isCustom = false) {
    if (!apiKey) {
        throw new Error(`${isCustom ? 'Custom Provider' : 'OpenAI'} API Key is not configured. Please add it in Profile settings.`);
    }

    let userContent = [];
    if (typeof safePromptOrParts === 'string') {
        userContent = safePromptOrParts;
    } else if (Array.isArray(safePromptOrParts)) {
        userContent = [];
        for (const part of safePromptOrParts) {
            if (typeof part === 'string') {
                userContent.push({ type: 'text', text: part });
            } else if (part?.inlineData) {
                const { mimeType, data } = part.inlineData;
                if (mimeType?.startsWith('image/')) {
                    userContent.push({
                        type: 'image_url',
                        image_url: { url: `data:${mimeType};base64,${data}` }
                    });
                } else {
                    // Documents or plain text base64
                    try {
                        const decoded = typeof atob !== 'undefined' ? atob(data) : Buffer.from(data, 'base64').toString('utf8');
                        userContent.push({ type: 'text', text: `[Attached Document Content (${mimeType})]:\n${decoded}` });
                    } catch {
                        userContent.push({ type: 'text', text: `[Attached Document Base64 (${mimeType})]:\n${data}` });
                    }
                }
            }
        }
    }

    const messages = [];
    if (options.jsonMode) {
        messages.push({
            role: 'system',
            content: 'You are an expert AI assistant. Output ONLY valid, parseable JSON conforming strictly to the requested schema. No markdown formatting.'
        });
    }
    messages.push({ role: 'user', content: userContent });

    const modelsToTry = isCustom
        ? [defaultModel || 'gpt-4o-mini']
        : [options.model || defaultModel, 'gpt-4o-mini', 'o3-mini'];

    let lastErr = null;
    for (const model of modelsToTry) {
        try {
            const bodyPayload = {
                model,
                messages,
                temperature: options.temperature ?? 0.7
            };
            if (options.jsonMode && !isCustom) {
                bodyPayload.response_format = { type: 'json_object' };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();
            if (!res.ok) {
                const msg = data.error?.message || `API error HTTP ${res.status}`;
                throw new Error(msg);
            }

            const text = data.choices?.[0]?.message?.content || '';
            return text;
        } catch (err) {
            lastErr = err;
            console.warn(`[OpenAI/Compatible] Model ${model} failed:`, err?.message || err);
            if (err?.message && (err.message.includes('Incorrect API key') || err.message.includes('insufficient_quota'))) {
                throw err;
            }
        }
    }
    throw lastErr || new Error(`Failed to generate response with ${isCustom ? 'Custom Provider' : 'OpenAI'}.`);
}

// Internal runner: Google Gemini Flash with fallback models
async function generateGeminiInternal(safePromptOrParts, options = {}) {
    const { apiKey, isPersonal } = resolveGeminiApiKey();

    if (!isPersonal) {
        const stats = getGeminiUsageStats();
        if (stats.used >= stats.cap) {
            throw new Error(
                `Monthly Gemini safety cap reached (${stats.used}/${stats.cap} calls) to protect your credits. You can adjust this limit in Profile.`
            );
        }
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
                if (err?.message && (err.message.includes('API key') || err.message.includes('quota') || err.message.includes('403'))) {
                    throw err;
                }
                if (err?.message && err.message.includes('503')) {
                    break;
                }
                await new Promise(res => setTimeout(res, 500 * attempt));
            }
        }
    }

    throw lastError || new Error('Failed to generate content with Gemini model after retry.');
}

// Multi-Provider Resilient AI Generation: Routes to Gemini, Claude, OpenAI, or Custom Provider
export const generateWithFallback = async (promptOrParts, options = {}) => {
    // 1. AI Safety & Alignment Guardrail Layer (Constitutional AI across all providers)
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

    // 2. Resolve Active AI Provider & Available Keys
    const providers = getAvailableAiProviders();
    const active = providers.active;

    // Dispatch according to active engine, with graceful fallbacks
    if (active === 'claude' && providers.hasClaude) {
        try {
            return await generateClaudeContent(safePromptOrParts, options, providers.claudeKey);
        } catch (claudeErr) {
            console.warn('[AI Provider] Primary provider Claude failed, checking fallbacks:', claudeErr?.message || claudeErr);
            if (providers.hasGemini) {
                return await generateGeminiInternal(safePromptOrParts, options);
            } else if (providers.hasOpenAI) {
                return await generateOpenAIContent(safePromptOrParts, options, providers.openaiKey);
            }
            throw claudeErr;
        }
    }

    if (active === 'openai' && providers.hasOpenAI) {
        try {
            return await generateOpenAIContent(safePromptOrParts, options, providers.openaiKey);
        } catch (openAiErr) {
            console.warn('[AI Provider] Primary provider OpenAI failed, checking fallbacks:', openAiErr?.message || openAiErr);
            if (providers.hasGemini) {
                return await generateGeminiInternal(safePromptOrParts, options);
            } else if (providers.hasClaude) {
                return await generateClaudeContent(safePromptOrParts, options, providers.claudeKey);
            }
            throw openAiErr;
        }
    }

    if (active === 'custom' && providers.hasCustom) {
        try {
            const endpoint = `${providers.customBaseUrl.replace(/\/+$/, '')}/chat/completions`;
            return await generateOpenAIContent(safePromptOrParts, options, providers.customKey, endpoint, providers.customModel, true);
        } catch (customErr) {
            console.warn('[AI Provider] Primary custom provider failed, checking fallbacks:', customErr?.message || customErr);
            if (providers.hasGemini) {
                return await generateGeminiInternal(safePromptOrParts, options);
            }
            throw customErr;
        }
    }

    // Default: Gemini Flash with fallback models
    try {
        return await generateGeminiInternal(safePromptOrParts, options);
    } catch (geminiErr) {
        console.warn('[AI Provider] Gemini failed, checking alternative configured providers:', geminiErr?.message || geminiErr);
        if (providers.hasClaude) {
            return await generateClaudeContent(safePromptOrParts, options, providers.claudeKey);
        }
        if (providers.hasOpenAI) {
            return await generateOpenAIContent(safePromptOrParts, options, providers.openaiKey);
        }
        throw geminiErr;
    }
};

// Test connection to Anthropic Claude
export const testClaudeApiKey = async (apiKey) => {
    if (!apiKey || !apiKey.trim()) {
        return { success: false, message: 'Please provide a Claude API key.' };
    }
    const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': cleanKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'ping' }]
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
            return { success: false, message: msg };
        }
        return { success: true, message: 'Connected successfully to Anthropic Claude (claude-3-5-haiku)!' };
    } catch (err) {
        return { success: false, message: err?.message || 'Failed to connect to Claude API.' };
    }
};

// Test connection to OpenAI (ChatGPT)
export const testOpenAiApiKey = async (apiKey) => {
    if (!apiKey || !apiKey.trim()) {
        return { success: false, message: 'Please provide an OpenAI API key.' };
    }
    const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
    try {
        const res = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cleanKey}`
            }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
            return { success: false, message: msg };
        }
        return { success: true, message: 'Connected successfully to OpenAI (ChatGPT)!' };
    } catch (err) {
        return { success: false, message: err?.message || 'Failed to connect to OpenAI API.' };
    }
};

// Test connection to custom OpenAI-compatible provider
export const testCustomAiProvider = async (baseUrl, apiKey, model) => {
    if (!baseUrl || !baseUrl.trim()) {
        return { success: false, message: 'Please provide a Base URL (e.g. https://api.deepseek.com/v1).' };
    }
    if (!apiKey || !apiKey.trim()) {
        return { success: false, message: 'Please provide an API key.' };
    }
    const cleanUrl = baseUrl.trim().replace(/\/+$/, '');
    const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
    const cleanModel = (model || '').trim() || 'default';

    try {
        const res = await fetch(`${cleanUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`
            },
            body: JSON.stringify({
                model: cleanModel,
                max_tokens: 5,
                messages: [{ role: 'user', content: 'ping' }]
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
            return { success: false, message: msg };
        }
        return { success: true, message: `Connected successfully to custom provider (${cleanModel})!` };
    } catch (err) {
        return { success: false, message: err?.message || 'Failed to connect to custom provider.' };
    }
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
