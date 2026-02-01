const statusSelect = document.getElementById('statusSelect'); // ID was statusSelect in HTML? Let's check HTML.
// HTML line 47: id="statusSelect"
// HTML line 54: class="status" id="status" -> this is a div.
// So the select is statusSelect.

const saveBtn = document.getElementById('saveBtn');
const syncBtn = document.getElementById('syncBtn');

saveBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const h1 = document.querySelector('h1')?.innerText || document.title;
            const company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText
                || document.querySelector('[data-company-name]')?.innerText
                || '';

            return {
                title: h1,
                company: company,
                url: window.location.href
            };
        }
    }, (results) => {
        if (!results || !results[0]) return;
        const data = results[0].result;
        const status = statusSelect.value;

        const targetUrl = `http://localhost:3000/?action=auto-open&role=${encodeURIComponent(data.title)}&company=${encodeURIComponent(data.company)}&url=${encodeURIComponent(data.url)}&status=${status}`;
        chrome.tabs.create({ url: targetUrl });
    });
});

syncBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    syncBtn.innerText = "Scanning...";

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
    }, async (results) => {
        if (!results || !results[0]) {
            syncBtn.innerText = "Failed";
            return;
        }

        const text = results[0].result;

        try {
            const response = await fetch('http://localhost:3000/api/profile/parse-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error);

            const safePayload = {
                fullName: data.fullName,
                targetRole: data.targetRole,
                location: data.location,
                keywords: data.keywords,
                experienceLevel: data.experienceLevel
            };

            const paramStr = encodeURIComponent(JSON.stringify(safePayload));
            chrome.tabs.create({ url: `http://localhost:3000/profile?import=${paramStr}` });
            syncBtn.innerText = "Synced!";

        } catch (err) {
            console.error(err);
            syncBtn.innerText = "Error";
        }
    });
});
