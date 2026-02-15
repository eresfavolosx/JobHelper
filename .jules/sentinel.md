## 2025-02-12 - Hardcoded Firebase Config Duplication
**Vulnerability:** Found hardcoded Firebase configuration keys in `src/lib/firestore-sync.js`, duplicating `src/lib/firebase.js`.
**Learning:** Build scripts or migration tools (like `firestore-sync.js`) often bypass main app configuration and can inadvertently introduce hardcoded secrets or duplication.
**Prevention:** Always refactor utility scripts to import shared configuration from the main app (e.g., `import { db } from './firebase'`) instead of redefining it.
