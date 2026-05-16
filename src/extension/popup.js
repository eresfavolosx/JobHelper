import { getApiKey, saveApiKey } from './storage.js';

const statusSelect = document.getElementById('statusSelect');
const saveBtn = document.getElementById('saveBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiKeyContainer = document.getElementById('apiKeyContainer');
const toggleKeyBtn = document.getElementById('toggleKeyBtn');

// Configuration - Use the live Firebase Hosting URL
const APP_URL = 'https://jobhelper-c3cd7.web.app';

// Load stored API key securely
getApiKey((key) => {
    if (key) {
        apiKeyInput.value = key;
    }
});

// Toggle API key visibility
toggleKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleKeyBtn.innerText = 'Hide';
        toggleKeyBtn.setAttribute('aria-label', 'Hide API key');
        toggleKeyBtn.setAttribute('title', 'Hide API key');
    } else {
        apiKeyInput.type = 'password';
        toggleKeyBtn.innerText = 'Show';
        toggleKeyBtn.setAttribute('aria-label', 'Show API key');
        toggleKeyBtn.setAttribute('title', 'Show API key');
    }
});

saveBtn.addEventListener('click', async () => {
    const originalText = saveBtn.innerText;
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        saveBtn.innerText = 'API Key Required';
        saveBtn.style.background = '#ef4444';
        saveBtn.disabled = true;
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.style.background = '';
            saveBtn.disabled = false;
        }, 2000);
        return;
    }

    // Save key securely for next time
    saveApiKey(apiKey);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Update button to show loading state
    saveBtn.innerText = 'Analysing Page...';
    saveBtn.disabled = true;

    try {
        // 1. Get the page text content
        const [{ result: pageData }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // Get visible text content, clean it up
                const bodyText = document.body.innerText
                    .replace(/\s+/g, ' ')
                    .substring(0, 10000); // Limit context size
                return {
                    text: bodyText,
                    url: window.location.href,
                    title: document.title
                };
            }
        });

        // 2. Call Gemini API directly from Extension
        console.log('--- [JobTracker] Extension Debug Log ---');
        console.log('1. Page Context Captured:', pageData.text.substring(0, 100) + '...');
        console.log('2. Sending to Gemini API (gemini-2.0-flash)...');

        const extraction = await callGeminiAPI(apiKey, pageData.text);

        console.log('3. Gemini Response:', extraction);
        console.log('----------------------------------------');

        // 3. Open the app with extracted data
        const status = statusSelect.value;
        const sanitizedPageUrl = sanitizeUrl(pageData.url) || '';
        const targetUrl = `${APP_URL}/?action=auto-open&role=${encodeURIComponent(extraction.role || pageData.title)}&company=${encodeURIComponent(extraction.company || '')}&salary=${encodeURIComponent(extraction.salary || '')}&location=${encodeURIComponent(extraction.location || '')}&description=${encodeURIComponent(extraction.description || '')}&url=${encodeURIComponent(sanitizedPageUrl)}&status=${status}`;

        chrome.tabs.create({ url: targetUrl });

        saveBtn.innerText = originalText;
        saveBtn.disabled = false;

    } catch (error) {
        console.error('Extraction failed:', error);
        saveBtn.innerText = 'Extraction Failed';
        saveBtn.style.background = '#ef4444';
        saveBtn.disabled = true;
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.style.background = '';
            saveBtn.disabled = false;
        }, 2000);

        // Fallback
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
                title: document.title,
                url: window.location.href
            })
        }, (results) => {
            if (results?.[0]?.result) {
                const data = results[0].result;
                const status = statusSelect.value;
                const sanitizedDataUrl = sanitizeUrl(data.url) || '';
                const targetUrl = `${APP_URL}/?action=auto-open&role=${encodeURIComponent(data.title)}&url=${encodeURIComponent(sanitizedDataUrl)}&status=${status}`;
                chrome.tabs.create({ url: targetUrl });
            }
        });
    }
});

/**
 * Local copy of sanitizeUrl since we can't easily import from the Next.js app
 * in this simple extension architecture.
 */
function sanitizeUrl(url) {
    if (!url) return null;
    let stringUrl = String(url).trim();

    if (stringUrl.length > 2048) return null;


    if (stringUrl.toLowerCase().startsWith('javascript:')) return null;
    if (stringUrl.toLowerCase().startsWith('vbscript:')) return null;
    if (stringUrl.toLowerCase().startsWith('data:')) return null;

    let parsed;
    try {
        parsed = new URL(stringUrl);
    } catch {
        try {
            parsed = new URL('https://' + stringUrl);
        } catch {
            return null;
        }
    }

    if (['http:', 'https:'].includes(parsed.protocol)) {
        return parsed.toString();
    }
    return null;
}

async function callGeminiAPI(apiKey, text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `
        Extract the following job details from the text below. Return ONLY a valid JSON object.
        Fields: company, role, salary, location, description (short summary, max 200 chars).
        If a field is not found, use empty string.
        
        Text:
        ${text}
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;

    // Clean markdown code blocks if present
    const jsonString = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
}
