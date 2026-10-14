const statusSelect = document.getElementById('statusSelect');
const saveBtn = document.getElementById('saveBtn');

// Configuration - Use the custom domain
const APP_URL = 'https://jobhelper.novu.works';

saveBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Update button to show loading state
    const originalText = saveBtn.innerText;
    saveBtn.innerText = 'Saving...';
    saveBtn.disabled = true;

    try {
        // Fallback to basic metadata scraping (no API key required)
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const doc = document;
                const title = doc.title || '';
                const url = window.location.href;

                let company = '';
                let location = '';
                let role = title;

                // LinkedIn
                const liCompany = doc.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name');
                const liLocation = doc.querySelector('.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet');
                if (liCompany) company = liCompany.innerText.trim();
                if (liLocation) location = liLocation.innerText.trim();

                // Indeed
                const indCompany = doc.querySelector('[data-testid="inlineHeader-companyName"]');
                const indLocation = doc.querySelector('[data-testid="inlineHeader-companyLocation"], [data-testid="job-location"]');
                if (indCompany) company = indCompany.innerText.trim();
                if (indLocation) location = indLocation.innerText.trim();

                // Greenhouse
                const ghCompany = doc.querySelector('.company-name');
                const ghLocation = doc.querySelector('.location');
                if (ghCompany) company = ghCompany.innerText.trim();
                if (ghLocation) location = ghLocation.innerText.trim();

                // Lever
                const leverCompany = doc.querySelector('.main-header-logo img')?.alt || '';
                const leverLocation = doc.querySelector('.posting-categories .location');
                if (leverCompany) company = leverCompany.trim();
                if (leverLocation) location = leverLocation.innerText.trim();

                // Fallback title parsing: "Role at Company" or "Company - Role"
                if (!company) {
                    if (title.includes(' at ')) {
                        const parts = title.split(' at ');
                        role = parts[0].trim();
                        company = parts[1].split('|')[0].split('-')[0].trim();
                    } else if (title.includes(' - ')) {
                        const parts = title.split(' - ');
                        if (parts.length >= 2) {
                            company = parts[0].trim();
                            role = parts[1].trim();
                        }
                    }
                }

                return {
                    title: role || title,
                    company: company || '',
                    location: location || '',
                    url: url
                };
            }
        }, (results) => {
            if (results?.[0]?.result) {
                const data = results[0].result;
                const status = statusSelect.value;
                const sanitizedDataUrl = sanitizeUrl(data.url) || '';
                let targetUrl = `${APP_URL}/?action=auto-open&role=${encodeURIComponent(data.title)}&url=${encodeURIComponent(sanitizedDataUrl)}&status=${status}`;
                if (data.company) targetUrl += `&company=${encodeURIComponent(data.company)}`;
                if (data.location) targetUrl += `&location=${encodeURIComponent(data.location)}`;
                chrome.tabs.create({ url: targetUrl });
            }
        });
    } catch (error) {
        console.error('Failed to parse page:', error);
        alert('Failed to parse page details.');
    } finally {
        saveBtn.innerText = originalText;
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
