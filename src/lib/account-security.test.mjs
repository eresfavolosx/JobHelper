import test from 'node:test';
import assert from 'node:assert/strict';
import {
    hasPasswordProvider,
    hasGoogleProvider,
    validateNewPassword,
    mapPasswordActionError,
} from './account-security.js';

test('hasPasswordProvider and hasGoogleProvider detect linked providers accurately', () => {
    const googleOnlyUser = { providerData: [{ providerId: 'google.com' }] };
    assert.equal(hasGoogleProvider(googleOnlyUser), true);
    assert.equal(hasPasswordProvider(googleOnlyUser), false);

    const linkedUser = {
        providerData: [{ providerId: 'google.com' }, { providerId: 'password' }],
    };
    assert.equal(hasGoogleProvider(linkedUser), true);
    assert.equal(hasPasswordProvider(linkedUser), true);
    assert.equal(hasPasswordProvider(null), false);
});

test('validateNewPassword enforces minimum 6 characters', () => {
    assert.equal(validateNewPassword('').valid, false);
    assert.equal(validateNewPassword('12345').valid, false);
    assert.equal(validateNewPassword('123456').valid, true);
});

test('mapPasswordActionError translates Firebase auth error codes cleanly', () => {
    assert.match(mapPasswordActionError({ code: 'auth/weak-password' }), /stronger password/i);
    assert.match(mapPasswordActionError({ code: 'auth/too-many-requests' }), /too many attempts/i);
    assert.match(mapPasswordActionError({ code: 'auth/requires-recent-login' }), /verify your google sign-in/i);
});
