export const INITIAL_CARDS_STACKED = 15;
export const INITIAL_CARDS_COLUMNS = 25;
export const LOAD_MORE_STEP = 25;
export const DEFERRED_CARD_THRESHOLD = 25;
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
 * Safely converts a profile `updatedAt` value (ISO string, epoch ms, Date, or Firestore Timestamp)
 * into epoch milliseconds, or 0 when absent/invalid.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function toProfileTimestampMs(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? value : 0;
    }
    if (typeof value === 'object') {
        if (typeof value.toMillis === 'function') {
            const ms = Number(value.toMillis());
            return Number.isFinite(ms) && ms > 0 ? ms : 0;
        }
        if (typeof value.seconds === 'number') {
            const ms = value.seconds * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1e6);
            return Number.isFinite(ms) && ms > 0 ? ms : 0;
        }
        if (value instanceof Date) {
            const ms = value.getTime();
            return Number.isFinite(ms) && ms > 0 ? ms : 0;
        }
    }
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Determines whether local profile state should be synced back to Firestore on snapshot load.
 * Returns true only when `hasLeakedEnvKey` is true, or `localTime > 0` and either remote has
 * no timestamp or `localTime > remoteTime` (preventing equal/older persisted `localStorage`
 * profiles from firing unprompted writes on read-only page loads).
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
    return safeLocal > safeRemote;
}
