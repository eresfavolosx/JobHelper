/**
 * Direct Gmail integration for NovuJobs.
 * Connects directly to the user's Gmail using Google OAuth (gmail.readonly scope),
 * searches for recent recruiter/job communications, and extracts snippets for AI pipeline analysis.
 */

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_STORAGE_KEY = 'novujobs_gmail_access_token';

/**
 * Returns the cached Gmail access token if available.
 */
export function getStoredGmailToken() {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(TOKEN_STORAGE_KEY);
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

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
        throw new Error('Google did not return an access token for Gmail.');
    }

    if (typeof window !== 'undefined') {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
        localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
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
    }
}

/**
 * Fetches recent recruiter and job application emails directly from the user's Gmail inbox.
 * Optionally focuses on specific companies being monitored (e.g. ghost alerts).
 */
export async function fetchRecentJobEmails(accessToken, daysBack = 14, targetCompanies = []) {
    if (!accessToken) {
        throw new Error('No Gmail access token provided. Please connect your Gmail account.');
    }

    const keywords = [
        'interview', 'application', 'offer', 'recruiter', 'rejection',
        '"next round"', '"technical screen"', '"application received"',
        '"schedule a time"', '"phone screen"', '"candidacy"', '"moving forward"',
        '"pleased to offer"', '"status of your application"', '"thank you for your interest"'
    ];

    let searchTerms = `(${keywords.join(' OR ')})`;

    // If specific companies are being called out, include them explicitly
    const validCompanies = (targetCompanies || [])
        .map(c => (typeof c === 'string' ? c.trim() : c?.company?.trim()))
        .filter(c => c && c.length > 1);

    if (validCompanies.length > 0) {
        const companyTerms = validCompanies.map(c => `"${c.replace(/"/g, '')}"`).join(' OR ');
        searchTerms = `(${keywords.join(' OR ')} OR (${companyTerms}))`;
    }

    const query = encodeURIComponent(`newer_than:${daysBack}d ${searchTerms}`);
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`;

    const listRes = await fetch(listUrl, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
        }
    });

    if (listRes.status === 401) {
        disconnectGmailAccount();
        throw new Error('Gmail session expired. Please reconnect your Gmail account.');
    }

    if (!listRes.ok) {
        const errJson = await listRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || 'Failed to list Gmail messages.');
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

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
