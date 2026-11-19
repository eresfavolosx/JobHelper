import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvField } from './export-utils.js';
import { fetchJobsWithCoverage } from './job-service.js';
import { getStoredGmailToken } from './gmail-service.js';

function createMemoryStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => { map.set(k, String(v)); },
        removeItem: (k) => { map.delete(k); },
        has: (k) => map.has(k),
    };
}

test('Export, Job Service, and Gmail Token Security Suite', async (t) => {
    await t.test('escapeCsvField neutralizes spreadsheet formula injection prefixes', () => {
        assert.equal(escapeCsvField('=CMD()'), `"'=CMD()"`);
        assert.equal(escapeCsvField('+12345'), `"'+12345"`);
        assert.equal(escapeCsvField('-1+1'), `"-1+1"`.replace('"-', `"' -`.replace(' ', '')));
        assert.equal(escapeCsvField('-SUM(A1:A2)'), `"'-SUM(A1:A2)"`);
        assert.equal(escapeCsvField('@SUM(1,1)'), `"'@SUM(1,1)"`);
        assert.equal(escapeCsvField('\t=1+1'), `"'\t=1+1"`);
        assert.equal(escapeCsvField('\r=1+1'), `"'\r=1+1"`);
        assert.equal(escapeCsvField(' =IMPORTXML("x")'), `"' =IMPORTXML(""x"")"`);
        assert.equal(escapeCsvField('Senior Security Engineer'), '"Senior Security Engineer"');
        assert.equal(escapeCsvField(null), '""');
    });

    await t.test('fetchJobsWithCoverage passes AbortSignal to fetch and filters keywords case-insensitively', async () => {
        const prevWindow = globalThis.window;
        const prevFetch = globalThis.fetch;
        const observedSignals = [];

        globalThis.window = {};
        globalThis.fetch = async (_url, options = {}) => {
            observedSignals.push(options.signal);
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    items: [
                        {
                            title: 'Staff Rust Platform Engineer',
                            link: 'https://example.com/jobs/1',
                            description: 'Build distributed storage systems in RUST.',
                            pubDate: '2026-10-01T00:00:00Z'
                        },
                        {
                            title: 'Product Marketing Manager',
                            link: 'https://example.com/jobs/2',
                            description: 'Lead GTM launches.',
                            pubDate: '2026-10-01T00:00:00Z'
                        }
                    ]
                })
            };
        };

        try {
            const { jobs } = await fetchJobsWithCoverage(['rust']);
            assert.equal(observedSignals.length, 2);
            for (const signal of observedSignals) {
                assert.ok(signal instanceof AbortSignal, 'Expected AbortSignal on RSS fetch');
            }
            assert.ok(jobs.some(j => j.link === 'https://example.com/jobs/1'));
            assert.equal(jobs.some(j => j.link === 'https://example.com/jobs/2'), false);
        } finally {
            if (prevWindow === undefined) delete globalThis.window;
            else globalThis.window = prevWindow;
            globalThis.fetch = prevFetch;
        }
    });

    await t.test('getStoredGmailToken reads sessionStorage only and scrubs legacy localStorage', () => {
        const prevWindow = globalThis.window;
        const prevSession = globalThis.sessionStorage;
        const prevLocal = globalThis.localStorage;

        const sessionStore = createMemoryStorage({
            novujobs_gmail_access_token: 'session-only-oauth-token',
            novujobs_gmail_access_token_meta: JSON.stringify({ savedAt: Date.now() })
        });
        const localStore = createMemoryStorage({
            novujobs_gmail_access_token: 'legacy-leaked-local-token',
            novujobs_gmail_access_token_meta: JSON.stringify({ savedAt: Date.now(), token: 'legacy-leaked-local-token' })
        });

        globalThis.window = {};
        globalThis.sessionStorage = sessionStore;
        globalThis.localStorage = localStore;

        try {
            const token = getStoredGmailToken();
            assert.equal(token, 'session-only-oauth-token');
            assert.equal(localStore.has('novujobs_gmail_access_token'), false);
            assert.equal(localStore.has('novujobs_gmail_access_token_meta'), false);
        } finally {
            if (prevWindow === undefined) delete globalThis.window;
            else globalThis.window = prevWindow;
            if (prevSession === undefined) delete globalThis.sessionStorage;
            else globalThis.sessionStorage = prevSession;
            if (prevLocal === undefined) delete globalThis.localStorage;
            else globalThis.localStorage = prevLocal;
        }
    });
});
