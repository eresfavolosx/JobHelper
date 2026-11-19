import test from 'node:test';
import assert from 'node:assert/strict';
import {
    generateTotpSecret,
    base32ToBytes,
    generateTotpCode,
    verifyTotpCode,
    generateBackupCodes,
    verifyAndConsumeBackupCode,
    buildOtpAuthUri,
    getTotpSecondsRemaining
} from './totp.js';

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
});
