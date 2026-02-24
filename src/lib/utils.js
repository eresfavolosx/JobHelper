
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

    // Explicitly block schemes that can execute code
    if (stringUrl.toLowerCase().startsWith('javascript:')) return null;
    if (stringUrl.toLowerCase().startsWith('vbscript:')) return null;
    if (stringUrl.toLowerCase().startsWith('data:')) return null;

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
 * Escapes special characters for XML/HTML to prevent injection.
 * useful for constructing safe prompts for LLMs.
 */
export const escapeXml = (unsafe) => {
    if (!unsafe) return '';
    return String(unsafe).replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};
