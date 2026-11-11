export const SAVED_ACCOUNTS_STORAGE_KEY = 'novujobs_saved_accounts_v1';
export const REMEMBER_SIGNIN_PREF_KEY = 'novujobs_remember_signin_v1';
export const MAX_SAVED_ACCOUNTS = 5;

const SAVED_ACCOUNTS_EVENT = 'novujobs:saved-accounts';
const REMEMBER_SIGNIN_EVENT = 'novujobs:remember-signin';
const EMPTY_ACCOUNTS = Object.freeze([]);

let cachedAccountsRaw;
let cachedAccountsList = EMPTY_ACCOUNTS;

function resolveStorage(storage) {
    if (storage !== undefined) return storage;
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function notifyWindow(eventName) {
    if (typeof window === 'undefined') return;
    try {
        window.dispatchEvent(new Event(eventName));
    } catch {
        // Ignore in non-browser environments
    }
}

export function normalizeAuthProvider(provider, user = null) {
    if (provider === 'google' || provider === 'google.com') return 'google';
    if (provider === 'password') return 'password';

    const providerList = Array.isArray(user?.providerData) ? user.providerData : [];
    const hasGoogle = providerList.some((entry) => entry?.providerId === 'google.com');
    if (hasGoogle) return 'google';

    return 'password';
}

export function sanitizeSavedAccount(user, provider = null, nowIso = null) {
    if (!user || typeof user !== 'object') return null;

    const rawEmail = typeof user.email === 'string' ? user.email.trim() : '';
    if (!rawEmail) return null;

    const uid = typeof user.uid === 'string' ? user.uid.trim() : '';
    const displayName = typeof user.displayName === 'string' ? user.displayName.trim() : '';
    const photoURL = typeof user.photoURL === 'string' && /^https?:\/\//i.test(user.photoURL.trim())
        ? user.photoURL.trim()
        : '';
    const resolvedProvider = normalizeAuthProvider(provider || user.provider, user);
    const parsedTimestamp = Date.parse(user.lastSignedInAt);
    const lastSignedInAt = Number.isFinite(parsedTimestamp)
        ? new Date(parsedTimestamp).toISOString()
        : (typeof nowIso === 'string' && nowIso ? nowIso : new Date().toISOString());

    return {
        uid,
        email: rawEmail,
        displayName,
        photoURL,
        provider: resolvedProvider,
        lastSignedInAt,
    };
}

function dedupeAndSortAccounts(accounts) {
    const byKey = new Map();
    for (const entry of accounts) {
        if (!entry || !entry.email) continue;
        const key = entry.email.toLowerCase();
        const existing = byKey.get(key);
        if (!existing || Date.parse(entry.lastSignedInAt) >= Date.parse(existing.lastSignedInAt)) {
            byKey.set(key, entry);
        }
    }

    return Array.from(byKey.values())
        .sort((a, b) => Date.parse(b.lastSignedInAt) - Date.parse(a.lastSignedInAt))
        .slice(0, MAX_SAVED_ACCOUNTS);
}

export function loadSavedAccounts(storage) {
    const isDefaultStorage = storage === undefined;
    const targetStorage = resolveStorage(storage);
    if (!targetStorage) return EMPTY_ACCOUNTS;

    try {
        const raw = targetStorage.getItem(SAVED_ACCOUNTS_STORAGE_KEY);
        if (isDefaultStorage && raw === cachedAccountsRaw) {
            return cachedAccountsList;
        }
        if (!raw) {
            if (isDefaultStorage) {
                cachedAccountsRaw = raw;
                cachedAccountsList = EMPTY_ACCOUNTS;
            }
            return EMPTY_ACCOUNTS;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            if (isDefaultStorage) {
                cachedAccountsRaw = raw;
                cachedAccountsList = EMPTY_ACCOUNTS;
            }
            return EMPTY_ACCOUNTS;
        }
        const sanitized = parsed
            .map((item) => sanitizeSavedAccount(item, item?.provider, item?.lastSignedInAt))
            .filter(Boolean);
        const result = dedupeAndSortAccounts(sanitized);
        if (isDefaultStorage) {
            cachedAccountsRaw = raw;
            cachedAccountsList = result;
        }
        return result;
    } catch {
        return EMPTY_ACCOUNTS;
    }
}

export function getSavedAccountsSnapshot() {
    return loadSavedAccounts();
}

export function getSavedAccountsServerSnapshot() {
    return EMPTY_ACCOUNTS;
}

export function subscribeSavedAccounts(callback) {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (event) => {
        if (!event.key || event.key === SAVED_ACCOUNTS_STORAGE_KEY) callback();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(SAVED_ACCOUNTS_EVENT, callback);
    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(SAVED_ACCOUNTS_EVENT, callback);
    };
}

export function persistSavedAccounts(accounts, storage) {
    const isDefaultStorage = storage === undefined;
    const targetStorage = resolveStorage(storage);
    const clean = dedupeAndSortAccounts(
        (Array.isArray(accounts) ? accounts : [])
            .map((item) => sanitizeSavedAccount(item, item?.provider, item?.lastSignedInAt))
            .filter(Boolean)
    );
    if (!targetStorage) return clean;

    try {
        const serialized = JSON.stringify(clean);
        targetStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, serialized);
        if (isDefaultStorage) {
            cachedAccountsRaw = serialized;
            cachedAccountsList = clean;
            notifyWindow(SAVED_ACCOUNTS_EVENT);
        }
    } catch {
        // Ignore quota or storage restriction errors
    }
    return clean;
}

export function upsertSavedAccount(user, provider = null, storage) {
    const targetStorage = resolveStorage(storage);
    const sanitized = sanitizeSavedAccount(user, provider, new Date().toISOString());
    if (!sanitized) return loadSavedAccounts(storage);

    const freshEntry = {
        ...sanitized,
        lastSignedInAt: new Date().toISOString(),
    };

    const existing = loadSavedAccounts(storage).filter((item) => {
        if (freshEntry.uid && item.uid && item.uid === freshEntry.uid) return false;
        return item.email.toLowerCase() !== freshEntry.email.toLowerCase();
    });

    return persistSavedAccounts([freshEntry, ...existing], storage === undefined ? undefined : targetStorage);
}

export function removeSavedAccount(emailOrUid, storage) {
    const targetStorage = resolveStorage(storage);
    const target = typeof emailOrUid === 'string' ? emailOrUid.trim().toLowerCase() : '';
    const existing = loadSavedAccounts(storage);
    if (!target) return existing;

    const filtered = existing.filter((item) => {
        const matchesUid = item.uid && item.uid.toLowerCase() === target;
        const matchesEmail = item.email.toLowerCase() === target;
        return !matchesUid && !matchesEmail;
    });

    return persistSavedAccounts(filtered, storage === undefined ? undefined : targetStorage);
}

export function getRememberSignInPreference(storage) {
    const targetStorage = resolveStorage(storage);
    if (!targetStorage) return true;

    try {
        const raw = targetStorage.getItem(REMEMBER_SIGNIN_PREF_KEY);
        if (raw === null || raw === undefined) return true;
        return raw !== 'false';
    } catch {
        return true;
    }
}

export function getRememberSignInSnapshot() {
    return getRememberSignInPreference();
}

export function getRememberSignInServerSnapshot() {
    return true;
}

export function subscribeRememberSignInPreference(callback) {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (event) => {
        if (!event.key || event.key === REMEMBER_SIGNIN_PREF_KEY) callback();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(REMEMBER_SIGNIN_EVENT, callback);
    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(REMEMBER_SIGNIN_EVENT, callback);
    };
}

export function setRememberSignInPreference(enabled, storage) {
    const targetStorage = resolveStorage(storage);
    const normalized = Boolean(enabled);
    if (!targetStorage) return normalized;

    try {
        targetStorage.setItem(REMEMBER_SIGNIN_PREF_KEY, normalized ? 'true' : 'false');
        if (storage === undefined) {
            notifyWindow(REMEMBER_SIGNIN_EVENT);
        }
    } catch {
        // Ignore storage restrictions
    }
    return normalized;
}
