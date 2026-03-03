/**
 * Securely retrieves the API key from local storage.
 * Includes a migration path from insecure sync storage.
 */
export function getApiKey(callback) {
    chrome.storage.local.get(['geminiApiKey'], (localResult) => {
        if (localResult.geminiApiKey) {
            callback(localResult.geminiApiKey);
        } else {
            // Check legacy insecure sync storage
            chrome.storage.sync.get(['geminiApiKey'], (syncResult) => {
                if (syncResult.geminiApiKey) {
                    // Migrate key securely and remove from sync
                    chrome.storage.local.set({ geminiApiKey: syncResult.geminiApiKey });
                    chrome.storage.sync.remove('geminiApiKey');
                    callback(syncResult.geminiApiKey);
                } else {
                    callback(null);
                }
            });
        }
    });
}

/**
 * Saves the API key securely to local storage.
 */
export function saveApiKey(apiKey) {
    chrome.storage.local.set({ geminiApiKey: apiKey });
}
