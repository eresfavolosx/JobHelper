1. **Fix `sanitizeUrl` utility in `src/lib/utils.js`**
   - Apply a regex to strip control characters before validating the string to prevent bypassing the JavaScript/VBScript/Data scheme check.
   - Use `replace(/[\x00-\x1F\x7F-\x9F]/g, '')` on the `stringUrl` to strip control characters, and use `test` with a regex `^(javascript|vbscript|data):` for matching.

2. **Fix `sanitizeUrl` utility in `src/extension/popup.js`**
   - Apply the identical fix as step 1 to the local `sanitizeUrl` function in `src/extension/popup.js`.

3. **Add tests for `sanitizeUrl` in `src/lib/utils.test.js`**
   - Ensure to test for cases where a control character is injected before the scheme, like `\x00javascript:alert(1)`.
