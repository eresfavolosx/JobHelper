import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    INITIAL_CARDS_STACKED,
    INITIAL_CARDS_COLUMNS,
    LOAD_MORE_STEP,
    DEFERRED_CARD_THRESHOLD,
    getVisibleColumnCount,
    countWords,
    shouldSyncLocalProfileCatchup
} from './kanban-utils.js';

describe('kanban-utils: getVisibleColumnCount', () => {
    it('returns 0 for empty or invalid totals', () => {
        assert.equal(getVisibleColumnCount({ total: 0 }), 0);
        assert.equal(getVisibleColumnCount({ total: -5, isStacked: true }), 0);
        assert.equal(getVisibleColumnCount({ total: NaN }), 0);
    });

    it('uses conservative defaults for stacked vs columns view', () => {
        assert.equal(DEFERRED_CARD_THRESHOLD, 6);
        assert.equal(getVisibleColumnCount({ total: 181, isStacked: true }), INITIAL_CARDS_STACKED);
        assert.equal(getVisibleColumnCount({ total: 181, isStacked: false }), INITIAL_CARDS_COLUMNS);
        assert.equal(getVisibleColumnCount({ total: 8, isStacked: true }), 8);
    });

    it('expands monotonically by LOAD_MORE_STEP and clamps to total', () => {
        assert.equal(
            getVisibleColumnCount({ total: 181, isStacked: true, extraCount: LOAD_MORE_STEP }),
            INITIAL_CARDS_STACKED + LOAD_MORE_STEP
        );
        assert.equal(
            getVisibleColumnCount({ total: 30, isStacked: false, extraCount: LOAD_MORE_STEP }),
            30
        );
    });

    it('shows up to 50 matches while filtering and allows loading more beyond 50', () => {
        assert.equal(
            getVisibleColumnCount({ total: 40, isStacked: true, isFiltering: true }),
            40
        );
        assert.equal(
            getVisibleColumnCount({ total: 120, isStacked: true, isFiltering: true }),
            50
        );
        assert.equal(
            getVisibleColumnCount({ total: 120, isStacked: true, isFiltering: true, extraCount: 25 }),
            75
        );
    });

    it('expands to reveal a highlighted card from Global Search beyond the initial batch', () => {
        assert.equal(
            getVisibleColumnCount({ total: 181, isStacked: true, highlightedIndex: 42 }),
            43
        );
        assert.equal(
            getVisibleColumnCount({ total: 20, isStacked: true, highlightedIndex: 99 }),
            20
        );
    });
});

describe('kanban-utils: countWords', () => {
    it('handles empty, nullish, and whitespace-only inputs', () => {
        assert.equal(countWords(''), 0);
        assert.equal(countWords(null), 0);
        assert.equal(countWords(undefined), 0);
        assert.equal(countWords('   \n\t \u00a0  '), 0);
    });

    it('matches standard whitespace splitting across newlines, tabs, and unicode', () => {
        const samples = [
            'Hello',
            '  Senior   Software Engineer\n\tRemote · $180k ',
            'Line1\r\nLine2\u2003Line3\u00a0Line4',
            'Emoji 🚀 test — dash & punctuation!'
        ];
        for (const s of samples) {
            const expected = s.trim().split(/\s+/).filter(Boolean).length;
            assert.equal(countWords(s), expected);
        }
    });

    it('counts large 150k-character job descriptions quickly and accurately', () => {
        const block = 'Lead distributed systems engineering across cloud infrastructure. ';
        const huge = block.repeat(2500);
        assert.equal(countWords(huge), 7 * 2500);
    });
});

describe('kanban-utils: shouldSyncLocalProfileCatchup', () => {
    it('returns false when localTime is 0 unless a leaked env key must be scrubbed', () => {
        assert.equal(shouldSyncLocalProfileCatchup({ localTime: 0, remoteTime: 0 }), false);
        assert.equal(shouldSyncLocalProfileCatchup({ localTime: 0, remoteTime: 1700000000000 }), false);
        assert.equal(
            shouldSyncLocalProfileCatchup({ localTime: 0, remoteTime: 1700000000000, hasLeakedEnvKey: true }),
            true
        );
    });

    it('returns true when localTime is a positive timestamp', () => {
        assert.equal(shouldSyncLocalProfileCatchup({ localTime: 1700000000000, remoteTime: 0 }), true);
        assert.equal(shouldSyncLocalProfileCatchup({ localTime: 1700000001000, remoteTime: 1700000000000 }), true);
    });
});
