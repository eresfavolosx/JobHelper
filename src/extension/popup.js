const roleInput = document.getElementById('roleInput');
const companyInput = document.getElementById('companyInput');
const locationInput = document.getElementById('locationInput');
const resumeUrlInput = document.getElementById('resumeUrlInput');
const resumeNameInput = document.getElementById('resumeNameInput');
const statusSelect = document.getElementById('statusSelect');
const saveBtn = document.getElementById('saveBtn');
const statusNote = document.getElementById('statusNote');

// Configuration - Use the custom domain
const APP_URL = 'https://jobhelper.novu.works';

let activeTabUrl = '';

/**
 * Cleans scraped text from job boards (LinkedIn, Indeed, Greenhouse, Lever, Workday)
 * to strip weird symbols, UTF-8/Windows-1252 mojibake, zero-width/bidi control characters,
 * private-use icon font glyphs, HTML entities, and duplicated screen-reader text.
 */
function cleanScrapedText(raw) {
    if (!raw) return '';
    let text = String(raw);

    // 1. Replace common UTF-8 / Windows-1252 mojibake sequences
    const mojibakeMap = [
        [/â€”/g, ' - '],
        [/â€“/g, '-'],
        [/â€™/g, "'"],
        [/â€˜/g, "'"],
        [/â€œ/g, '"'],
        [/â€\u009d/g, '"'],
        [/â€¦/g, '...'],
        [/Â·/g, ' '],
        [/â€¢/g, ' '],
        [/Â /g, ' '],
        [/Â/g, ''],
        [/ðŸš€/g, ''],
    ];
    for (const [pattern, replacement] of mojibakeMap) {
        text = text.replace(pattern, replacement);
    }

    // 2. Decode common HTML entities
    const entityMap = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#x27;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
        '&ndash;': '-',
        '&mdash;': ' - ',
        '&bull;': ' ',
        '&middot;': ' '
    };
    text = text.replace(/&(amp|lt|gt|quot|#39|#x27|apos|nbsp|ndash|mdash|bull|middot);/gi, (match) => {
        return entityMap[match.toLowerCase()] ?? match;
    });

    // 3. Strip zero-width characters, directional marks, soft hyphens, replacement chars, and Private Use Area icon glyphs
    text = text.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\uFFFD\uE000-\uF8FF]/g, '');

    // 4. Strip leading notification badge counts from page titles, e.g. "(3) Senior Engineer" or "(20+) "
    text = text.replace(/^\(\d+\+?\)\s*/, '');

    // 5. Strip leading/trailing bullet characters or pipe separators
    text = text.replace(/^[\s•·|‣⁃\-–—]+|[\s•·|‣⁃\-–—]+$/g, '');

    // 6. Collapse repeated whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // 7. Deduplicate exact repeated halves (e.g. LinkedIn aria-hidden + visually-hidden span duplication: "StripeStripe" or "Stripe Stripe")
    if (text.length >= 4) {
        const half = Math.floor(text.length / 2);
        const firstHalf = text.slice(0, half).trim();
        const secondHalf = text.slice(half).trim();
        if (firstHalf && firstHalf === secondHalf) {
            text = firstHalf;
        }
    }

    return text;
}

/**
 * Injected into the active tab to extract raw job metadata safely.
 */
function scrapeActivePageDom() {
    const doc = document;
    const rawTitle = doc.title || '';
    const url = window.location.href;

    const getCleanElementText = (el) => {
        if (!el) return '';
        // Prefer aria-hidden span if LinkedIn duplicated the node for screen readers
        const ariaHidden = el.querySelector('[aria-hidden="true"]');
        if (ariaHidden && ariaHidden.textContent && ariaHidden.textContent.trim()) {
            return ariaHidden.textContent.trim();
        }
        // Clone node and remove screen-reader-only / visually-hidden / icon elements before reading text
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.visually-hidden, .sr-only, [class*="artdeco-icon"], svg, script, style').forEach(n => n.remove());
        return (clone.textContent || el.innerText || '').trim();
    };

    let company = '';
    let location = '';
    let role = '';

    // LinkedIn Job View / Collections
    const liRole = doc.querySelector(
        '.job-details-jobs-unified-top-card__job-title h1, .job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.top-card-layout__title'
    );
    const liCompany = doc.querySelector(
        '.job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name, .topcard__org-name-link'
    );
    const liLocation = doc.querySelector(
        '.job-details-jobs-unified-top-card__primary-description-container .tvm__text, .job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet, .topcard__flavor--bullet'
    );
    if (liRole) role = getCleanElementText(liRole);
    if (liCompany) company = getCleanElementText(liCompany);
    if (liLocation) location = getCleanElementText(liLocation);

    // Indeed
    const indRole = doc.querySelector('[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title');
    const indCompany = doc.querySelector('[data-testid="inlineHeader-companyName"]');
    const indLocation = doc.querySelector('[data-testid="inlineHeader-companyLocation"], [data-testid="job-location"]');
    if (!role && indRole) role = getCleanElementText(indRole);
    if (!company && indCompany) company = getCleanElementText(indCompany);
    if (!location && indLocation) location = getCleanElementText(indLocation);

    // Greenhouse
    const ghRole = doc.querySelector('.app-title, h1.section-header');
    const ghCompany = doc.querySelector('.company-name');
    const ghLocation = doc.querySelector('.location');
    if (!role && ghRole) role = getCleanElementText(ghRole);
    if (!company && ghCompany) company = getCleanElementText(ghCompany);
    if (!location && ghLocation) location = getCleanElementText(ghLocation);

    // Lever
    const leverRole = doc.querySelector('.posting-headline h2');
    const leverCompany = doc.querySelector('.main-header-logo img')?.alt || '';
    const leverLocation = doc.querySelector('.posting-categories .location');
    if (!role && leverRole) role = getCleanElementText(leverRole);
    if (!company && leverCompany) company = leverCompany.trim();
    if (!location && leverLocation) location = getCleanElementText(leverLocation);

    // Fallback title parsing
    let cleanedTitle = rawTitle.replace(/^\(\d+\+?\)\s*/, '').trim();
    // Strip trailing site suffixes like "| LinkedIn", "- Indeed.com", "| Glassdoor"
    cleanedTitle = cleanedTitle.replace(/\s*[|\-–—]\s*(LinkedIn|Indeed(\.com)?|Glassdoor|Greenhouse|Lever|Workday|Wellfound|Built In.*|ZipRecruiter)$/i, '').trim();

    if (!role) {
        role = cleanedTitle;
    }

    if (!company) {
        if (cleanedTitle.includes(' at ')) {
            const parts = cleanedTitle.split(' at ');
            if (!liRole) role = parts[0].trim();
            company = parts.slice(1).join(' at ').split('|')[0].split(' - ')[0].trim();
        } else if (cleanedTitle.includes(' | ')) {
            const parts = cleanedTitle.split(' | ');
            if (parts.length >= 2) {
                role = parts[0].trim();
                company = parts[1].trim();
            }
        } else if (cleanedTitle.includes(' - ')) {
            const parts = cleanedTitle.split(' - ');
            if (parts.length >= 2) {
                role = parts[0].trim();
                company = parts[1].trim();
            }
        }
    }

    return {
        title: role || cleanedTitle,
        company: company || '',
        location: location || '',
        url: url
    };
}

async function initPopup() {
    // Restore last-used resume link, label, and stage so rapid daily applying requires 0 re-pasting
    try {
        const lastResumeUrl = localStorage.getItem('novujobs_last_resume_url');
        const lastResumeName = localStorage.getItem('novujobs_last_resume_name');
        const lastStatus = localStorage.getItem('novujobs_last_status');
        if (lastResumeUrl && resumeUrlInput) resumeUrlInput.value = lastResumeUrl;
        if (lastResumeName && resumeNameInput) resumeNameInput.value = lastResumeName;
        if (lastStatus && statusSelect) statusSelect.value = lastStatus;
    } catch {}

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            statusNote.textContent = 'Ready to save job details.';
            return;
        }
        activeTabUrl = tab.url || '';

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                func: scrapeActivePageDom
            },
            (results) => {
                if (chrome.runtime.lastError || !results?.[0]?.result) {
                    // Fallback to tab title if scripting is restricted on the current tab
                    roleInput.value = cleanScrapedText(tab.title || '');
                    statusNote.textContent = 'Review details below before saving.';
                    return;
                }
                const data = results[0].result;
                roleInput.value = cleanScrapedText(data.title);
                companyInput.value = cleanScrapedText(data.company);
                locationInput.value = cleanScrapedText(data.location);
                if (data.url) activeTabUrl = data.url;
                statusNote.textContent = 'Details cleaned & ready to save.';
            }
        );
    } catch {
        statusNote.textContent = 'Enter or adjust details below.';
    }
}

document.addEventListener('DOMContentLoaded', initPopup);

saveBtn.addEventListener('click', async () => {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Opening NovuJobs...';
    saveBtn.disabled = true;

    try {
        const cleanRole = cleanScrapedText(roleInput.value) || 'Untitled Role';
        const cleanCompany = cleanScrapedText(companyInput.value);
        const cleanLocation = cleanScrapedText(locationInput.value);
        const cleanResumeUrl = sanitizeUrl(resumeUrlInput.value) || '';
        const cleanResumeName = cleanScrapedText(resumeNameInput ? resumeNameInput.value : '');
        const status = statusSelect.value || 'applied';
        const sanitizedJobUrl = sanitizeUrl(activeTabUrl) || '';

        try {
            localStorage.setItem('novujobs_last_resume_url', cleanResumeUrl);
            localStorage.setItem('novujobs_last_resume_name', cleanResumeName);
            localStorage.setItem('novujobs_last_status', status);
        } catch {}

        let targetUrl = `${APP_URL}/?action=auto-open&role=${encodeURIComponent(cleanRole)}&url=${encodeURIComponent(sanitizedJobUrl)}&status=${encodeURIComponent(status)}`;
        if (cleanCompany) targetUrl += `&company=${encodeURIComponent(cleanCompany)}`;
        if (cleanLocation) targetUrl += `&location=${encodeURIComponent(cleanLocation)}`;
        if (cleanResumeUrl) targetUrl += `&resumeUrl=${encodeURIComponent(cleanResumeUrl)}`;
        if (cleanResumeName) targetUrl += `&resumeName=${encodeURIComponent(cleanResumeName)}`;

        chrome.tabs.create({ url: targetUrl });
    } catch (error) {
        console.error('Failed to save job:', error);
        statusNote.textContent = 'Could not open NovuJobs tab.';
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
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
