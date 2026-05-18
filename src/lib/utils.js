
/**
 * Safely parses various date formats ensuring a valid Date object is returned.
 * Handles: Date objects, ISO strings, Firestore Timestamps, and invalid inputs.
 */
export const safeDate = (input) => {
    if (!input) return new Date();

    // Already a Date object
    if (input instanceof Date) {
        // Check if it's "Invalid Date"
        if (isNaN(input.getTime())) return new Date();
        return input;
    }

    // Handle Firestore Timestamp (duck typing)
    if (typeof input === 'object' && typeof input.toDate === 'function') {
        return input.toDate();
    }

    // Handle strings or numbers
    const d = new Date(input);

    // Check for invalid date
    if (isNaN(d.getTime())) {
        console.warn('Invalid date encountered:', input);
        return new Date(); // Fallback to current time to prevent crashes
    }

    return d;
};

/**
 * Sanitizes a URL to ensure it's safe for display and navigation.
 *
 * - Removes whitespace
 * - Blocks javascript:, vbscript:, and data: schemes (prevents XSS)
 * - Prepends https:// if protocol is missing
 * - Ensures the final URL uses http: or https:
 *
 * @param {string} url - The user-provided URL
 * @returns {string|null} - The sanitized URL, or null if invalid
 */
export const sanitizeUrl = (url) => {
    if (!url) return null;
    let stringUrl = String(url).trim();

    if (stringUrl.length > 2048) return null;


    // Remove control characters (0x00-0x1F, 0x7F-0x9F) that browsers might ignore
    stringUrl = stringUrl.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // Explicitly block schemes that can execute code
    if (/^(javascript|vbscript|data):/i.test(stringUrl)) return null;

    let parsed;
    try {
        parsed = new URL(stringUrl);
    } catch {
        try {
            // If it fails parsing, try prepending https://
            // This handles domain.com and //domain.com
            parsed = new URL('https://' + stringUrl);
        } catch {
            return null;
        }
    }

    // Whitelist http and https
    if (['http:', 'https:'].includes(parsed.protocol)) {
        return parsed.toString();
    }
    return null;
};

/**
 * Escapes characters for XML contexts to prevent injection.
 *
 * @param {string} unsafe - The unsafe string
 * @returns {string} - The escaped string
 */
export const escapeXml = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

/**
 * Safely removes undefined values from an object to prepare it for Firestore saving,
 * using a performant standard for loop with Object.keys instead of Object.entries.
 */
export const cleanObject = (obj, omitKey = null) => {
    const clean = {};
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const value = obj[key];
        if (value !== undefined && key !== omitKey) {
            clean[key] = value;
        }
    }
    return clean;
};
