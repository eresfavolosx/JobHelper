export const INITIAL_CARDS_STACKED = 15;
export const INITIAL_CARDS_COLUMNS = 25;
export const LOAD_MORE_STEP = 25;
export const DEFERRED_CARD_THRESHOLD = 6;
const FILTERED_INITIAL_CAP = 50;

/**
 * Computes how many cards a Kanban column should render in the DOM
 * to keep large pipelines fast and below mobile GPU memory limits.
 *
 * @param {object} params
 * @param {number} params.total
 * @param {boolean} [params.isStacked]
 * @param {boolean} [params.isFiltering]
 * @param {number} [params.extraCount]
 * @param {number} [params.highlightedIndex]
 * @returns {number}
 */
export function getVisibleColumnCount({
    total,
    isStacked = false,
    isFiltering = false,
    extraCount = 0,
    highlightedIndex = -1
} = {}) {
    const safeTotal = Math.max(0, Number(total) || 0);
    if (safeTotal === 0) return 0;

    const base = isStacked ? INITIAL_CARDS_STACKED : INITIAL_CARDS_COLUMNS;
    const effectiveBase = isFiltering ? Math.max(base, FILTERED_INITIAL_CAP) : base;
    const safeExtra = Math.max(0, Number(extraCount) || 0);
    const safeHighlightIdx = Number.isInteger(highlightedIndex) ? highlightedIndex : -1;

    const limit = Math.max(
        effectiveBase + safeExtra,
        safeHighlightIdx >= 0 ? safeHighlightIdx + 1 : 0
    );

    return Math.min(safeTotal, limit);
}

/**
 * Counts whitespace-delimited words in a single pass without allocating intermediate arrays.
 * Matches `String(text).trim().split(/\s+/).filter(Boolean).length`.
 *
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
    if (typeof text !== 'string' || text.length === 0) return 0;

    let count = 0;
    let inWord = false;

    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        const isWhitespace =
            code === 32 ||
            (code >= 9 && code <= 13) ||
            (code >= 0x00a0 && /\s/.test(text[i]));

        if (isWhitespace) {
            inWord = false;
        } else if (!inWord) {
            count++;
            inWord = true;
        }
    }

    return count;
}

/**
 * Determines whether local profile state should be synced back to Firestore on snapshot load.
 * Prevents unedited DEFAULT_PROFILE defaults (`localTime === 0`) from triggering spurious writes.
 *
 * @param {object} params
 * @param {number} [params.localTime]
 * @param {number} [params.remoteTime]
 * @param {boolean} [params.hasLeakedEnvKey]
 * @returns {boolean}
 */
export function shouldSyncLocalProfileCatchup({
    localTime = 0,
    remoteTime = 0,
    hasLeakedEnvKey = false
} = {}) {
    if (hasLeakedEnvKey) return true;
    const safeLocal = Number(localTime);
    const safeRemote = Number(remoteTime);
    if (!Number.isFinite(safeLocal) || safeLocal <= 0) return false;
    if (!Number.isFinite(safeRemote) || safeRemote <= 0) return true;
    return safeLocal > 0;
}
