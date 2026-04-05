1. **Identify the Security Vulnerability**
   - In `src/app/login/page.js`, the error handling logic directly exposes the original error message to the user interface via `setError(err.message)`.
   - This occurs in both `handleGoogleLogin` and the default block of `handleEmailAuth`.
   - Exposing raw error messages can lead to Information Disclosure, leaking sensitive internals to the user or attacker.

2. **Develop the Fix**
   - Replace `setError(err.message)` with a generic error message, such as `setError('An unexpected error occurred. Please try again.')`.
   - Ensure the original error object is still passed to the internal logger via `console.error('[Auth] Login error:', err)` to maintain developer observability without exposing details.

3. **Execution Steps**
   - Modify `src/app/login/page.js` to replace the instances of `setError(err.message)` with a generic fallback message.
   - Run tests if available to verify that the application still builds.
   - Follow pre-commit instructions before submitting.

4. **Verify**
   - Review changes to ensure no sensitive error details are leaked in the login page.
