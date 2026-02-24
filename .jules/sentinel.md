## 2026-02-14 - Stored XSS via Job URL
**Vulnerability:** Job URLs stored in Firestore were rendered without sanitization in the `href` attribute, allowing "javascript:" schemes to execute malicious code (Stored XSS). Additionally, external links lacked `rel="noopener noreferrer"`, exposing users to Reverse Tabnabbing attacks.
**Learning:** Even internal tools or personal apps need strict input validation. The `input type="url"` client-side validation is insufficient as data can be manipulated or bypassed.
**Prevention:** Always sanitize user-provided URLs before rendering them. Use a strict allowlist for protocols (http, https). Ensure external links use `rel="noopener noreferrer"`.

## 2025-02-12 - Hardcoded Firebase Config Duplication
**Vulnerability:** Found hardcoded Firebase configuration keys in `src/lib/firestore-sync.js`, duplicating `src/lib/firebase.js`.
**Learning:** Build scripts or migration tools (like `firestore-sync.js`) often bypass main app configuration and can inadvertently introduce hardcoded secrets or duplication.
**Prevention:** Always refactor utility scripts to import shared configuration from the main app (e.g., `import { db } from './firebase'`) instead of redefining it.

## 2026-02-18 - LLM Prompt Injection via XML Structure
**Vulnerability:** User-controlled inputs (job descriptions, resume data) were concatenated directly into the LLM prompt in `src/lib/job-service.js`, allowing potential prompt injection attacks where malicious content could override instructions.
**Learning:** Simple string concatenation for LLM prompts is insufficient when handling untrusted data. XML tagging is a robust way to separate data from instructions.
**Prevention:** Sanitize all user inputs using XML escaping (`escapeXml`) and wrap them in clear XML tags (e.g. `<data>...</data>`) within the prompt, explicitly instructing the model to process the tagged content.
