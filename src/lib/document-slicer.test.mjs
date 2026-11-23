import test from 'node:test';
import assert from 'node:assert/strict';
import {
    estimateTokens,
    sliceDocument,
    selectRelevantSlices,
    sliceDocumentsForPrompt,
} from './document-slicer.js';

test('Document Slicer Engine', async (t) => {
    await t.test('passes short documents through untouched without overhead', () => {
        const shortText = 'Senior Product Engineer working on TypeScript and distributed APIs.';
        const res = selectRelevantSlices(shortText, 'TypeScript APIs', { maxChars: 4000 });
        assert.equal(res.wasSliced, false);
        assert.equal(res.text, shortText);
        assert.equal(res.savedChars, 0);
        assert.equal(res.savedPercent, 0);
        assert.equal(res.totalChunks, 1);
        assert.equal(res.keptChunks, 1);
        assert.equal(estimateTokens(shortText), Math.ceil(shortText.length / 4));
    });

    await t.test('splits markdown headings and paragraphs cleanly into bounded chunks', () => {
        const doc = [
            '# Overview',
            'We build cloud workflow tools for enterprise teams across multiple continents. '.repeat(6),
            '# Requirements',
            'Experience with Kubernetes, PostgreSQL, Go microservices, and high-throughput telemetry. '.repeat(6),
            '# Benefits',
            'Comprehensive health, vision, dental insurance, 401k matching, and generous vacation. '.repeat(6),
        ].join('\n\n');

        const chunks = sliceDocument(doc, { chunkSize: 450, overlap: 60 });
        assert.ok(chunks.length >= 3);
        assert.ok(chunks.some(c => c.heading === 'Requirements'));
        assert.ok(chunks.every(c => c.text.length <= 450));
    });

    await t.test('surfaces query-relevant deep sections buried past char 12,000 in long JDs', () => {
        const filler = 'Standard corporate equal opportunity policy and general workplace culture overview paragraph. ';
        const deepRequirement = '### Technical Qualifications\nRequires deep expertise in Firestore security rules, WebSockets, Electron safeStorage, and latency optimization under 50ms.';
        const longJd = [
            '# About the Role\nPrincipal Platform Architect leading developer tooling.',
            filler.repeat(160), // ~15,000 chars of filler
            deepRequirement,
            filler.repeat(80),
        ].join('\n\n');

        assert.ok(longJd.length > 20000);

        const res = selectRelevantSlices(
            longJd,
            'Firestore WebSockets Electron latency optimization',
            {
                maxChars: 2400,
                chunkSize: 700,
                overlap: 80,
                priorityHeadings: ['qualifications', 'requirements', 'skills'],
            }
        );

        assert.equal(res.wasSliced, true);
        assert.ok(res.text.length <= 2400);
        assert.ok(res.text.includes('Firestore security rules'));
        assert.ok(res.text.includes('Principal Platform Architect'));
        assert.ok(res.savedPercent >= 80);
    });

    await t.test('allocates shared budget across multiple context documents without wasting short docs', () => {
        const docs = [
            {
                id: 'doc_short',
                name: 'cover-note.txt',
                content: 'Available immediately in Puerto Rico EST timezone.',
            },
            {
                id: 'doc_long',
                name: 'master-resume.md',
                content: [
                    '# Experience\nBuilt real-time analytics pipelines and React telemetry dashboards.',
                    'General legacy maintenance notes and routine documentation updates. '.repeat(80),
                    '# Distributed Systems Skills\nAuthored idempotent webhook processors using Pub/Sub and Cloud Run.',
                ].join('\n\n'),
            },
        ];

        const res = sliceDocumentsForPrompt(docs, 'React telemetry Pub/Sub webhook', {
            totalBudgetChars: 2000,
            maxPerDocChars: 1400,
            chunkSize: 500,
            overlap: 50,
            priorityHeadings: ['experience', 'skills'],
        });

        assert.equal(res.wasSliced, true);
        assert.equal(res.items.length, 2);
        assert.ok(res.text.includes('[Document: cover-note.txt]'));
        assert.ok(res.text.includes('Available immediately in Puerto Rico'));
        assert.ok(res.text.includes('idempotent webhook processors'));
        assert.ok(res.savedChars > 2000);
    });

    await t.test('fileToGenerativePart slices large markdown resumes as text parts and tracks token savings', async () => {
        const {
            fileToGenerativePart,
            getGeminiUsageStats,
            recordGeminiTokenSavings,
        } = await import('./gemini-client.js');

        const store = new Map();
        const prevWindow = globalThis.window;
        const prevLocalStorage = globalThis.localStorage;
        const mockStorage = {
            getItem: (k) => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => store.set(k, String(v)),
        };
        globalThis.window = globalThis;
        globalThis.localStorage = mockStorage;

        try {
            const filler = 'Verbose employment appendix note unrelated to engineering core stack. '.repeat(350);
            const largeMd = [
                '# Summary\nStaff Systems Engineer with TypeScript and GCP architecture.',
                filler,
                '# Skills\nNode.js, Firestore, Next.js, Kubernetes, SQL optimization.',
            ].join('\n\n');

            const part = await fileToGenerativePart({
                name: 'resume.md',
                type: 'text/markdown',
                text: async () => largeMd,
            });

            assert.equal(typeof part.text, 'string');
            assert.equal(part.inlineData, undefined);
            assert.ok(part.text.length <= 14000);
            assert.ok(part.text.includes('Node.js, Firestore'));

            const statsAfterSlice = getGeminiUsageStats();
            assert.ok(statsAfterSlice.estimatedTokensSaved > 0);

            recordGeminiTokenSavings(400);
            const statsAfterExtra = getGeminiUsageStats();
            assert.equal(statsAfterExtra.estimatedTokensSaved, statsAfterSlice.estimatedTokensSaved + 100);
        } finally {
            globalThis.window = prevWindow;
            globalThis.localStorage = prevLocalStorage;
        }
    });
});
