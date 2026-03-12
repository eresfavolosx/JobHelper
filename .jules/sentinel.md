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

## 2025-02-14 - Chrome Extension Sync Storage Credentials Leak
**Vulnerability:** The Chrome extension was storing the Gemini API key using `chrome.storage.sync`.
**Learning:** `chrome.storage.sync` synchronizes data across all devices signed into the same Google account, meaning sensitive credentials (like API keys) are transmitted over the network and stored on Google servers. This is inappropriate for sensitive data.
**Prevention:** Use `chrome.storage.local` for sensitive data like API keys, credentials, or personal information. Only use `chrome.storage.sync` for non-sensitive user preferences. Always provide a migration path when changing storage mechanisms.
