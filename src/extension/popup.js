const statusSelect = document.getElementById('statusSelect');
const saveBtn = document.getElementById('saveBtn');

// Configuration - Use the live Firebase Hosting URL
const APP_URL = 'https://jobhelper-c3cd7.web.app';

saveBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Update button to show loading state
    const originalText = saveBtn.innerText;
    saveBtn.innerText = 'Extracting...';
    saveBtn.disabled = true;

    try {
        // First, get the page text content
        const [{ result: pageData }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // Get visible text content, limit to reasonable size
                const bodyText = document.body.innerText.substring(0, 8000);
                return {
                    text: bodyText,
                    url: window.location.href
                };
            }
        });

        // Call AI extraction API on the live server
        const response = await fetch(`${APP_URL}/api/extract-job`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pageText: pageData.text,
                pageUrl: pageData.url
            })
        });

        const extracted = await response.json();
        const status = statusSelect.value;

        // Open the app with extracted data
        const targetUrl = `${APP_URL}/?action=auto-open&role=${encodeURIComponent(extracted.jobTitle || '')}&company=${encodeURIComponent(extracted.company || '')}&url=${encodeURIComponent(pageData.url)}&status=${status}`;
        chrome.tabs.create({ url: targetUrl });

    } catch (error) {
        console.error('Extraction failed:', error);
        // Fallback to basic extraction if AI fails
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
                title: document.querySelector('h1')?.innerText || document.title.split(' | ')[0],
                company: '',
                url: window.location.href
            })
        }, (results) => {
            if (results?.[0]?.result) {
                const data = results[0].result;
                const status = statusSelect.value;
                const targetUrl = `${APP_URL}/?action=auto-open&role=${encodeURIComponent(data.title)}&company=${encodeURIComponent(data.company)}&url=${encodeURIComponent(data.url)}&status=${status}`;
                chrome.tabs.create({ url: targetUrl });
            }
        });
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
});
