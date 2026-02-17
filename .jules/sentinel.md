## 2025-02-18 - [Serverless Auth without Admin SDK]
**Vulnerability:** Unauthenticated API endpoints exposed sensitive Gemini API usage.
**Learning:** `firebase-admin` was not available in the environment, preventing standard server-side token verification.
**Prevention:** Used `https://identitytoolkit.googleapis.com/v1/accounts:lookup` with the public API key to verify ID tokens in a lightweight manner suitable for this constraint.
