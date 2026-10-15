/**
 * Direct Gmail integration for NovuJobs.
 * Connects directly to the user's Gmail using Google OAuth (gmail.readonly scope),
 * searches for recent recruiter/job communications, and extracts snippets for AI pipeline analysis.
 */

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_STORAGE_KEY = 'novujobs_gmail_access_token';
const TOKEN_META_KEY = 'novujobs_gmail_access_token_meta';

/**
 * Returns the cached Gmail access token if available and not expired.
 */
export function getStoredGmailToken() {
    if (typeof window === 'undefined') return null;
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return null;

    // Check expiry (Google access tokens last 1 hour; use 55-minute buffer)
    try {
        const metaStr = localStorage.getItem(TOKEN_META_KEY);
        if (metaStr) {
            const meta = JSON.parse(metaStr);
            if (meta?.savedAt && Date.now() - meta.savedAt > 55 * 60 * 1000) {
                disconnectGmailAccount();
                return null;
            }
        }
    } catch {}

    return token;
}

/**
 * Initiates Google OAuth with Gmail read-only permissions to obtain an access token.
 */
export async function connectGmailAccount(auth) {
    if (!auth) throw new Error('Firebase auth not initialized.');

    const provider = new GoogleAuthProvider();
    provider.addScope(GMAIL_SCOPE);
    provider.setCustomParameters({
        prompt: 'consent',
        access_type: 'online'
    });

    let result;
    try {
        result = await signInWithPopup(auth, provider);
    } catch (popupErr) {
        if (popupErr.code === 'auth/popup-closed-by-user') {
            throw new Error('Google sign-in popup was closed before completing connection.');
        }
        if (popupErr.code === 'auth/popup-blocked') {
            throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
        }
        throw popupErr;
    }

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
        throw new Error('Google did not return an access token for Gmail.');
    }

    if (typeof window !== 'undefined') {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        localStorage.setItem(TOKEN_META_KEY, JSON.stringify({
            token: accessToken,
            savedAt: Date.now()
        }));
    }

    return {
        accessToken,
        user: result.user
    };
}

/**
 * Disconnects the stored Gmail token.
 */
export function disconnectGmailAccount() {
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(TOKEN_META_KEY);
    }
}

/**
 * Fetches recent recruiter and job application emails directly from the user's Gmail inbox.
 * Optionally focuses on specific companies being monitored (e.g. Atlassian, Google, etc.).
 *
 * @param {string} accessToken - Valid Google OAuth access token
 * @param {number} daysBack - Days back to query (defaults to 30 days)
 * @param {Array} targetCompanies - List of tracked company names
 */
export async function fetchRecentJobEmails(accessToken, daysBack = 30, targetCompanies = []) {
    if (!accessToken) {
        throw new Error('No Gmail access token provided. Please connect your Gmail account.');
    }

    const baseKeywords = [
        'interview', 'application', 'offer', 'recruiter', 'rejection',
        '"next round"', '"technical screen"', '"application received"',
        '"schedule a time"', '"phone screen"', '"candidacy"', '"moving forward"',
        '"pleased to offer"', '"status of your application"', '"thank you for your interest"'
    ];

    // Filter valid company names
    const validCompanies = (targetCompanies || [])
        .map(c => (typeof c === 'string' ? c.trim() : c?.company?.trim()))
        .filter(c => c && c.length > 1);

    // Build search queries:
    // Try targeted company search first, combined with recruiter keywords
    let searchTerms = baseKeywords.join(' OR ');
    if (validCompanies.length > 0) {
        const companyTerms = validCompanies.map(c => `"${c.replace(/"/g, '')}"`).join(' OR ');
        searchTerms = `(${baseKeywords.join(' OR ')}) OR (${companyTerms})`;
    }

    const query = encodeURIComponent(`newer_than:${daysBack}d (${searchTerms})`);
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=25`;

    let listRes;
    try {
        listRes = await fetch(listUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json'
            }
        });
    } catch {
        throw new Error('Network error querying Gmail. Check your internet connection or ad blocker.');
    }

    if (listRes.status === 401) {
        disconnectGmailAccount();
        throw new Error('Gmail session expired or authorization revoked. Please reconnect your Gmail account.');
    }

    if (listRes.status === 403) {
        const errJson = await listRes.json().catch(() => ({}));
        const msg = errJson?.error?.message || '';
        if (msg.includes('Gmail API has not been used') || msg.includes('disabled') || msg.includes('API has not been enabled')) {
            const error = new Error('The Gmail API is not yet enabled in your Google Cloud project (jobhelper-c3cd7). Please enable it in Google Cloud Console, or paste your email below to sync immediately.');
            error.code = 'GMAIL_API_DISABLED';
            error.enableUrl = 'https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=jobhelper-c3cd7';
            throw error;
        }
        if (msg.includes('insufficient') || msg.includes('scope')) {
            disconnectGmailAccount();
            const error = new Error('Gmail read permissions were not granted. Please reconnect and allow reading messages.');
            error.code = 'INSUFFICIENT_SCOPES';
            throw error;
        }
        throw new Error(msg || 'Gmail access permission denied (403). You can paste the email below to sync.');
    }

    if (!listRes.ok) {
        const errJson = await listRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Failed to list Gmail messages (${listRes.status}).`);
    }

    const listData = await listRes.json();
    let messages = listData.messages || [];

    // Fallback: If 0 messages found and companies were provided, broaden search to 60 days
    if (messages.length === 0 && validCompanies.length > 0) {
        const companyOnlyQuery = encodeURIComponent(`newer_than:60d (${validCompanies.map(c => `"${c.replace(/"/g, '')}"`).join(' OR ')})`);
        const fallbackUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${companyOnlyQuery}&maxResults=15`;
        try {
            const fallbackRes = await fetch(fallbackUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json'
                }
            });
            if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                if (fallbackData.messages && fallbackData.messages.length > 0) {
                    messages = fallbackData.messages;
                }
            }
        } catch {}
    }

    if (messages.length === 0) {
        return [];
    }

    // Fetch details/snippets for each message in parallel
    const emailPromises = messages.map(async (msg) => {
        try {
            const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
            const detailRes = await fetch(detailUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json'
                }
            });

            if (!detailRes.ok) return null;
            const detailData = await detailRes.json();

            const headers = detailData.payload?.headers || [];
            const getHeader = (name) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

            return {
                id: msg.id,
                snippet: detailData.snippet || '',
                subject: getHeader('Subject'),
                from: getHeader('From'),
                date: getHeader('Date')
            };
        } catch (e) {
            console.warn('[GmailService] Error fetching message detail:', e);
            return null;
        }
    });

    const results = await Promise.all(emailPromises);
    return results.filter(Boolean);
}
