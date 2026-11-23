const STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'they', 'their', 'them', 'we', 'our', 'you', 'your', 'about',
    'into', 'over', 'after', 'before', 'between', 'through', 'during', 'above',
    'below', 'up', 'down', 'out', 'off', 'all', 'any', 'both', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'also', 'how', 'what', 'when',
    'where', 'which', 'who', 'why', 'please', 'looking', 'seeking', 'join', 'team'
]);

const SECTION_HEADING_RE = /^(?:#{1,6}\s+(.+)|([A-Z][A-Za-z0-9 &/,-]{2,60}):\s*)$/;

export function estimateTokens(text) {
    return Math.ceil(String(text || '').length / 4);
}

function tokenizeQuery(text) {
    const rawTokens = String(text || '')
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9+#._-]{1,}/g) || [];
    const unique = [];
    const seen = new Set();
    for (const token of rawTokens) {
        if (STOPWORDS.has(token) || seen.has(token)) continue;
        seen.add(token);
        unique.push(token);
    }
    return unique;
}

function buildBigramPhrases(text) {
    const words = String(text || '')
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9+#._-]{1,}/g) || [];
    const phrases = [];
    for (let i = 0; i + 1 < words.length && phrases.length < 16; i++) {
        if (STOPWORDS.has(words[i]) && STOPWORDS.has(words[i + 1])) continue;
        phrases.push(`${words[i]} ${words[i + 1]}`);
    }
    return phrases;
}

function splitLongBlock(blockText, maxLen, overlapLen) {
    const clean = blockText.trim();
    if (clean.length <= maxLen) return [clean];

    const sentences = clean.split(/(?<=[.!?])\s+/);
    const pieces = [];
    let current = '';

    for (const sentence of sentences) {
        if (sentence.length > maxLen) {
            if (current.trim()) {
                pieces.push(current.trim());
                current = '';
            }
            let pos = 0;
            const step = Math.max(20, maxLen - overlapLen);
            while (pos < sentence.length) {
                let end = Math.min(sentence.length, pos + maxLen);
                if (end < sentence.length) {
                    const lastSpace = sentence.lastIndexOf(' ', end);
                    if (lastSpace > pos + Math.floor(maxLen * 0.5)) {
                        end = lastSpace;
                    }
                }
                const slice = sentence.slice(pos, end).trim();
                if (slice) pieces.push(slice);
                if (end >= sentence.length) break;
                pos = Math.max(pos + 1, end - overlapLen);
                if (pos > sentence.length - 10 && step > 0) break;
            }
            continue;
        }

        const candidate = current ? `${current} ${sentence}` : sentence;
        if (candidate.length <= maxLen) {
            current = candidate;
        } else {
            if (current.trim()) pieces.push(current.trim());
            const tail = overlapLen > 0 && current.length > overlapLen
                ? current.slice(-overlapLen).replace(/^\S*\s+/, '').trim()
                : '';
            const prefixed = tail ? `${tail} ${sentence}` : sentence;
            current = prefixed.length <= maxLen ? prefixed : sentence;
        }
    }

    if (current.trim()) pieces.push(current.trim());
    return pieces;
}

/**
 * Splits a document into heading-aware, paragraph-aligned chunks with optional overlap.
 */
export function sliceDocument(text, { chunkSize = 1000, overlap = 120 } = {}) {
    const raw = String(text ?? '').replace(/\r\n?/g, '\n').trim();
    if (!raw) return [];

    const maxLen = Math.max(60, Number(chunkSize) || 1000);
    const overlapLen = Math.max(0, Math.min(Math.floor(maxLen / 2), Number(overlap) || 0));

    const lines = raw.split('\n');
    const sections = [];
    let currentHeading = '';
    let bufferLines = [];

    const flushParagraphs = (heading, blockLines) => {
        const block = blockLines.join('\n').trim();
        if (!block) return;
        const paragraphs = block.split(/\n{2,}/);
        for (const para of paragraphs) {
            const pTrimmed = para.trim();
            if (!pTrimmed) continue;
            sections.push({ heading, text: pTrimmed });
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const headingMatch = trimmed.match(SECTION_HEADING_RE);
        if (headingMatch) {
            flushParagraphs(currentHeading, bufferLines);
            currentHeading = (headingMatch[1] || headingMatch[2] || '').trim();
            bufferLines = [line];
        } else {
            bufferLines.push(line);
        }
    }
    flushParagraphs(currentHeading, bufferLines);

    const chunks = [];
    let pending = '';
    let pendingHeading = '';
    let cursor = 0;

    const pushChunk = (chunkText, heading) => {
        const clean = chunkText.trim();
        if (!clean) return;
        const foundAt = raw.indexOf(clean.slice(0, Math.min(40, clean.length)), Math.max(0, cursor - overlapLen));
        const start = foundAt >= 0 ? foundAt : cursor;
        const end = Math.min(raw.length, start + clean.length);
        chunks.push({
            index: chunks.length,
            start,
            end,
            heading: heading || '',
            text: clean,
        });
        cursor = end;
    };

    for (const sec of sections) {
        const headingChanged = sec.heading && pendingHeading && sec.heading !== pendingHeading;
        if (sec.text.length > maxLen) {
            if (pending.trim()) {
                pushChunk(pending, pendingHeading);
                pending = '';
                pendingHeading = '';
            }
            const subParts = splitLongBlock(sec.text, maxLen, overlapLen);
            for (const part of subParts) {
                pushChunk(part, sec.heading);
            }
            continue;
        }

        if (headingChanged && pending.trim()) {
            pushChunk(pending, pendingHeading);
            pending = sec.text;
            pendingHeading = sec.heading;
            continue;
        }

        const candidate = pending ? `${pending}\n\n${sec.text}` : sec.text;
        if (candidate.length <= maxLen) {
            pending = candidate;
            if (!pendingHeading) pendingHeading = sec.heading;
        } else {
            if (pending.trim()) {
                pushChunk(pending, pendingHeading);
            }
            pending = sec.text;
            pendingHeading = sec.heading;
        }
    }

    if (pending.trim()) {
        pushChunk(pending, pendingHeading);
    }

    return chunks;
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSelectedSlices(selected, totalChunks, maxChars) {
    const needLabels = selected.length < totalChunks;
    const parts = [];
    let used = 0;

    for (let i = 0; i < selected.length; i++) {
        const chunk = selected[i];
        const prefix = needLabels ? `[Slice ${chunk.index + 1}/${totalChunks}]\n` : '';
        const sep = i > 0 ? '\n\n' : '';
        const room = maxChars - used - sep.length - prefix.length;
        if (room <= 20) break;

        let body = chunk.text;
        if (body.length > room) {
            body = `${body.slice(0, Math.max(0, room - 1)).trimEnd()}…`;
        }
        const entry = `${sep}${prefix}${body}`;
        parts.push(entry);
        used += entry.length;
    }

    return parts.join('');
}

/**
 * Selects query-relevant document slices within a character budget to maximize Gemini token usage.
 */
export function selectRelevantSlices(
    text,
    query = '',
    {
        maxChars = 4000,
        chunkSize = 1000,
        overlap = 120,
        preserveLead = true,
        priorityHeadings = [],
    } = {}
) {
    const raw = String(text ?? '');
    const originalChars = raw.length;
    const budget = Math.max(80, Number(maxChars) || 4000);

    if (originalChars <= budget) {
        return {
            text: raw,
            slices: raw
                ? [{ index: 0, start: 0, end: originalChars, heading: '', text: raw }]
                : [],
            totalChunks: raw ? 1 : 0,
            keptChunks: raw ? 1 : 0,
            originalChars,
            slicedChars: originalChars,
            savedChars: 0,
            savedPercent: 0,
            wasSliced: false,
        };
    }

    const effectiveChunkSize = Math.min(Math.max(80, Number(chunkSize) || 1000), budget - 32);
    const chunks = sliceDocument(raw, {
        chunkSize: effectiveChunkSize,
        overlap: Math.min(overlap, Math.floor(effectiveChunkSize / 3)),
    });

    if (chunks.length === 0) {
        return {
            text: '',
            slices: [],
            totalChunks: 0,
            keptChunks: 0,
            originalChars,
            slicedChars: 0,
            savedChars: originalChars,
            savedPercent: 100,
            wasSliced: true,
        };
    }

    const queryTerms = tokenizeQuery(query);
    const queryPhrases = buildBigramPhrases(query);
    const priorityTerms = (Array.isArray(priorityHeadings) ? priorityHeadings : [])
        .map(h => String(h || '').toLowerCase().trim())
        .filter(Boolean);

    const chunkTextsLower = chunks.map(c => c.text.toLowerCase());
    const docFreq = new Map();
    for (const term of queryTerms) {
        let df = 0;
        for (const lower of chunkTextsLower) {
            if (lower.includes(term)) df += 1;
        }
        docFreq.set(term, df);
    }

    const scored = chunks.map((chunk, idx) => {
        const lower = chunkTextsLower[idx];
        const headingLower = (chunk.heading || '').toLowerCase();
        const firstLineLower = lower.split('\n')[0] || '';
        let score = 0;

        for (const term of queryTerms) {
            const pattern = new RegExp(escapeRegExp(term), 'g');
            const matches = lower.match(pattern);
            if (!matches || matches.length === 0) continue;
            const tf = 1 + Math.log(matches.length);
            const idf = Math.log((chunks.length + 1) / ((docFreq.get(term) || 0) + 1)) + 1;
            const headingBoost = headingLower.includes(term) ? 1.5 : 1;
            score += tf * idf * headingBoost;
        }

        for (const phrase of queryPhrases) {
            if (lower.includes(phrase)) {
                score += 4;
            }
        }

        for (const pHeading of priorityTerms) {
            if (headingLower && headingLower.includes(pHeading)) {
                score += 4;
            } else if (firstLineLower.includes(pHeading)) {
                score += 2;
            }
        }

        // Mild position decay breaks ties in favor of earlier well-structured sections
        score += 0.25 / (1 + chunk.index * 0.15);

        return { chunk, score };
    });

    const chosenIndices = new Set();
    let estimatedUsed = 0;
    const labelOverhead = chunks.length > 1 ? `[Slice ${chunks.length}/${chunks.length}]\n`.length + 2 : 0;

    if (preserveLead && chunks[0].text.length + labelOverhead <= budget) {
        chosenIndices.add(0);
        estimatedUsed += chunks[0].text.length + labelOverhead;
    }

    const ranked = [...scored].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.chunk.index - b.chunk.index;
    });

    for (const item of ranked) {
        if (chosenIndices.has(item.chunk.index)) continue;
        const needed = item.chunk.text.length + (chosenIndices.size > 0 ? 2 : 0) + labelOverhead;
        if (estimatedUsed + needed <= budget) {
            chosenIndices.add(item.chunk.index);
            estimatedUsed += needed;
        }
    }

    if (chosenIndices.size === 0) {
        chosenIndices.add(ranked[0].chunk.index);
    }

    const selected = [...chosenIndices]
        .sort((a, b) => a - b)
        .map(idx => chunks[idx]);

    const resultText = formatSelectedSlices(selected, chunks.length, budget);
    const slicedChars = resultText.length;
    const savedChars = Math.max(0, originalChars - slicedChars);
    const savedPercent = originalChars > 0 ? Math.round((savedChars / originalChars) * 100) : 0;

    return {
        text: resultText,
        slices: selected,
        totalChunks: chunks.length,
        keptChunks: selected.length,
        originalChars,
        slicedChars,
        savedChars,
        savedPercent,
        wasSliced: selected.length < chunks.length || slicedChars < originalChars,
    };
}

/**
 * Slices an array of context documents across a shared character budget, redistributing
 * unused budget from shorter documents to longer ones.
 */
export function sliceDocumentsForPrompt(
    docs,
    query = '',
    {
        totalBudgetChars = 6000,
        maxPerDocChars = 2400,
        chunkSize = 900,
        overlap = 100,
        priorityHeadings = [],
    } = {}
) {
    const validDocs = (Array.isArray(docs) ? docs : [])
        .filter(d => d && typeof d.content === 'string' && d.content.trim().length > 0)
        .map((d, idx) => ({
            origIndex: idx,
            id: d.id || `doc_${idx + 1}`,
            name: d.name || d.label || `Document ${idx + 1}`,
            content: d.content,
        }));

    if (validDocs.length === 0) {
        return {
            items: [],
            text: '',
            originalChars: 0,
            slicedChars: 0,
            savedChars: 0,
            savedPercent: 0,
            wasSliced: false,
        };
    }

    const originalChars = validDocs.reduce((sum, d) => sum + d.content.length, 0);
    const shortestFirst = [...validDocs].sort((a, b) => a.content.length - b.content.length);

    let remainingBudget = Math.max(200, Number(totalBudgetChars) || 6000);
    const resultsByOrigIndex = new Array(validDocs.length);

    for (let i = 0; i < shortestFirst.length; i++) {
        const docItem = shortestFirst[i];
        const docsLeft = shortestFirst.length - i;
        const header = `[Document: ${docItem.name}]\n`;
        const fairShare = Math.floor(remainingBudget / docsLeft);
        const docBudget = Math.max(80, Math.min(maxPerDocChars, fairShare) - header.length - (i > 0 ? 2 : 0));

        const sliced = selectRelevantSlices(docItem.content, query, {
            maxChars: docBudget,
            chunkSize: Math.min(chunkSize, docBudget),
            overlap,
            priorityHeadings,
        });

        const formattedBlock = `${header}${sliced.text}`;
        remainingBudget = Math.max(0, remainingBudget - formattedBlock.length - 2);

        resultsByOrigIndex[docItem.origIndex] = {
            id: docItem.id,
            name: docItem.name,
            originalChars: docItem.content.length,
            slicedChars: sliced.slicedChars,
            keptChunks: sliced.keptChunks,
            totalChunks: sliced.totalChunks,
            wasSliced: sliced.wasSliced,
            text: sliced.text,
            formattedBlock,
        };
    }

    const combinedText = resultsByOrigIndex.map(r => r.formattedBlock).join('\n\n');
    const slicedChars = resultsByOrigIndex.reduce((sum, r) => sum + r.slicedChars, 0);
    const savedChars = Math.max(0, originalChars - slicedChars);
    const savedPercent = originalChars > 0 ? Math.round((savedChars / originalChars) * 100) : 0;
    const wasSliced = resultsByOrigIndex.some(r => r.wasSliced);

    return {
        items: resultsByOrigIndex.map(r => ({
            id: r.id,
            name: r.name,
            originalChars: r.originalChars,
            slicedChars: r.slicedChars,
            keptChunks: r.keptChunks,
            totalChunks: r.totalChunks,
            wasSliced: r.wasSliced,
            text: r.text,
        })),
        text: combinedText,
        originalChars,
        slicedChars,
        savedChars,
        savedPercent,
        wasSliced,
    };
}
