import test from 'node:test';
import assert from 'node:assert/strict';
import {
    testClaudeApiKey,
    testOpenAiApiKey,
    testCustomAiProvider,
    testGeminiApiKey,
    extractJson,
    getAvailableAiProviders,
    resolveGeminiApiKey,
    generateWithFallback
} from './gemini-client.js';

test('Multi-Provider AI Validation Suite', async (t) => {
    await t.test('testClaudeApiKey rejects empty key', async () => {
        const res = await testClaudeApiKey('');
        assert.equal(res.success, false);
        assert.match(res.message, /provide a Claude API key/i);
    });

    await t.test('testClaudeApiKey rejects whitespace key', async () => {
        const res = await testClaudeApiKey('   ');
        assert.equal(res.success, false);
        assert.match(res.message, /provide a Claude API key/i);
    });

    await t.test('testOpenAiApiKey rejects empty key', async () => {
        const res = await testOpenAiApiKey('');
        assert.equal(res.success, false);
        assert.match(res.message, /provide an OpenAI API key/i);
    });

    await t.test('testOpenAiApiKey rejects whitespace key', async () => {
        const res = await testOpenAiApiKey('   ');
        assert.equal(res.success, false);
        assert.match(res.message, /provide an OpenAI API key/i);
    });

    await t.test('testCustomAiProvider validates URL and Key', async () => {
        const noUrl = await testCustomAiProvider('', 'sk-123', 'model');
        assert.equal(noUrl.success, false);
        assert.match(noUrl.message, /provide a Base URL/i);

        const insecureUrl = await testCustomAiProvider('http://evil.com/v1', 'sk-123', 'model');
        assert.equal(insecureUrl.success, false);
        assert.match(insecureUrl.message, /https:\/\/|localhost/i);

        const noKey = await testCustomAiProvider('https://api.deepseek.com/v1', '', 'model');
        assert.equal(noKey.success, false);
        assert.match(noKey.message, /provide an API key/i);
    });

    await t.test('testGeminiApiKey rejects empty key', async () => {
        const res = await testGeminiApiKey('');
        assert.equal(res.success, false);
        assert.match(res.message, /provide an API key/i);
    });

    await t.test('testGeminiApiKey returns failure with lastError when all models fail', async () => {
        const prevFetch = globalThis.fetch;
        globalThis.fetch = async () => new Response(
            JSON.stringify({ error: { message: 'Service temporarily unavailable' } }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
        try {
            const res = await testGeminiApiKey('AIzaSyTestKeyForFailureCheck1234567890');
            assert.equal(res.success, false);
            assert.match(res.message, /Service temporarily unavailable|503|authenticate/i);
        } finally {
            globalThis.fetch = prevFetch;
        }
    });

    await t.test('extractJson extracts JSON from Claude/OpenAI conversational markdown', () => {
        const rawMarkdown = "Here is the parsed response:\n```json\n{\"skills\": [\"React\", \"TypeScript\"], \"score\": 95}\n```\nHope this helps!";
        const parsed = extractJson(rawMarkdown);
        assert.deepEqual(parsed, { skills: ["React", "TypeScript"], score: 95 });
    });

    await t.test('getAvailableAiProviders returns hasAnyAiKey=false when account has no keys (even with env keys)', () => {
        const prevGemini = process.env.GEMINI_API_KEY;
        const prevPublicGemini = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        try {
            process.env.GEMINI_API_KEY = 'env-gemini-platform-key';
            process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'env-public-gemini-should-be-ignored';

            const emptyProviders = getAvailableAiProviders({});
            assert.equal(emptyProviders.hasAnyAiKey, false);
            assert.equal(emptyProviders.hasGemini, false);
            assert.equal(emptyProviders.geminiKey, '');

            const leakedEnvProviders = getAvailableAiProviders({ geminiApiKey: 'env-gemini-platform-key' });
            assert.equal(leakedEnvProviders.hasAnyAiKey, false);
            assert.equal(leakedEnvProviders.hasGemini, false);

            const personalProviders = getAvailableAiProviders({ geminiApiKey: 'AIzaSyPersonalAccountKey123' });
            assert.equal(personalProviders.hasAnyAiKey, true);
            assert.equal(personalProviders.hasGemini, true);
            assert.equal(personalProviders.geminiKey, 'AIzaSyPersonalAccountKey123');
        } finally {
            if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
            else process.env.GEMINI_API_KEY = prevGemini;
            if (prevPublicGemini === undefined) delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            else process.env.NEXT_PUBLIC_GEMINI_API_KEY = prevPublicGemini;
        }
    });

    await t.test('resolveGeminiApiKey and generateWithFallback throw API_KEY_REQUIRED when no key is on account', async () => {
        assert.throws(
            () => resolveGeminiApiKey({}),
            (err) => err?.code === 'API_KEY_REQUIRED'
        );

        await assert.rejects(
            () => generateWithFallback('Hello AI'),
            (err) => err?.code === 'API_KEY_REQUIRED'
        );
    });
});
