import test from 'node:test';
import assert from 'node:assert';
import { getApiKey, saveApiKey } from './storage.js';

test('storage.js extension storage', async (t) => {
    // Setup mock chrome API
    let localStore = {};
    let syncStore = {};

    global.chrome = {
        storage: {
            local: {
                get: (keys, cb) => {
                    const result = {};
                    keys.forEach(k => {
                        if (localStore[k] !== undefined) result[k] = localStore[k];
                    });
                    setTimeout(() => cb(result), 0);
                },
                set: (obj) => {
                    Object.assign(localStore, obj);
                }
            },
            sync: {
                get: (keys, cb) => {
                    const result = {};
                    keys.forEach(k => {
                        if (syncStore[k] !== undefined) result[k] = syncStore[k];
                    });
                    setTimeout(() => cb(result), 0);
                },
                remove: (key) => {
                    delete syncStore[key];
                }
            }
        }
    };

    t.afterEach(() => {
        localStore = {};
        syncStore = {};
    });

    await t.test('getApiKey should return null if not set', async () => {
        const key = await new Promise(resolve => getApiKey(resolve));
        assert.strictEqual(key, null);
    });

    await t.test('getApiKey should migrate from sync to local if found in sync', async () => {
        syncStore['geminiApiKey'] = 'legacy-sync-key';

        const key = await new Promise(resolve => getApiKey(resolve));
        assert.strictEqual(key, 'legacy-sync-key');

        // Assert it was migrated
        assert.strictEqual(localStore['geminiApiKey'], 'legacy-sync-key');
        // Assert it was removed from sync
        assert.strictEqual(syncStore['geminiApiKey'], undefined);
    });

    await t.test('getApiKey should read from local if available, ignoring sync', async () => {
        localStore['geminiApiKey'] = 'secure-local-key';
        syncStore['geminiApiKey'] = 'old-sync-key';

        const key = await new Promise(resolve => getApiKey(resolve));
        assert.strictEqual(key, 'secure-local-key');

        // Assert sync store wasn't modified because we found it in local
        assert.strictEqual(syncStore['geminiApiKey'], 'old-sync-key');
    });

    await t.test('saveApiKey should save directly to local storage', () => {
        saveApiKey('new-key');
        assert.strictEqual(localStore['geminiApiKey'], 'new-key');
        assert.strictEqual(syncStore['geminiApiKey'], undefined);
    });
});
