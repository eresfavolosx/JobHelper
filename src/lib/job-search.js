import { isToday } from './goal-tracker.js';

export const STAGE_LABELS = {
    wishlist: 'Wishlist',
    applied: 'Applied',
    screening: 'Initial Screening',
    interviewing: 'Interviewing',
    offer: 'Offer',
    accepted: 'Accepted',
    rejected: 'Rejected',
    archived: 'Archived',
    deleted: 'Deleted'
};

const FIELD_PREFIX_MAP = {
    company: 'company',
    c: 'company',
    org: 'company',
    role: 'role',
    r: 'role',
    title: 'role',
    location: 'location',
    loc: 'location',
    l: 'location',
    stage: 'status',
    status: 'status',
    s: 'status',
    salary: 'salary',
    pay: 'salary',
    comp: 'salary',
    resume: 'resume',
    cv: 'resume',
    notes: 'notes',
    note: 'notes',
    description: 'description',
    desc: 'description',
    jd: 'description',
    tag: 'tags',
    tags: 'tags',
    source: 'source'
};

const COMPACT_FIELDS = ['company', 'role', 'location', 'status', 'tags', 'resume', 'url', 'source'];
const FUZZY_WORD_FIELDS = ['company', 'role', 'location', 'status', 'tags', 'resume', 'source'];

/**
 * Normalizes text for accent-insensitive, case-insensitive search matching.
 */
export function normalizeSearchText(val = '') {
    return String(val || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

/**
 * Strips whitespace, hyphens, and punctuation so "open works" matches "OpenWorks".
 */
export function toCompactSearchText(val = '') {
    return normalizeSearchText(val).replace(/[^a-z0-9]/g, '');
}

/**
 * Computes Optimal String Alignment (restricted Damerau-Levenshtein) edit distance
 * with an early exit once every row exceeds maxDist.
 */
export function damerauLevenshtein(a, b, maxDist = 2) {
    const lenA = a.length;
    const lenB = b.length;
    if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
    if (lenA === 0) return lenB;
    if (lenB === 0) return lenA;

    const dp = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));
    for (let i = 0; i <= lenA; i++) dp[i][0] = i;
    for (let j = 0; j <= lenB; j++) dp[0][j] = j;

    for (let i = 1; i <= lenA; i++) {
        let rowMin = maxDist + 1;
        for (let j = 1; j <= lenB; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let best = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
            if (
                i > 1 &&
                j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1]
            ) {
                best = Math.min(best, dp[i - 2][j - 2] + cost);
            }
            dp[i][j] = best;
            if (best < rowMin) rowMin = best;
        }
        if (rowMin > maxDist) return maxDist + 1;
    }

    return dp[lenA][lenB];
}

function extractSearchWords(rawText) {
    const rawStr = String(rawText || '');
    if (!rawStr.trim()) return [];
    const seen = new Set();
    const out = [];

    const addToken = (tok) => {
        const clean = normalizeSearchText(tok).replace(/[^a-z0-9]/g, '');
        if (clean.length >= 2 && !seen.has(clean)) {
            seen.add(clean);
            out.push(clean);
        }
    };

    // Whole alphanumeric runs
    const wholeWords = normalizeSearchText(rawStr).match(/[a-z0-9]+/g) || [];
    for (const w of wholeWords) addToken(w);

    // Split camelCase / PascalCase boundaries (e.g. OpenWorks -> open, works)
    const splitCamel = rawStr.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    const subWords = normalizeSearchText(splitCamel).match(/[a-z0-9]+/g) || [];
    for (const sw of subWords) addToken(sw);

    return out;
}

function maxFuzzyDistanceForLength(len) {
    if (len >= 7) return 2;
    if (len >= 4) return 1;
    return 0;
}

function matchesFuzzyTerm(targetWords, targetCompact, queryTerm) {
    const cleanTerm = toCompactSearchText(queryTerm);
    const maxDist = maxFuzzyDistanceForLength(cleanTerm.length);
    if (maxDist <= 0) return false;

    for (const word of targetWords) {
        if (Math.abs(word.length - cleanTerm.length) > maxDist) continue;
        if (damerauLevenshtein(word, cleanTerm, maxDist) <= maxDist) {
            return true;
        }
    }

    if (targetCompact && Math.abs(targetCompact.length - cleanTerm.length) <= maxDist) {
        if (damerauLevenshtein(targetCompact, cleanTerm, maxDist) <= maxDist) {
            return true;
        }
    }

    return false;
}

/**
 * Parses a search query string into structured field filters (e.g. `company:stripe location:remote`)
 * and general free-text search tokens. Supports quoted phrases like `company:"Scale AI"`.
 *
 * @param {string} rawQuery
 * @returns {{ fieldFilters: Array<{ field: string, value: string }>, textTokens: string[], raw: string }}
 */
export function parseSearchQuery(rawQuery = '') {
    const raw = String(rawQuery || '').trim();
    if (!raw) {
        return { fieldFilters: [], textTokens: [], raw: '' };
    }

    const fieldFilters = [];
    const textTokens = [];

    // Match key:"quoted value", key:value, "quoted phrase", or single word token
    const tokenRegex = /([a-zA-Z]+):(?:"([^"]+)"|'([^']+)'|(\S+))|"([^"]+)"|'([^']+)'|(\S+)/g;
    let match;

    while ((match = tokenRegex.exec(raw)) !== null) {
        const prefixKey = match[1]?.toLowerCase();
        const prefixVal = normalizeSearchText(match[2] ?? match[3] ?? match[4] ?? '').trim();
        const quotedPhrase = normalizeSearchText(match[5] ?? match[6] ?? '').trim();
        const bareWord = normalizeSearchText(match[7] ?? '').trim();

        if (prefixKey && FIELD_PREFIX_MAP[prefixKey] && prefixVal) {
            fieldFilters.push({
                field: FIELD_PREFIX_MAP[prefixKey],
                value: prefixVal
            });
        } else if (prefixKey && prefixVal) {
            // Unrecognized prefix: treat the whole token as a free-text token
            textTokens.push(`${prefixKey}:${prefixVal}`);
        } else if (quotedPhrase) {
            textTokens.push(quotedPhrase);
        } else if (bareWord) {
            textTokens.push(bareWord);
        }
    }

    return { fieldFilters, textTokens, raw };
}

const searchableFieldsCache = new WeakMap();

/**
 * Normalizes a job object's searchable fields into lowercased diacritic-folded strings,
 * compact punctuation-free strings, and camelCase-aware words for fast fuzzy matching.
 */
function getSearchableFields(job) {
    if (job && typeof job === 'object') {
        const cached = searchableFieldsCache.get(job);
        if (
            cached &&
            cached.company === job.company &&
            cached.role === job.role &&
            cached.title === job.title &&
            cached.location === job.location &&
            cached.status === job.status &&
            cached.salary === job.salary &&
            cached.resumeName === job.resumeName &&
            cached.resumeUrl === job.resumeUrl &&
            cached.notes === job.notes &&
            cached.description === job.description &&
            cached.tags === job.tags &&
            cached.url === job.url &&
            cached.link === job.link &&
            cached.source === job.source
        ) {
            return cached.entry;
        }
    }

    const statusRaw = String(job?.status || '');
    const stageLabel = STAGE_LABELS[statusRaw.toLowerCase()] || statusRaw;
    const roleRaw = [job?.role, job?.title].filter(Boolean).join(' ');
    const urlRaw = [job?.url, job?.link].filter(Boolean).join(' ');
    const tagsRaw = Array.isArray(job?.tags) ? job.tags.join(' ') : String(job?.tags || '');
    const resumeRaw = [job?.resumeName, job?.resumeUrl].filter(Boolean).join(' ');
    const statusFull = `${statusRaw} ${stageLabel}`.trim();

    const fields = {
        company: normalizeSearchText(job?.company),
        role: normalizeSearchText(roleRaw),
        location: normalizeSearchText(job?.location),
        status: normalizeSearchText(statusFull),
        salary: normalizeSearchText(job?.salary),
        resume: normalizeSearchText(resumeRaw),
        notes: normalizeSearchText(job?.notes),
        description: normalizeSearchText(job?.description),
        tags: normalizeSearchText(tagsRaw),
        url: normalizeSearchText(urlRaw),
        source: normalizeSearchText(job?.source)
    };

    const compactFields = {
        company: toCompactSearchText(job?.company),
        role: toCompactSearchText(roleRaw),
        location: toCompactSearchText(job?.location),
        status: toCompactSearchText(statusFull),
        salary: toCompactSearchText(job?.salary),
        resume: toCompactSearchText(resumeRaw),
        tags: toCompactSearchText(tagsRaw),
        url: toCompactSearchText(urlRaw),
        source: toCompactSearchText(job?.source)
    };

    const fieldWords = {
        company: extractSearchWords(job?.company),
        role: extractSearchWords(roleRaw),
        location: extractSearchWords(job?.location),
        status: extractSearchWords(statusFull),
        salary: extractSearchWords(job?.salary),
        resume: extractSearchWords(resumeRaw),
        tags: extractSearchWords(tagsRaw),
        source: extractSearchWords(job?.source)
    };

    const entry = { fields, compactFields, fieldWords };

    if (job && typeof job === 'object') {
        searchableFieldsCache.set(job, {
            company: job.company,
            role: job.role,
            title: job.title,
            location: job.location,
            status: job.status,
            salary: job.salary,
            resumeName: job.resumeName,
            resumeUrl: job.resumeUrl,
            notes: job.notes,
            description: job.description,
            tags: job.tags,
            url: job.url,
            link: job.link,
            source: job.source,
            entry
        });
    }

    return entry;
}

/**
 * Evaluates whether a job matches the given search query and parameter filters,
 * and computes a relevance score and matched field names for UI highlighting.
 *
 * @param {object} job
 * @param {object} options
 * @param {string} [options.query]
 * @param {string} [options.companyFilter]
 * @param {string} [options.stageFilter]
 * @param {string} [options.locationFilter]
 * @param {string} [options.quickFilter]
 * @param {boolean} [options.includeDeleted]
 * @param {number} [options.nowMs]
 * @returns {{ matches: boolean, score: number, matchedFields: string[] }}
 */
export function evaluateJobMatch(job, options = {}) {
    if (!job || typeof job !== 'object') {
        return { matches: false, score: 0, matchedFields: [] };
    }

    const {
        query = '',
        companyFilter = 'all',
        stageFilter = 'all',
        locationFilter = 'all',
        quickFilter = 'all',
        includeDeleted = false,
        nowMs = Date.now()
    } = options;

    if (!includeDeleted && job.status === 'deleted' && stageFilter !== 'deleted') {
        return { matches: false, score: 0, matchedFields: [] };
    }

    // 1. Explicit Company parameter filter
    if (companyFilter && companyFilter !== 'all') {
        const jobCompany = normalizeSearchText(job.company).trim();
        if (jobCompany !== normalizeSearchText(companyFilter).trim()) {
            return { matches: false, score: 0, matchedFields: [] };
        }
    }

    // 2. Explicit Stage parameter filter
    if (stageFilter && stageFilter !== 'all') {
        if (String(job.status || '').toLowerCase() !== String(stageFilter).toLowerCase()) {
            return { matches: false, score: 0, matchedFields: [] };
        }
    }

    // 3. Explicit Location / Modality parameter filter
    let cachedEntry = null;
    const ensureEntry = () => {
        if (!cachedEntry) cachedEntry = getSearchableFields(job);
        return cachedEntry;
    };

    if (locationFilter && locationFilter !== 'all') {
        const { fields: fieldsForLoc } = ensureEntry();
        const locLower = fieldsForLoc.location;
        const notesLower = fieldsForLoc.notes;
        const filterVal = normalizeSearchText(locationFilter);

        if (filterVal === 'remote') {
            if (!locLower.includes('remote') && !notesLower.includes('remote')) {
                return { matches: false, score: 0, matchedFields: [] };
            }
        } else if (filterVal === 'hybrid') {
            if (!locLower.includes('hybrid') && !notesLower.includes('hybrid')) {
                return { matches: false, score: 0, matchedFields: [] };
            }
        } else if (filterVal === 'onsite') {
            const isRemoteOrHybrid = locLower.includes('remote') || locLower.includes('hybrid');
            if (!locLower || isRemoteOrHybrid) {
                return { matches: false, score: 0, matchedFields: [] };
            }
        } else if (!locLower.includes(filterVal)) {
            return { matches: false, score: 0, matchedFields: [] };
        }
    }

    // 4. Quick Filter presets
    if (quickFilter && quickFilter !== 'all') {
        if (quickFilter === 'today') {
            const refDate = job.appliedAt || job.createdAt || job.dateAdded;
            if (!isToday(refDate)) return { matches: false, score: 0, matchedFields: [] };
        } else if (quickFilter === 'followup') {
            if (job.status !== 'applied' && job.status !== 'screening' && job.status !== 'interviewing') {
                return { matches: false, score: 0, matchedFields: [] };
            }
            const refDate = job.updatedAt || job.appliedAt || job.createdAt || job.dateAdded;
            const days = refDate ? Math.max(0, Math.floor((nowMs - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;
            if (days < 5) return { matches: false, score: 0, matchedFields: [] };
        } else if (quickFilter === 'has-resume') {
            const hasResume = Boolean((job.resumeUrl && job.resumeUrl.trim()) || (job.resumeName && job.resumeName.trim()));
            if (!hasResume) return { matches: false, score: 0, matchedFields: [] };
        } else if (quickFilter === 'missing-resume') {
            const hasResume = Boolean((job.resumeUrl && job.resumeUrl.trim()) || (job.resumeName && job.resumeName.trim()));
            if (hasResume || job.status === 'deleted' || job.status === 'archived') {
                return { matches: false, score: 0, matchedFields: [] };
            }
        } else if (quickFilter === 'has-salary') {
            if (!job.salary || !String(job.salary).trim()) {
                return { matches: false, score: 0, matchedFields: [] };
            }
        } else if (quickFilter === 'archived') {
            if (job.status !== 'archived') {
                return { matches: false, score: 0, matchedFields: [] };
            }
        }
    }

    // 5. Query parsing & multi-parameter token matching
    const { fieldFilters, textTokens } = parseSearchQuery(query);
    if (fieldFilters.length === 0 && textTokens.length === 0) {
        return { matches: true, score: 1, matchedFields: [] };
    }

    const { fields, compactFields, fieldWords } = ensureEntry();
    const matchedFieldsSet = new Set();
    let score = 0;

    // Check explicit field:value filters (all must match, supporting spacing-insensitive and typo matching)
    for (const { field, value } of fieldFilters) {
        const targetText = fields[field] || '';
        const compactVal = toCompactSearchText(value);
        const targetCompact = compactFields[field] || '';
        const directMatch = targetText.includes(value);
        const compactMatch = !directMatch && compactVal.length >= 2 && targetCompact.includes(compactVal);
        const fuzzyMatch =
            !directMatch &&
            !compactMatch &&
            FUZZY_WORD_FIELDS.includes(field) &&
            matchesFuzzyTerm(fieldWords[field] || [], targetCompact, value);

        if (!directMatch && !compactMatch && !fuzzyMatch) {
            return { matches: false, score: 0, matchedFields: [] };
        }
        matchedFieldsSet.add(field);
        score += field === 'company' || field === 'role'
            ? (directMatch ? 30 : compactMatch ? 25 : 15)
            : (directMatch ? 15 : 10);
    }

    if (textTokens.length === 0) {
        return {
            matches: true,
            score,
            matchedFields: Array.from(matchedFieldsSet)
        };
    }

    // Joined compact match: catches split-word queries like "open works" -> "OpenWorks" or typos like "ropen works" -> "OpenWorks"
    let joinedCompactMatchField = null;
    if (textTokens.length >= 2) {
        const joinedCompact = textTokens.map(toCompactSearchText).join('');
        if (joinedCompact.length >= 4) {
            const joinedMaxDist = joinedCompact.length >= 8 ? 2 : joinedCompact.length >= 5 ? 1 : 0;
            for (const candidateField of ['company', 'role', 'url', 'source']) {
                const compactTarget = compactFields[candidateField] || '';
                if (!compactTarget) continue;
                if (compactTarget.includes(joinedCompact)) {
                    joinedCompactMatchField = candidateField;
                    matchedFieldsSet.add(candidateField);
                    score += candidateField === 'company' ? 40 : candidateField === 'role' ? 35 : 12;
                    break;
                }
                if (joinedMaxDist > 0 && Math.abs(compactTarget.length - joinedCompact.length) <= joinedMaxDist) {
                    if (damerauLevenshtein(compactTarget, joinedCompact, joinedMaxDist) <= joinedMaxDist) {
                        joinedCompactMatchField = candidateField;
                        matchedFieldsSet.add(candidateField);
                        score += candidateField === 'company' ? 28 : candidateField === 'role' ? 24 : 8;
                        break;
                    }
                }
            }
        }
    }

    // Check free-text tokens (every token must match directly, compactly, or via structured-field typo tolerance)
    for (const token of textTokens) {
        let tokenMatched = false;

        if (fields.company.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('company');
            score += fields.company === token ? 50 : fields.company.startsWith(token) ? 35 : 25;
        }
        if (fields.role.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('role');
            score += fields.role === token ? 45 : fields.role.startsWith(token) ? 30 : 20;
        }
        if (fields.location.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('location');
            score += 15;
        }
        if (fields.status.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('status');
            score += 12;
        }
        if (fields.salary.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('salary');
            score += 12;
        }
        if (fields.resume.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('resume');
            score += 10;
        }
        if (fields.tags.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('tags');
            score += 10;
        }
        if (fields.notes.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('notes');
            score += 6;
        }
        if (fields.description && fields.description.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('description');
            score += 15;
        }
        if (fields.url.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('url');
            score += 4;
        }
        if (fields.source && fields.source.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('source');
            score += 6;
        }

        const compactToken = toCompactSearchText(token);
        if (!tokenMatched && compactToken.length >= 2) {
            for (const fieldName of COMPACT_FIELDS) {
                if (compactFields[fieldName]?.includes(compactToken)) {
                    tokenMatched = true;
                    matchedFieldsSet.add(fieldName);
                    score += fieldName === 'company' ? 22 : fieldName === 'role' ? 18 : 8;
                }
            }
        }

        if (!tokenMatched) {
            for (const fieldName of FUZZY_WORD_FIELDS) {
                if (matchesFuzzyTerm(fieldWords[fieldName] || [], compactFields[fieldName], token)) {
                    tokenMatched = true;
                    matchedFieldsSet.add(fieldName);
                    score += fieldName === 'company' ? 12 : fieldName === 'role' ? 10 : 5;
                }
            }
        }

        if (!tokenMatched && joinedCompactMatchField) {
            // Whole query already matched a compound field name like OpenWorks directly/within typo tolerance
            tokenMatched = true;
        }

        if (!tokenMatched) {
            return { matches: false, score: 0, matchedFields: [] };
        }
    }

    return {
        matches: true,
        score,
        matchedFields: Array.from(matchedFieldsSet)
    };
}

/**
 * Sorts a list of jobs according to the selected sort mode.
 *
 * @param {Array<object>} jobs
 * @param {'default' | 'updated' | 'newest' | 'company-asc' | 'role-asc'} sortBy
 * @returns {Array<object>}
 */
export function sortJobsList(jobs = [], sortBy = 'default') {
    if (!Array.isArray(jobs) || sortBy === 'default' || jobs.length <= 1) {
        return jobs;
    }

    const copy = [...jobs];
    if (sortBy === 'company-asc') {
        return copy.sort((a, b) =>
            String(a?.company || '').localeCompare(String(b?.company || ''), undefined, { sensitivity: 'base' })
        );
    }
    if (sortBy === 'role-asc') {
        return copy.sort((a, b) =>
            String(a?.role || '').localeCompare(String(b?.role || ''), undefined, { sensitivity: 'base' })
        );
    }
    if (sortBy === 'newest') {
        return copy.sort((a, b) => {
            const aTime = new Date(a?.appliedAt || a?.createdAt || a?.dateAdded || 0).getTime() || 0;
            const bTime = new Date(b?.appliedAt || b?.createdAt || b?.dateAdded || 0).getTime() || 0;
            return bTime - aTime;
        });
    }
    if (sortBy === 'updated') {
        return copy.sort((a, b) => {
            const aTime = new Date(a?.updatedAt || a?.appliedAt || a?.createdAt || a?.dateAdded || 0).getTime() || 0;
            const bTime = new Date(b?.updatedAt || b?.appliedAt || b?.createdAt || b?.dateAdded || 0).getTime() || 0;
            return bTime - aTime;
        });
    }
    return copy;
}

/**
 * Extracts facet counts (companies, locations, stages) from the user's tracked jobs
 * to power instant company pills and parameter dropdowns.
 *
 * @param {Array<object>} jobs
 * @returns {{
 *   companies: Array<{ name: string, key: string, count: number }>,
 *   locations: Array<{ name: string, key: string, count: number }>,
 *   stages: Record<string, number>
 * }}
 */
export function extractJobFacets(jobs = []) {
    const companyMap = new Map();
    const locationMap = new Map();
    const stages = {};

    if (!Array.isArray(jobs)) {
        return { companies: [], locations: [], stages };
    }

    for (const job of jobs) {
        if (!job) continue;
        const status = job.status || 'wishlist';
        stages[status] = (stages[status] || 0) + 1;

        if (status === 'deleted') continue;

        const rawCompany = String(job.company || '').trim();
        if (rawCompany) {
            const key = rawCompany.toLowerCase();
            const existing = companyMap.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                companyMap.set(key, { name: rawCompany, key, count: 1 });
            }
        }

        const rawLocation = String(job.location || '').trim();
        if (rawLocation) {
            const key = rawLocation.toLowerCase();
            const existing = locationMap.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                locationMap.set(key, { name: rawLocation, key, count: 1 });
            }
        }
    }

    const companies = Array.from(companyMap.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    const locations = Array.from(locationMap.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return { companies, locations, stages };
}
