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

## 2026-03-13 - DOM-based XSS via URL Query Parameters
**Vulnerability:** URL query parameters (like `url`) read via `useSearchParams` were directly passed into the application state (`openEditJobModal`) without sanitization. This allowed attackers to craft malicious links (e.g., `?url=javascript:alert(1)`) leading to DOM-based XSS when the app rendered the data.
**Learning:** URL query parameters must be treated as untrusted input. Even if a value is expected to be a URL, it needs to be sanitized before being used in the application to prevent executing injected malicious protocols like `javascript:`.
**Prevention:** Always wrap variables pulled directly from `searchParams` (especially URLs) with a sanitization utility like `sanitizeUrl` before passing them to application state or UI components.
## 2025-02-14 - Chrome Extension Sync Storage Data Exposure
**Vulnerability:** The browser extension was storing the sensitive Gemini API key in `chrome.storage.sync` instead of `chrome.storage.local`. This exposed the key to potential exfiltration or exposure on untrusted devices, as sync storage is automatically synchronized across any device where the user logs into Chrome.
**Learning:** API keys and sensitive tokens in browser extensions should never be stored in `chrome.storage.sync` due to its broad distribution scope.
**Prevention:** Always use `chrome.storage.local` or `chrome.storage.session` for sensitive data in browser extensions. If migrating, always read from the old storage, save to the new secure storage, and explicitly delete the old exposed record.
## 2024-05-30 - Prevent XSS from Extension Query Parameters
**Vulnerability:** The `UrlListener` component extracted the `url` from `searchParams` and directly passed it to the UI (e.g., `openEditJobModal`) without sanitization, exposing the app to DOM-based Cross-Site Scripting (XSS) if malicious protocols like `javascript:` were used.
**Learning:** URL parameters provided by external sources (like a browser extension) should be considered untrusted input and must be sanitized before being used in href or state variables that render links.
**Prevention:** Always apply the `sanitizeUrl` utility function to external URLs received via `searchParams` to filter out execution schemes like `javascript:`.
## 2025-02-14 - Chrome Extension Sync Storage Credentials Leak
**Vulnerability:** The Chrome extension was storing the Gemini API key using `chrome.storage.sync`.
**Learning:** `chrome.storage.sync` synchronizes data across all devices signed into the same Google account, meaning sensitive credentials (like API keys) are transmitted over the network and stored on Google servers. This is inappropriate for sensitive data.
**Prevention:** Use `chrome.storage.local` for sensitive data like API keys, credentials, or personal information. Only use `chrome.storage.sync` for non-sensitive user preferences. Always provide a migration path when changing storage mechanisms.
## 2024-05-30 - Hardcoded API Key Fallback in Client Code
**Vulnerability:** The Gemini API Key had a fallback to `process.env.NEXT_PUBLIC_GEMINI_API_KEY` in `src/lib/gemini-client.js`. This exposed the API key to the client side, allowing any user to potentially extract it from the bundled JavaScript and abuse the service.
**Learning:** Client-side code should never contain hardcoded or environment-injected API keys that can be exposed in the browser. Secrets must be securely managed per-user or securely accessed via a backend proxy.
**Prevention:** Ensure that all sensitive keys are provided directly by the user via secure settings or managed by backend services, never using `NEXT_PUBLIC_` prefixes for secrets.

## 2024-05-30 - Reflected XSS via AI Recommended Job URL in Recommendations Board
**Vulnerability:** Job URLs fetched from external RSS feeds and scored by AI were rendered directly into `url` attributes when adding jobs to the board from `src/app/recommendations/page.js` without sanitization, posing a Stored XSS risk when the user views the job card.
**Learning:** External data sources (like RSS feeds and AI outputs) cannot be implicitly trusted, even if they seem benign. Data fetched dynamically must be sanitized before being added to persistent state or rendered in DOM.
**Prevention:** Always use the project's `sanitizeUrl` utility function on any external or dynamically generated URLs before passing them to application state or `href` attributes.

## 2024-05-30 - Client-Side API Key Exposure via Environment Variables
**Vulnerability:** The Gemini API key was accessible via `process.env.NEXT_PUBLIC_GEMINI_API_KEY`. In Next.js, any environment variable starting with `NEXT_PUBLIC_` is embedded into the client-side JavaScript bundle during the build process. This would expose the sensitive API key to any user inspecting the site's source code.
**Learning:** `NEXT_PUBLIC_` prefixed environment variables must never be used for sensitive credentials or secrets (like API keys, passwords, or tokens), as they are intentionally exposed in the client-side bundle. They should only be used for non-sensitive public configuration (like feature flags or API URLs).
**Prevention:** API keys should be provided directly by the user via secure application settings and stored locally (e.g., `localStorage` or `chrome.storage.local`), or managed securely on a backend server. Never expose them via `NEXT_PUBLIC_` variables.
## 2026-03-20 - Redundant Code Clean-up for API Key Storage
**Vulnerability:** Found duplicated logic in `src/extension/popup.js` that attempted to manage the `geminiApiKey` directly using `chrome.storage.local` and `chrome.storage.sync`. This redundant logic bypassed the dedicated `getApiKey` and `saveApiKey` methods from `storage.js`.
**Learning:** Code duplication for sensitive operations (like API Key management) increases the risk of regressions or missed security updates if the logic is updated in one place (e.g., `storage.js`) but not the other (e.g., `popup.js`).
**Prevention:** Rely entirely on dedicated utility functions (`storage.js`) for API key management and strictly enforce their use throughout the extension to maintain a single source of truth for security-sensitive logic.
