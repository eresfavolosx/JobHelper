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
    tag: 'tags',
    tags: 'tags'
};

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
        const prefixVal = (match[2] ?? match[3] ?? match[4] ?? '').trim().toLowerCase();
        const quotedPhrase = (match[5] ?? match[6] ?? '').trim().toLowerCase();
        const bareWord = (match[7] ?? '').trim().toLowerCase();

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

/**
 * Normalizes a job object's searchable fields into lowercased strings.
 */
function getSearchableFields(job) {
    const status = String(job?.status || '').toLowerCase();
    const stageLabel = (STAGE_LABELS[status] || status).toLowerCase();
    const tagsStr = Array.isArray(job?.tags) ? job.tags.join(' ') : String(job?.tags || '');

    return {
        company: String(job?.company || '').toLowerCase(),
        role: String(job?.role || '').toLowerCase(),
        location: String(job?.location || '').toLowerCase(),
        status: `${status} ${stageLabel}`.trim(),
        salary: String(job?.salary || '').toLowerCase(),
        resume: `${job?.resumeName || ''} ${job?.resumeUrl || ''}`.toLowerCase(),
        notes: String(job?.notes || '').toLowerCase(),
        tags: tagsStr.toLowerCase(),
        url: String(job?.url || '').toLowerCase()
    };
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
        const jobCompany = String(job.company || '').trim().toLowerCase();
        if (jobCompany !== String(companyFilter).trim().toLowerCase()) {
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
    if (locationFilter && locationFilter !== 'all') {
        const locLower = String(job.location || '').toLowerCase();
        const notesLower = String(job.notes || '').toLowerCase();
        const filterVal = String(locationFilter).toLowerCase();

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

    const fields = getSearchableFields(job);
    const matchedFieldsSet = new Set();
    let score = 0;

    // Check explicit field:value filters (all must match)
    for (const { field, value } of fieldFilters) {
        const targetText = fields[field] || '';
        if (!targetText.includes(value)) {
            return { matches: false, score: 0, matchedFields: [] };
        }
        matchedFieldsSet.add(field);
        score += field === 'company' || field === 'role' ? 30 : 15;
    }

    // Check free-text tokens (every token must match at least one parameter on the job)
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
        if (fields.url.includes(token)) {
            tokenMatched = true;
            matchedFieldsSet.add('url');
            score += 4;
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
