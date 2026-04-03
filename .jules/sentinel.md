## 2024-04-03 - Prevent Information Disclosure via Error Messages
**Vulnerability:** Raw error messages (`err.message`) from caught exceptions were being passed directly to the UI's error state, potentially leaking internal information or stack traces to end users.
**Learning:** Over-reliance on raw error messages for UI feedback can inadvertently expose sensitive implementation details, violating the "Fail securely" principle.
**Prevention:** Always use generic, user-friendly error messages in UI components and log the raw error objects to the console for internal debugging.
