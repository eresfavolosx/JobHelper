/**
 * Free RFC 6238 TOTP (Time-Based One-Time Password) Engine
 * 100% Free ($0 forever) — Zero SMS fees or external authentication service costs.
 * Fully compatible with Google Authenticator, Apple Passwords / iOS Keychain,
 * Microsoft Authenticator, 1Password, Authy, and Bitwarden.
 * 
 * Powered by standard Web Crypto API (HMAC-SHA1) with Base32 encoding/decoding.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SESSION_2FA_PREFIX = 'jobhelper_2fa_verified_';
const TRUSTED_DEVICE_2FA_PREFIX = 'jobhelper_2fa_trusted_device_';
export const TRUSTED_2FA_CHANGE_EVENT = 'novujobs:2fa-trust-change';

const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function encodeUtf8Bytes(input) {
    const str = String(input ?? '');
    if (typeof TextEncoder !== 'undefined') {
        return Array.from(new TextEncoder().encode(str));
    }
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 0x80) {
            bytes.push(code);
        } else if (code < 0x800) {
            bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
            const low = str.charCodeAt(++i);
            const cp = 0x10000 + (((code - 0xd800) << 10) | (low - 0xdc00));
            bytes.push(
                0xf0 | (cp >> 18),
                0x80 | ((cp >> 12) & 0x3f),
                0x80 | ((cp >> 6) & 0x3f),
                0x80 | (cp & 0x3f)
            );
        } else {
            bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
    }
    return bytes;
}

function sha256Hex(input) {
    const bytes = encodeUtf8Bytes(input);
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length + 8) % 64 !== 0) {
        bytes.push(0);
    }
    const highBits = Math.floor(bitLen / 0x100000000);
    const lowBits = bitLen >>> 0;
    for (let i = 3; i >= 0; i--) bytes.push((highBits >>> (i * 8)) & 0xff);
    for (let i = 3; i >= 0; i--) bytes.push((lowBits >>> (i * 8)) & 0xff);

    const H = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const W = new Array(64);
    const rotr = (v, n) => (v >>> n) | (v << (32 - n));

    for (let offset = 0; offset < bytes.length; offset += 64) {
        for (let i = 0; i < 16; i++) {
            const j = offset + i * 4;
            W[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
            const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
            W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
        }

        let [a, b, c, d, e, f, g, h] = H;
        for (let i = 0; i < 64; i++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;

            h = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }

        H[0] = (H[0] + a) >>> 0;
        H[1] = (H[1] + b) >>> 0;
        H[2] = (H[2] + c) >>> 0;
        H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0;
        H[5] = (H[5] + f) >>> 0;
        H[6] = (H[6] + g) >>> 0;
        H[7] = (H[7] + h) >>> 0;
    }

    return H.map(w => (w >>> 0).toString(16).padStart(8, '0')).join('');
}

function resolveSessionStore(storage) {
    if (storage !== undefined) return storage;
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

function resolveLocalStore(storage) {
    if (storage !== undefined) return storage;
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function notify2FATrustChange() {
    if (typeof window === 'undefined') return;
    try {
        window.dispatchEvent(new Event(TRUSTED_2FA_CHANGE_EVENT));
    } catch {
        // Ignore in restricted environments
    }
}

/**
 * Generate a cryptographically secure random Base32 TOTP secret (32 chars = 160 bits).
 */
export function generateTotpSecret(length = 32) {
    if (typeof globalThis === 'undefined' || !globalThis.crypto?.getRandomValues) {
        throw new Error('Cryptographically secure random number generator (crypto.getRandomValues) is unavailable.');
    }
    const random = new Uint8Array(length);
    globalThis.crypto.getRandomValues(random);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += BASE32_ALPHABET[random[i] % BASE32_ALPHABET.length];
    }
    return out;
}

/**
 * Decode an RFC 4648 Base32 secret string into raw bytes, ignoring spaces and padding.
 */
export function base32ToBytes(secret = '') {
    const clean = String(secret).toUpperCase().replace(/[^A-Z2-7]/g, '');
    const bytes = [];
    let bits = 0;
    let value = 0;

    for (let i = 0; i < clean.length; i++) {
        const idx = BASE32_ALPHABET.indexOf(clean[i]);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return new Uint8Array(bytes);
}

/**
 * Generate a 6-digit RFC 6238 TOTP code using Web Crypto HMAC-SHA1 (30-second step).
 */
export async function generateTotpCode(secret, timestampMs = Date.now()) {
    const keyBytes = base32ToBytes(secret);
    if (keyBytes.length === 0) {
        throw new Error('Invalid TOTP secret');
    }

    const step = Math.floor(timestampMs / 1000 / 30);
    const counter = new Uint8Array(8);
    let tmp = step;
    for (let i = 7; i >= 0; i--) {
        counter[i] = tmp & 0xff;
        tmp = Math.floor(tmp / 256);
    }

    const key = await globalThis.crypto.subtle.importKey(
        'raw',
        keyBytes.slice(),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, counter);
    const hmac = new Uint8Array(signature);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    return String(binary % 1_000_000).padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code across [-windowSteps, +windowSteps] 30-second steps.
 */
export async function verifyTotpCode(secret, inputCode, windowSteps = 1, timestampMs = Date.now()) {
    if (!secret || !inputCode) return false;
    const clean = String(inputCode).replace(/\D/g, '');
    if (!/^\d{6}$/.test(clean) || base32ToBytes(secret).length === 0) {
        return false;
    }

    for (let stepOffset = -windowSteps; stepOffset <= windowSteps; stepOffset++) {
        try {
            const candidate = await generateTotpCode(secret, timestampMs + stepOffset * 30_000);
            if (candidate === clean) {
                return true;
            }
        } catch {
            // Ignore individual step failure
        }
    }
    return false;
}

/**
 * Generate a set of single-use backup recovery codes formatted as XXXX-XXXX.
 */
export function generateBackupCodes(count = 8) {
    if (typeof globalThis === 'undefined' || !globalThis.crypto?.getRandomValues) {
        throw new Error('Cryptographically secure random number generator (crypto.getRandomValues) is unavailable.');
    }
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codes = [];
    const random = new Uint8Array(count * 8);
    globalThis.crypto.getRandomValues(random);

    for (let i = 0; i < count; i++) {
        let part1 = '';
        let part2 = '';
        for (let j = 0; j < 4; j++) {
            part1 += alphabet[random[i * 8 + j] % alphabet.length];
            part2 += alphabet[random[i * 8 + j + 4] % alphabet.length];
        }
        codes.push(`${part1}-${part2}`);
    }
    return codes;
}

/**
 * Verify and consume a backup recovery code against an array of valid backup codes.
 * Returns { valid: boolean, remainingCodes: string[] }
 */
export function verifyAndConsumeBackupCode(inputCode, availableCodes = []) {
    if (!inputCode || !Array.isArray(availableCodes) || availableCodes.length === 0) {
        return { valid: false, remainingCodes: availableCodes };
    }
    const cleanInput = String(inputCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const foundIndex = availableCodes.findIndex(code => {
        const cleanSaved = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
        return cleanSaved === cleanInput;
    });

    if (foundIndex === -1) {
        return { valid: false, remainingCodes: availableCodes };
    }

    const remainingCodes = [...availableCodes];
    remainingCodes.splice(foundIndex, 1);
    return { valid: true, remainingCodes };
}

/**
 * Build standard otpauth:// URI compatible with all Authenticator Apps.
 */
export function buildOtpAuthUri(secret, accountEmail = 'user', issuer = 'JobHelper') {
    const cleanSecret = String(secret).toUpperCase().replace(/[^A-Z2-7]/g, '');
    const cleanIssuer = issuer.trim() || 'JobHelper';
    const cleanAccount = accountEmail.trim() || 'user';
    const label = `${encodeURIComponent(cleanIssuer)}:${encodeURIComponent(cleanAccount)}`;
    const params = new URLSearchParams({
        secret: cleanSecret,
        issuer: cleanIssuer,
        algorithm: 'SHA1',
        digits: '6',
        period: '30',
    });
    return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Return seconds remaining in the current 30-second TOTP cycle (1..30).
 */
export function getTotpSecondsRemaining(timestampMs = Date.now()) {
    const elapsed = Math.floor(timestampMs / 1000) % 30;
    return 30 - elapsed;
}

/**
 * Check if the current browser session has completed 2FA verification for the given userId.
 */
export function isSession2FAVerified(userId, storage) {
    const store = resolveSessionStore(storage);
    if (!userId || !store) return false;
    try {
        return store.getItem(`${SESSION_2FA_PREFIX}${userId}`) === 'true';
    } catch {
        return false;
    }
}

/**
 * Mark the current browser session as 2FA-verified for the given userId.
 */
export function markSession2FAVerified(userId, storage) {
    const store = resolveSessionStore(storage);
    if (!userId || !store) return;
    try {
        store.setItem(`${SESSION_2FA_PREFIX}${userId}`, 'true');
    } catch {
        // Ignore quota
    }
}

/**
 * Clear the session-level 2FA verification status for the given userId (e.g. on logout or re-auth).
 * Leaves persistent per-device trust intact so trusted devices are not re-prompted on next sign-in.
 */
export function clearSession2FAVerification(userId, storage) {
    const store = resolveSessionStore(storage);
    if (!store) return;
    try {
        if (userId) {
            store.removeItem(`${SESSION_2FA_PREFIX}${userId}`);
        } else {
            for (let i = store.length - 1; i >= 0; i--) {
                const key = store.key(i);
                if (key && key.startsWith(SESSION_2FA_PREFIX)) {
                    store.removeItem(key);
                }
            }
        }
    } catch {
        // Ignore
    }
}

/**
 * Compute a deterministic non-reversible fingerprint binding device trust to userId + secret + enabledAt.
 * Changing the TOTP secret or bumping enabledAt automatically invalidates all trusted devices.
 */
export function compute2FATrustFingerprint(userId, security2FA) {
    const cleanUid = typeof userId === 'string' ? userId.trim() : '';
    const cleanSecret = typeof security2FA?.secret === 'string' ? security2FA.secret.trim() : '';
    if (!cleanUid || !cleanSecret) return '';
    const enabledAt = typeof security2FA?.enabledAt === 'string' ? security2FA.enabledAt.trim() : '';
    return sha256Hex(`novujobs:2fa-device-trust:v1:${cleanUid}:${cleanSecret}:${enabledAt}`);
}

/**
 * Return trust state and activation timestamp for the current browser device.
 */
export function getTrusted2FADeviceInfo(userId, security2FA, storage) {
    const store = resolveLocalStore(storage);
    if (!userId || !store || security2FA?.enabled === false || !security2FA?.secret) {
        return { trusted: false, trustedAt: null };
    }
    const expected = compute2FATrustFingerprint(userId, security2FA);
    if (!expected) {
        return { trusted: false, trustedAt: null };
    }
    try {
        const raw = store.getItem(`${TRUSTED_DEVICE_2FA_PREFIX}${userId}`);
        if (!raw) return { trusted: false, trustedAt: null };
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1 || typeof parsed?.fingerprint !== 'string') {
            return { trusted: false, trustedAt: null };
        }
        if (parsed.fingerprint !== expected) {
            return { trusted: false, trustedAt: null };
        }
        return {
            trusted: true,
            trustedAt: typeof parsed.trustedAt === 'string' ? parsed.trustedAt : null
        };
    } catch {
        return { trusted: false, trustedAt: null };
    }
}

/**
 * Check whether the current device holds a valid persistent 2FA trust token for userId.
 */
export function isTrusted2FADevice(userId, security2FA, storage) {
    return getTrusted2FADeviceInfo(userId, security2FA, storage).trusted;
}

/**
 * Persist a cryptographic per-device 2FA trust token in localStorage and mark the session verified.
 */
export function trustCurrent2FADevice(userId, security2FA, storage) {
    const store = resolveLocalStore(storage);
    const fingerprint = compute2FATrustFingerprint(userId, security2FA);
    if (!fingerprint || !store) return false;

    try {
        store.setItem(
            `${TRUSTED_DEVICE_2FA_PREFIX}${userId}`,
            JSON.stringify({
                version: 1,
                trustedAt: new Date().toISOString(),
                fingerprint
            })
        );
        if (storage === undefined) {
            markSession2FAVerified(userId);
            notify2FATrustChange();
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * Clear persistent per-device 2FA trust for a specific userId (or all users when omitted).
 */
export function clearTrusted2FADevice(userId, storage) {
    const store = resolveLocalStore(storage);
    if (!store) return;
    try {
        if (userId) {
            store.removeItem(`${TRUSTED_DEVICE_2FA_PREFIX}${userId}`);
        } else {
            for (let i = store.length - 1; i >= 0; i--) {
                const key = store.key(i);
                if (key && key.startsWith(TRUSTED_DEVICE_2FA_PREFIX)) {
                    store.removeItem(key);
                }
            }
        }
        if (storage === undefined) {
            notify2FATrustChange();
        }
    } catch {
        // Ignore
    }
}

/**
 * Determine whether the user has passed 2FA for this session or on this trusted device.
 */
export function is2FAVerified(userId, security2FA, { sessionStore, localStore } = {}) {
    return isSession2FAVerified(userId, sessionStore) || isTrusted2FADevice(userId, security2FA, localStore);
}
