const statusSelect = document.getElementById('statusSelect'); // ID was statusSelect in HTML? Let's check HTML.
// HTML line 47: id="statusSelect"
// HTML line 54: class="status" id="status" -> this is a div.
// So the select is statusSelect.

const saveBtn = document.getElementById('saveBtn');


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


