import test from 'node:test';
import assert from 'node:assert/strict';
import { testClaudeApiKey, testOpenAiApiKey, testCustomAiProvider, testGeminiApiKey, extractJson } from './gemini-client.js';

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

        const noKey = await testCustomAiProvider('https://api.deepseek.com/v1', '', 'model');
        assert.equal(noKey.success, false);
        assert.match(noKey.message, /provide an API key/i);
    });

    await t.test('testGeminiApiKey rejects empty key', async () => {
        const res = await testGeminiApiKey('');
        assert.equal(res.success, false);
        assert.match(res.message, /provide an API key/i);
    });

    await t.test('extractJson extracts JSON from Claude/OpenAI conversational markdown', () => {
        const rawMarkdown = "Here is the parsed response:\n```json\n{\"skills\": [\"React\", \"TypeScript\"], \"score\": 95}\n```\nHope this helps!";
        const parsed = extractJson(rawMarkdown);
        assert.deepEqual(parsed, { skills: ["React", "TypeScript"], score: 95 });
    });
});
