## 2026-02-23 - Exposed Secrets in Extension Sync Storage
**Vulnerability:** The Chrome extension stored the Gemini API Key in `chrome.storage.sync` by default. This exposes secrets across the user's synced devices and can leak plaintext keys depending on their Google Sync settings.
**Learning:** Keys and sensitive credentials should never be stored in `chrome.storage.sync`. They should be kept exclusively in `chrome.storage.local`. Furthermore, migrations from insecure to secure stores should remove the old key entirely.
**Prevention:** Default to `chrome.storage.local` for any sensitive API keys or auth tokens.
## 2026-03-09 - Insecure Storage of API Keys in Browser Extension
**Vulnerability:** The Gemini API Key was being stored in `chrome.storage.sync`. By default, Chrome sync storage synchronizes data in plaintext across the user's signed-in devices, posing a significant risk of credential exposure.
**Learning:** Browser extension sync storage is not a secure vault. Sensitive information like API keys or tokens should never be synced across devices without explicit encryption and user consent.
**Prevention:** Always use `chrome.storage.local` for storing sensitive credentials within an extension to ensure they remain isolated to the local machine. Implement migration paths to securely move existing synced keys to local storage and remove them from sync.

## 2026-02-14 - Stored XSS via Job URL
**Vulnerability:** Job URLs stored in Firestore were rendered without sanitization in the `href` attribute, allowing "javascript:" schemes to execute malicious code (Stored XSS). Additionally, external links lacked `rel="noopener noreferrer"`, exposing users to Reverse Tabnabbing attacks.
**Learning:** Even internal tools or personal apps need strict input validation. The `input type="url"` client-side validation is insufficient as data can be manipulated or bypassed.
**Prevention:** Always sanitize user-provided URLs before rendering them. Use a strict allowlist for protocols (http, https). Ensure external links use `rel="noopener noreferrer"`.

## 2025-02-12 - Hardcoded Firebase Config Duplication
**Vulnerability:** Found hardcoded Firebase configuration keys in `src/lib/firestore-sync.js`, duplicating `src/lib/firebase.js`.
**Learning:** Build scripts or migration tools (like `firestore-sync.js`) often bypass main app configuration and can inadvertently introduce hardcoded secrets or duplication.
**Prevention:** Always refactor utility scripts to import shared configuration from the main app (e.g., `import { db } from './firebase'`) instead of redefining it.

## 2025-02-14 - Reflected XSS via AI Recommended Job URL
**Vulnerability:** Job URLs fetched from external RSS feeds and scored by AI were rendered directly into `href` attributes in `src/app/recommendations/page.js` without sanitization, posing an XSS risk.
**Learning:** External data sources (like RSS feeds and AI outputs) cannot be implicitly trusted, even if they seem benign. Data fetched dynamically must be sanitized before rendering.
**Prevention:** Always use the project's `sanitizeUrl` utility function on any external or dynamically generated URLs before passing them to the `href` attribute.
