import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
    generateTotpSecret,
    base32ToBytes,
    generateTotpCode,
    verifyTotpCode,
    generateBackupCodes,
    verifyAndConsumeBackupCode,
    buildOtpAuthUri,
    getTotpSecondsRemaining,
    isSession2FAVerified,
    markSession2FAVerified,
    clearSession2FAVerification,
    compute2FATrustFingerprint,
    getTrusted2FADeviceInfo,
    isTrusted2FADevice,
    trustCurrent2FADevice,
    clearTrusted2FADevice,
    is2FAVerified
} from './totp.js';

function createMemoryStorage() {
    const map = new Map();
    return {
        get length() { return map.size; },
        key(i) { return Array.from(map.keys())[i] ?? null; },
        getItem(k) { return map.has(k) ? map.get(k) : null; },
        setItem(k, v) { map.set(k, String(v)); },
        removeItem(k) { map.delete(k); },
        clear() { map.clear(); },
        dump() { return Object.fromEntries(map.entries()); }
    };
}

test('RFC 6238 Free TOTP 2-Factor Authentication Engine', async (t) => {
    await t.test('1. Secret generation produces valid RFC 4648 Base32 strings', () => {
        const secret = generateTotpSecret(32);
        assert.equal(typeof secret, 'string');
        assert.equal(secret.length, 32);
        assert.match(secret, /^[A-Z2-7]+$/);

        const bytes = base32ToBytes(secret);
        assert.ok(bytes.length > 0);
    });

    await t.test('2. Standard RFC 6238 TOTP vector verification', async () => {
        // Standard test secret "JBSWY3DPEHPK3PXP" (ASCII "Hello!\xde\xad\xbe\xef")
        const secret = 'JBSWY3DPEHPK3PXP';
        const fixedTimeMs = 1700000000000; // Fixed timestamp

        const code = await generateTotpCode(secret, fixedTimeMs);
        assert.equal(typeof code, 'string');
        assert.equal(code.length, 6);
        assert.match(code, /^\d{6}$/);

        // Verification of correct code should pass
        const valid = await verifyTotpCode(secret, code, 1, fixedTimeMs);
        assert.strictEqual(valid, true, 'Matching code must verify as true');

        // Verification of wrong code should fail
        const invalid = await verifyTotpCode(secret, '999999', 1, fixedTimeMs);
        assert.strictEqual(invalid, false, 'Incorrect code must verify as false');
    });

    await t.test('3. Clock drift tolerance window (±1 step = 30 seconds)', async () => {
        const secret = generateTotpSecret(32);
        const now = 1700000000000;

        const currentCode = await generateTotpCode(secret, now);
        const prevCode = await generateTotpCode(secret, now - 30_000);
        const nextCode = await generateTotpCode(secret, now + 30_000);
        const futureCode = await generateTotpCode(secret, now + 120_000); // Beyond window

        assert.strictEqual(await verifyTotpCode(secret, currentCode, 1, now), true);
        assert.strictEqual(await verifyTotpCode(secret, prevCode, 1, now), true);
        assert.strictEqual(await verifyTotpCode(secret, nextCode, 1, now), true);
        assert.strictEqual(await verifyTotpCode(secret, futureCode, 1, now), false);
    });

    await t.test('4. Emergency Backup Recovery Codes Generation and Single-Use Consumption', () => {
        const codes = generateBackupCodes(8);
        assert.equal(codes.length, 8);
        for (const code of codes) {
            assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
        }

        const targetCode = codes[2];
        const res1 = verifyAndConsumeBackupCode(targetCode, codes);
        assert.strictEqual(res1.valid, true);
        assert.strictEqual(res1.remainingCodes.length, 7);
        assert.ok(!res1.remainingCodes.includes(targetCode));

        // Reusing the same code must fail
        const res2 = verifyAndConsumeBackupCode(targetCode, res1.remainingCodes);
        assert.strictEqual(res2.valid, false);
    });

    await t.test('5. otpauth URI formatting for Authenticator Apps', () => {
        const secret = 'JBSWY3DPEHPK3PXP';
        const uri = buildOtpAuthUri(secret, 'alex@example.com', 'JobHelper');
        assert.ok(uri.startsWith('otpauth://totp/JobHelper:alex%40example.com?'));
        assert.ok(uri.includes('secret=JBSWY3DPEHPK3PXP'));
        assert.ok(uri.includes('issuer=JobHelper'));
        assert.ok(uri.includes('digits=6'));
        assert.ok(uri.includes('period=30'));
    });

    await t.test('6. Seconds remaining calculation is bounded [1, 30]', () => {
        const sec = getTotpSecondsRemaining();
        assert.ok(sec >= 1 && sec <= 30);
    });

    await t.test('7. Secret and backup generation throw explicitly when crypto.getRandomValues is unavailable', () => {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
        Object.defineProperty(globalThis, 'crypto', {
            value: undefined,
            configurable: true,
            writable: true,
        });
        try {
            assert.throws(() => generateTotpSecret(32), /crypto\.getRandomValues/i);
            assert.throws(() => generateBackupCodes(8), /crypto\.getRandomValues/i);
        } finally {
            if (descriptor) {
                Object.defineProperty(globalThis, 'crypto', descriptor);
            }
        }
    });

    await t.test('8. Trust fingerprint uses standard SHA-256 and never exposes the raw TOTP secret', () => {
        const uid = 'uid-abc-123';
        const sec = { enabled: true, secret: 'JBSWY3DPEHPK3PXP', enabledAt: '2026-11-14T20:00:00.000Z' };
        const fp = compute2FATrustFingerprint(uid, sec);
        const expectedSha = crypto
            .createHash('sha256')
            .update(`novujobs:2fa-device-trust:v1:${uid}:${sec.secret}:${sec.enabledAt}`)
            .digest('hex');

        assert.equal(fp, expectedSha);
        assert.ok(!fp.includes(sec.secret));
        assert.notEqual(fp, compute2FATrustFingerprint('uid-other', sec));
        assert.notEqual(fp, compute2FATrustFingerprint(uid, { ...sec, secret: 'OTHERSECRET234567' }));
        assert.notEqual(fp, compute2FATrustFingerprint(uid, { ...sec, enabledAt: '2026-11-23T00:00:00.000Z' }));
        assert.equal(compute2FATrustFingerprint('', sec), '');
        assert.equal(compute2FATrustFingerprint(uid, { enabled: true, secret: '' }), '');
    });

    await t.test('9. Per-device trust persists across sign-outs/cleared sessionStorage and revokes cleanly', () => {
        const sessionStore = createMemoryStorage();
        const localStore = createMemoryStorage();
        const uid = 'user-1';
        const otherUid = 'user-2';
        const sec1 = { enabled: true, secret: 'JBSWY3DPEHPK3PXP', enabledAt: '2026-11-14T20:00:00.000Z' };
        const sec2 = { enabled: true, secret: 'NB2W45DFOIZA====', enabledAt: '2026-11-15T10:00:00.000Z' };

        assert.equal(is2FAVerified(uid, sec1, { sessionStore, localStore }), false);

        // Trust device for uid and uid2
        assert.equal(trustCurrent2FADevice(uid, sec1, localStore), true);
        assert.equal(trustCurrent2FADevice(otherUid, sec2, localStore), true);
        markSession2FAVerified(uid, sessionStore);

        // Stored value must not contain the raw secret
        const storedRaw = JSON.stringify(localStore.dump());
        assert.ok(!storedRaw.includes(sec1.secret));
        assert.ok(!storedRaw.includes(sec2.secret));

        const info = getTrusted2FADeviceInfo(uid, sec1, localStore);
        assert.equal(info.trusted, true);
        assert.ok(info.trustedAt);

        // Simulate sign-out / closing tab (clears sessionStorage) -> trusted device stays verified
        clearSession2FAVerification(uid, sessionStore);
        assert.equal(isSession2FAVerified(uid, sessionStore), false);
        assert.equal(isTrusted2FADevice(uid, sec1, localStore), true);
        assert.equal(is2FAVerified(uid, sec1, { sessionStore, localStore }), true);

        // Rotating enabledAt ("Revoke All Trusted Devices") or secret automatically invalidates trust
        assert.equal(
            is2FAVerified(uid, { ...sec1, enabledAt: '2026-11-23T12:00:00.000Z' }, { sessionStore, localStore }),
            false
        );
        assert.equal(
            is2FAVerified(uid, { ...sec1, secret: 'NEWSECRET2345678' }, { sessionStore, localStore }),
            false
        );

        // Revoking trust for uid leaves otherUid intact
        clearTrusted2FADevice(uid, localStore);
        assert.equal(is2FAVerified(uid, sec1, { sessionStore, localStore }), false);
        assert.equal(is2FAVerified(otherUid, sec2, { sessionStore, localStore }), true);
    });
});
