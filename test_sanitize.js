const sanitizeUrl = (url) => {
    if (!url) return null;
    let stringUrl = String(url).trim();
    if (stringUrl.length > 2048) return null;

    stringUrl = stringUrl.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    if (/^(javascript|vbscript|data):/i.test(stringUrl)) return null;

    let parsed;
    try {
        parsed = new URL(stringUrl);
    } catch {
        try {
            parsed = new URL('https://' + stringUrl);
        } catch {
            return null;
        }
    }
    if (['http:', 'https:'].includes(parsed.protocol)) {
        return parsed.toString();
    }
    return null;
};

console.log(sanitizeUrl("javascript:alert(1)"));
console.log(sanitizeUrl("java\x09script:alert(1)"));
console.log(sanitizeUrl("http://google.com"));
