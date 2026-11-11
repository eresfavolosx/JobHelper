import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_SAVED_ACCOUNTS,
    SAVED_ACCOUNTS_STORAGE_KEY,
    sanitizeSavedAccount,
    loadSavedAccounts,
    upsertSavedAccount,
    removeSavedAccount,
    getRememberSignInPreference,
    setRememberSignInPreference,
} from './saved-accounts.js';

function createMemoryStorage(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
    };
}

test('sanitizeSavedAccount keeps only non-sensitive public profile fields', () => {
    const account = sanitizeSavedAccount({
        uid: 'user-123',
        email: '  alice@example.com ',
        displayName: 'Alice Doe',
        photoURL: 'https://example.com/avatar.png',
        accessToken: 'secret-token-should-drop',
        password: 'never-store-passwords',
        providerData: [{ providerId: 'google.com' }],
    });

    assert.equal(account.uid, 'user-123');
    assert.equal(account.email, 'alice@example.com');
    assert.equal(account.displayName, 'Alice Doe');
    assert.equal(account.photoURL, 'https://example.com/avatar.png');
    assert.equal(account.provider, 'google');
    assert.equal('accessToken' in account, false);
    assert.equal('password' in account, false);
});

test('upsertSavedAccount stores multiple accounts and puts most recent first within cap', () => {
    const storage = createMemoryStorage();

    for (let i = 1; i <= MAX_SAVED_ACCOUNTS + 2; i += 1) {
        upsertSavedAccount(
            { uid: `uid-${i}`, email: `user${i}@example.com`, displayName: `User ${i}` },
            i % 2 === 0 ? 'google' : 'password',
            storage
        );
    }

    const loaded = loadSavedAccounts(storage);
    assert.equal(loaded.length, MAX_SAVED_ACCOUNTS);
    assert.equal(loaded[0].email, `user${MAX_SAVED_ACCOUNTS + 2}@example.com`);

    // Updating an earlier account moves it to the front without duplicating it
    const afterReSignIn = upsertSavedAccount(
        { uid: `uid-${MAX_SAVED_ACCOUNTS}`, email: `USER${MAX_SAVED_ACCOUNTS}@example.com`, displayName: 'Updated Name' },
        'google',
        storage
    );
    assert.equal(afterReSignIn.length, MAX_SAVED_ACCOUNTS);
    assert.equal(afterReSignIn[0].displayName, 'Updated Name');
    assert.equal(afterReSignIn[0].provider, 'google');
});

test('removeSavedAccount removes by email case-insensitively or by uid', () => {
    const storage = createMemoryStorage();
    upsertSavedAccount({ uid: 'u1', email: 'One@Example.com' }, 'password', storage);
    upsertSavedAccount({ uid: 'u2', email: 'Two@Example.com' }, 'google', storage);

    let remaining = removeSavedAccount('one@example.com', storage);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].uid, 'u2');

    remaining = removeSavedAccount('U2', storage);
    assert.equal(remaining.length, 0);
});

test('loadSavedAccounts recovers safely from malformed JSON', () => {
    const storage = createMemoryStorage({ [SAVED_ACCOUNTS_STORAGE_KEY]: '{broken-json' });
    assert.deepEqual(loadSavedAccounts(storage), []);
});

test('remember sign-in preference defaults to true and persists false/true', () => {
    const storage = createMemoryStorage();
    assert.equal(getRememberSignInPreference(storage), true);

    setRememberSignInPreference(false, storage);
    assert.equal(getRememberSignInPreference(storage), false);

    setRememberSignInPreference(true, storage);
    assert.equal(getRememberSignInPreference(storage), true);
});
