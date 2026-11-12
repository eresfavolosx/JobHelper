/**
 * Explainable Job Extraction, Eligibility Gating, Evidence Matching,
 * Duplicate Detection, Coverage Tracking & Ranking Engine.
 *
 * Notice: Never uses protected characteristics (age, race, gender, religion,
 * disability, marital status, national origin, etc.) in scoring or gating.
 */

export const DEFAULT_SALARY_FLOOR = 85000;
export const TTKE_FALLBACK_SALARY_FLOOR = 70000;

export const ELIGIBILITY_OUTCOMES = Object.freeze({
    PASS: 'pass',
    FAIL: 'fail',
    UNKNOWN: 'unknown',
});

export const RECOMMENDATION_LABELS = Object.freeze({
    RECOMMEND: 'Recommend',
    WORTHWHILE_STRETCH: 'Worthwhile stretch',
    NEEDS_CLARIFICATION: 'Needs clarification',
    SKIP: 'Skip',
});

export const SCORE_WEIGHTS = Object.freeze({
    coreDuties: 40,
    requiredSkills: 25,
    ownershipSeniority: 15,
    industryContext: 10,
    workingArrangement: 10,
});

export const TARGET_ROLE_FAMILIES = [
    {
        id: 'growth_performance_marketing',
        label: 'Growth & Performance Marketing',
        keywords: ['growth marketing', 'performance marketing', 'paid acquisition', 'paid media', 'user acquisition', 'demand generation', 'media buying', 'roas', 'cac', 'ltv', 'funnel optimization'],
    },
    {
        id: 'marketing_operations',
        label: 'Marketing Operations',
        keywords: ['marketing operations', 'marketing ops', 'mops', 'martech', 'crm operations', 'attribution', 'hubspot', 'marketo', 'salesforce marketing', 'marketing automation'],
    },
    {
        id: 'lifecycle_marketing',
        label: 'Lifecycle Marketing',
        keywords: ['lifecycle', 'retention marketing', 'email marketing', 'crm', 'onboarding', 'churn', 'reactivation', 'customer engagement'],
    },
    {
        id: 'gtm_product_marketing',
        label: 'GTM & Product Marketing',
        keywords: ['product marketing', 'go-to-market', 'gtm', 'positioning', 'messaging', 'launch', 'sales enablement', 'competitive intelligence'],
    },
    {
        id: 'business_intelligence',
        label: 'Business Intelligence & Marketing Analytics',
        keywords: ['business intelligence', 'bi analyst', 'marketing analytics', 'data analyst', 'sql', 'looker', 'tableau', 'power bi', 'kpi', 'reporting', 'cohort analysis', 'experimentation'],
    },
    {
        id: 'technical_program_management',
        label: 'Technical Program Management',
        keywords: ['technical program manager', 'program manager', 'program coordinator', 'project manager', 'delivery manager', 'cross-functional', 'roadmap', 'agile', 'scrum'],
    },
    {
        id: 'practical_ai_operations',
        label: 'Practical AI Operations',
        keywords: ['ai operations', 'ai ops', 'ai workflow', 'llm', 'prompt engineering', 'automation', 'ai implementation', 'generative ai', 'ai enablement'],
    },
];

/**
 * Default evidence-backed profile for Fabián Vélez.
 * "Co-Founder" is recorded as experience evidence (agency leadership, client management,
 * budgets, marketing, delivery), NOT as a default target title.
 */
export const DEFAULT_CANDIDATE_PROFILE = {
    residence: 'Puerto Rico',
    salaryFloor: DEFAULT_SALARY_FLOOR,
    allowNonSeniorRoles: true,
    careerHistoryNote: 'Co-Founder experience provides evidence of agency leadership, client management, budgets, marketing, and delivery—not a default target title.',
    targetRoleFamilies: TARGET_ROLE_FAMILIES.map(f => f.label),
    completedDegrees: ["Bachelor's Degree"],
    licenses: [],
    periods: [
        {
            id: 'agency-cofounder',
            title: 'Co-Founder & Marketing/Operations Lead',
            organization: 'Digital Agency',
            start: '2020-01',
            end: '2025-10',
            roleType: 'leadership',
            handsOn: true,
        },
        {
            id: 'growth-bi-consulting',
            title: 'Growth Marketing & BI Analytics Consultant',
            organization: 'Client Portfolio (incl. Healthcare & SaaS)',
            start: '2022-06',
            end: '2025-06',
            roleType: 'hands-on',
            handsOn: true,
        },
    ],
    evidenceItems: [
        {
            id: 'ev-agency-leadership',
            competency: 'Agency Leadership, Client Management, Budgets & Delivery',
            strength: 'direct',
            roleType: 'leadership',
            source: 'Co-Founder experience',
            project: 'Agency P&L, client accounts, multi-channel retainers, vendor delivery',
            outcome: 'Managed client budgets, delivery timelines, and multi-disciplinary marketing execution',
            keywords: ['agency', 'client management', 'budget', 'stakeholder', 'delivery', 'cross-functional', 'vendor', 'roadmap', 'p&l', 'program management', 'project management', 'account management'],
        },
        {
            id: 'ev-growth-performance',
            competency: 'Growth, Paid Media & Performance Marketing',
            strength: 'direct',
            roleType: 'hands-on',
            source: 'Co-Founder & Growth Consulting',
            project: 'Multi-channel acquisition & conversion optimization campaigns',
            outcome: 'Planned and optimized paid search/social funnels, CAC/ROAS tracking, and landing page experiments',
            keywords: ['growth', 'performance marketing', 'paid media', 'paid search', 'paid social', 'google ads', 'meta ads', 'acquisition', 'demand generation', 'cro', 'a/b testing', 'roas', 'cac', 'funnel'],
        },
        {
            id: 'ev-mops-lifecycle',
            competency: 'Marketing Operations, Lifecycle & CRM Automation',
            strength: 'direct',
            roleType: 'hands-on',
            source: 'Agency & Consulting Operations',
            project: 'CRM segmentation, lifecycle nurture flows, attribution & martech stack setup',
            outcome: 'Built automated lifecycle journeys, lead scoring, and campaign attribution reporting',
            keywords: ['marketing operations', 'martech', 'lifecycle', 'crm', 'email marketing', 'retention', 'hubspot', 'automation', 'attribution', 'segmentation', 'lead scoring', 'nurture'],
        },
        {
            id: 'ev-gtm-pmm',
            competency: 'GTM & Product Marketing',
            strength: 'direct',
            roleType: 'leadership',
            source: 'Agency & Product Launches',
            project: 'Positioning, messaging, launch playbooks, and sales/client enablement',
            outcome: 'Crafted value propositions, ICP messaging, and go-to-market launch collateral',
            keywords: ['gtm', 'go-to-market', 'product marketing', 'positioning', 'messaging', 'launch', 'enablement', 'icp', 'competitive'],
        },
        {
            id: 'ev-bi-sql',
            competency: 'BI & SQL Analytics',
            strength: 'direct',
            roleType: 'hands-on',
            source: 'Analytics & Reporting Work',
            project: 'SQL querying, KPI dashboards, cohort & funnel performance reporting',
            outcome: 'Built executive KPI dashboards and SQL-backed marketing/business performance analyses',
            keywords: ['sql', 'bi', 'business intelligence', 'analytics', 'dashboard', 'reporting', 'kpi', 'cohort', 'tableau', 'looker', 'power bi', 'ga4', 'google analytics', 'metrics', 'data analysis'],
        },
        {
            id: 'ev-ai-ops',
            competency: 'Practical AI Operations & Workflow Automation',
            strength: 'direct',
            roleType: 'hands-on',
            source: 'NovuJobs / AI Workflow Tooling',
            project: 'LLM-assisted workflows, prompt pipelines, automated classification & operational tooling',
            outcome: 'Designed and shipped practical AI-assisted operational workflows with safety/cost controls',
            keywords: ['ai operations', 'ai workflow', 'llm', 'prompt', 'generative ai', 'gemini', 'openai', 'workflow automation', 'ai enablement', 'ai tools'],
        },
        {
            id: 'ev-healthcare-marketing',
            competency: 'Healthcare Marketing Context (Non-Clinical)',
            strength: 'transferable',
            roleType: 'hands-on',
            source: 'Healthcare client marketing campaigns',
            project: 'Patient/provider marketing campaigns in healthcare vertical',
            outcome: 'Delivered compliant healthcare marketing assets without clinical, nursing, or HIPAA compliance ownership',
            keywords: ['healthcare', 'health tech', 'healthtech', 'patient acquisition', 'medical marketing'],
        },
    ],
};

/**
 * Compute total unique (non-overlapping) months of experience across intervals.
 * Prevents summing concurrent job periods to inflate years of experience.
 */
export function computeNonOverlappingMonths(periods = []) {
    if (!Array.isArray(periods) || periods.length === 0) return 0;

    const parseYearMonth = (val) => {
        if (!val) return null;
        if (String(val).toLowerCase() === 'present' || String(val).toLowerCase() === 'current') {
            const now = new Date();
            return now.getFullYear() * 12 + now.getMonth();
        }
        const match = String(val).trim().match(/^(\d{4})(?:-(\d{1,2}))?/);
        if (!match) return null;
        const year = Number(match[1]);
        const month = match[2] ? Math.min(12, Math.max(1, Number(match[2]))) - 1 : 0;
        return year * 12 + month;
    };

    const intervals = periods
        .map(p => {
            const start = parseYearMonth(p?.start);
            const end = parseYearMonth(p?.end || 'present');
            if (start === null || end === null) return null;
            return start <= end ? [start, end] : [end, start];
        })
        .filter(Boolean)
        .sort((a, b) => a[0] - b[0]);

    if (intervals.length === 0) return 0;

    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i += 1) {
        const [curStart, curEnd] = intervals[i];
        const prev = merged[merged.length - 1];
        if (curStart <= prev[1] + 1) {
            prev[1] = Math.max(prev[1], curEnd);
        } else {
            merged.push([curStart, curEnd]);
        }
    }

    return merged.reduce((sum, [s, e]) => sum + (e - s + 1), 0);
}

/**
 * Normalize employer string for duplicate matching.
 */
export function normalizeEmployerName(name = '') {
    return String(name || '')
        .toLowerCase()
        .replace(/\b(inc|llc|ltd|corp|corporation|co|company|gmbh|plc)\b\.?/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * Canonicalize a job URL for duplicate detection (strips utm/ref tracking params).
 */
export function canonicalizeJobUrl(rawUrl = '') {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return '';
    try {
        const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const u = new URL(withProtocol);
        const dropParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source', 'trk', 'fbclid', 'gclid'];
        for (const p of dropParams) {
            u.searchParams.delete(p);
        }
        const path = u.pathname.replace(/\/+$/, '') || '/';
        const qs = u.searchParams.toString();
        return `${u.hostname.toLowerCase()}${path}${qs ? `?${qs}` : ''}`;
    } catch {
        return trimmed.toLowerCase().replace(/\/+$/, '');
    }
}

/**
 * Extract employer & role from common RSS/board title formats.
 */
export function parsePostingHeader(rawTitle = '', rawSource = '', explicitEmployer = '') {
    const title = String(rawTitle || '').trim();
    let employer = String(explicitEmployer || '').trim();
    let roleTitle = title;

    if (!employer) {
        if (title.includes(': ')) {
            const [comp, ...rest] = title.split(': ');
            if (comp && rest.length > 0) {
                employer = comp.trim();
                roleTitle = rest.join(': ').trim();
            }
        } else if (title.includes(' at ')) {
            const parts = title.split(' at ');
            if (parts.length >= 2) {
                roleTitle = parts[0].trim();
                employer = parts.slice(1).join(' at ').trim();
            }
        } else if (title.includes(' - ')) {
            const [first, ...rest] = title.split(' - ');
            if (first && rest.length > 0) {
                employer = first.trim();
                roleTitle = rest.join(' - ').trim();
            }
        }
    }

    return {
        employer: employer || rawSource || 'Unknown Employer',
        roleTitle: roleTitle || title || 'Untitled Role',
    };
}

function findQuoteMatching(text, regex) {
    const match = text.match(regex);
    if (!match) return '';
    const idx = match.index ?? 0;
    const start = Math.max(0, idx - 35);
    const end = Math.min(text.length, idx + match[0].length + 60);
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function parseSalaryFacts(text) {
    const clean = String(text || '').replace(/\s+/g, ' ');
    const lower = clean.toLowerCase();

    // Check stipend / course / fellowship pay first so we never mistake it for guaranteed annual salary
    const stipendMatch = clean.match(/(\$|usd\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:\/\s*(?:wk|week|mo|month)|per\s+(?:week|month|course))?\s*(?:course\s+)?stipend|stipend\s*(?:of|:)?\s*\$?\s*(\d{1,3}(?:,\d{3})*)/i);
    if (stipendMatch) {
        const quote = findQuoteMatching(clean, /stipend[^.]{0,60}/i);
        return {
            raw: stipendMatch[0].trim(),
            currency: 'USD',
            payPeriod: 'stipend',
            annualizedMin: null,
            annualizedMax: null,
            isGuaranteedAnnualSalary: false,
            quote,
        };
    }

    // Check hourly rate: e.g. "$45/hr", "$40 - $55 per hour", "$50/hour"
    const hourlyMatch = clean.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:[-–to]+\s*\$?\s*(\d+(?:\.\d+)?))?\s*(?:\/\s*h(?:ou)?r|per\s+hour|hourly)/i);
    if (hourlyMatch) {
        const minH = Number(hourlyMatch[1]);
        const maxH = hourlyMatch[2] ? Number(hourlyMatch[2]) : minH;
        const quote = findQuoteMatching(clean, /\$\s*\d+(?:\.\d+)?[^.]{0,40}(?:hr|hour|hourly)/i);
        return {
            raw: hourlyMatch[0].trim(),
            currency: 'USD',
            payPeriod: 'hourly',
            hourlyMin: minH,
            hourlyMax: maxH,
            annualizedMin: Math.round(minH * 2080),
            annualizedMax: Math.round(maxH * 2080),
            isGuaranteedAnnualSalary: false,
            quote,
        };
    }

    // Check annual salary range: e.g. "$85,000 - $110,000", "$65k–$72k", "$70k", "USD 90,000"
    const annualRegex = /(?:(USD|EUR|GBP|CAD|\$)\s*)(\d{2,3}(?:,\d{3})+|\d{2,3}\s*[kK])(?:\s*(?:-|–|to)\s*(?:(?:USD|EUR|GBP|CAD|\$)\s*)?(\d{2,3}(?:,\d{3})+|\d{2,3}\s*[kK]))?(?:\s*(?:per\s+year|\/\s*yr|annually|annual|salary|base|OTE))?/i;
    const annualMatch = clean.match(annualRegex);
    if (annualMatch) {
        const parseAmount = (token) => {
            if (!token) return null;
            const t = String(token).trim().toLowerCase().replace(/,/g, '');
            if (t.endsWith('k')) return Math.round(Number(t.slice(0, -1)) * 1000);
            const num = Number(t);
            return Number.isFinite(num) ? num : null;
        };

        const rawMin = parseAmount(annualMatch[2]);
        const rawMax = parseAmount(annualMatch[3]) ?? rawMin;
        const currencyToken = (annualMatch[1] || '$').toUpperCase();
        const currency = currencyToken === '$' ? 'USD' : currencyToken;

        // Guard against monthly figures mistakenly parsed as annual if text says "/mo" or "per month"
        const afterMatch = lower.slice((annualMatch.index ?? 0), (annualMatch.index ?? 0) + annualMatch[0].length + 20);
        if (/\/\s*mo|per\s+month|monthly/.test(afterMatch)) {
            return {
                raw: annualMatch[0].trim(),
                currency,
                payPeriod: 'monthly',
                annualizedMin: rawMin ? rawMin * 12 : null,
                annualizedMax: rawMax ? rawMax * 12 : null,
                isGuaranteedAnnualSalary: false,
                quote: findQuoteMatching(clean, annualRegex),
            };
        }

        if (rawMin && rawMin >= 20000) {
            return {
                raw: annualMatch[0].trim(),
                currency,
                payPeriod: 'annual',
                annualizedMin: rawMin,
                annualizedMax: rawMax,
                isGuaranteedAnnualSalary: !/\b(contract|freelance|part-time|stipend)\b/i.test(clean),
                quote: findQuoteMatching(clean, annualRegex),
            };
        }
    }

    return {
        raw: 'Undisclosed',
        currency: 'USD',
        payPeriod: 'undisclosed',
        annualizedMin: null,
        annualizedMax: null,
        isGuaranteedAnnualSalary: false,
        quote: '',
    };
}

function extractSentences(text = '') {
    return String(text || '')
        .replace(/<[^>]*>/g, ' ')
        .split(/(?:\r?\n+|(?<=[.!?])\s+)/)
        .map(s => s.trim())
        .filter(s => s.length > 6);
}

/**
 * Step 2: Extract structured facts from a raw job posting before scoring.
 */
export function extractPostingFacts(job = {}) {
    const rawDesc = String(job.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const header = parsePostingHeader(job.title, job.source, job.employer || job.company);
    const fullText = `${header.employer} ${header.roleTitle} ${job.location || ''} ${job.salary || ''} ${rawDesc}`.trim();

    // Requisition ID extraction
    const reqMatch = fullText.match(/(?:requisition\s*(?:id|#|number)?|req\s*(?:id|#)?|job\s*(?:id|req|#))\s*[:#-]?\s*([A-Z0-9-]{3,24})/i);
    const requisitionId = job.requisitionId ? String(job.requisitionId).trim() : (reqMatch ? reqMatch[1].trim() : '');

    // Employment type
    let employmentType = String(job.employmentType || '').toLowerCase();
    if (!employmentType) {
        if (/\b(contract|1099|contractor|freelance)\b/i.test(fullText)) employmentType = 'contract';
        else if (/\b(internship|intern\b|fellowship|course stipend)\b/i.test(fullText)) employmentType = 'fellowship';
        else if (/\bpart[-\s]?time\b/i.test(fullText)) employmentType = 'part-time';
        else if (/\bfull[-\s]?time\b/i.test(fullText)) employmentType = 'full-time';
        else employmentType = 'unknown';
    }

    // Salary extraction
    const salarySourceText = [job.salary, rawDesc, job.title].filter(Boolean).join(' ');
    const salary = parseSalaryFacts(salarySourceText);
    if (employmentType === 'contract' || employmentType === 'fellowship') {
        salary.isGuaranteedAnnualSalary = false;
    }

    // Location & Puerto Rico eligibility extraction
    const locText = `${job.location || ''} ${rawDesc} ${job.title || ''}`.trim();
    const locLower = locText.toLowerCase();
    let locationStatus = 'unknown';
    let locationRestriction = 'Not specified';
    let locationQuote = '';

    const prExplicitExclude = /(?:exclud(?:e|ing)|not\s+(?:available|eligible|hiring)\s+in|outside\s+of|except)\s+(?:[^.]{0,60})?(?:puerto\s*rico|\bPR\b|territor)/i;
    const contiguousOnly = /\b(?:contiguous\s+(?:us|u\.s\.|united\s+states)|lower\s+48|48\s+states\s+only)\b/i;
    const nonUsCountryOnly = /\b(?:india\s+only|remote\s*[-–—]\s*india|based\s+in\s+india|philippines\s+only|remote\s*[-–—]\s*philippines|based\s+in\s+the?\s*philippines|must\s+reside\s+in\s+(?:india|philippines|uk|canada|europe|eu))\b/i;
    const prExplicitInclude = /\b(?:puerto\s*rico|us\s+territor|including\s+pr\b|open\s+to\s+pr\b)\b/i;
    const remoteUsOrAnywhere = /\b(?:remote\s*[-–—(]?\s*(?:us|u\.s\.|united\s+states)\b|us\s+remote|work\s+from\s+anywhere|wfa\b|remote\s*\(united\s+states\))/i;

    if (prExplicitExclude.test(locText) || contiguousOnly.test(locText)) {
        locationStatus = ELIGIBILITY_OUTCOMES.FAIL;
        locationRestriction = 'Excludes Puerto Rico';
        locationQuote = findQuoteMatching(locText, prExplicitExclude) || findQuoteMatching(locText, contiguousOnly);
    } else if (nonUsCountryOnly.test(locText)) {
        locationStatus = ELIGIBILITY_OUTCOMES.FAIL;
        locationRestriction = /india/i.test(locLower) ? 'India-only restriction' : /philippines/i.test(locLower) ? 'Philippines-only restriction' : 'Non-US country restriction';
        locationQuote = findQuoteMatching(locText, nonUsCountryOnly);
    } else if (prExplicitInclude.test(locText)) {
        locationStatus = ELIGIBILITY_OUTCOMES.PASS;
        locationRestriction = 'Puerto Rico eligible';
        locationQuote = findQuoteMatching(locText, prExplicitInclude);
    } else if (remoteUsOrAnywhere.test(locText)) {
        locationStatus = ELIGIBILITY_OUTCOMES.UNKNOWN;
        locationRestriction = /anywhere|wfa/i.test(locLower) ? 'Work from anywhere (PR eligibility unverified)' : 'Remote US (PR eligibility unverified)';
        locationQuote = findQuoteMatching(locText, remoteUsOrAnywhere);
    } else if (/\b(?:on[-\s]?site|in[-\s]?office)\b/i.test(locText) && !prExplicitInclude.test(locText)) {
        locationStatus = ELIGIBILITY_OUTCOMES.FAIL;
        locationRestriction = 'On-site outside Puerto Rico';
        locationQuote = findQuoteMatching(locText, /\b(?:on[-\s]?site|in[-\s]?office)\b/i);
    }

    // Travel extraction
    let travel = 'unknown';
    let travelQuote = '';
    if (/\b(?:no\s+travel|0%\s+travel)\b/i.test(fullText)) {
        travel = 'none';
        travelQuote = findQuoteMatching(fullText, /\b(?:no\s+travel|0%\s+travel)\b/i);
    } else if (/\b(?:occasional\s+travel|minimal\s+travel|light\s+travel|(?:up\s+to\s+)?(?:5|10|15|20|25)%\s+travel)\b/i.test(fullText)) {
        travel = 'occasional';
        travelQuote = findQuoteMatching(fullText, /\b(?:occasional\s+travel|minimal\s+travel|light\s+travel|(?:up\s+to\s+)?(?:5|10|15|20|25)%\s+travel)\b/i);
    } else if (/\b(?:(?:50|60|75|80|90|100)%\s+travel|heavy\s+travel|frequent\s+travel)\b/i.test(fullText)) {
        travel = 'heavy';
        travelQuote = findQuoteMatching(fullText, /\b(?:(?:50|60|75|80|90|100)%\s+travel|heavy\s+travel|frequent\s+travel)\b/i);
    }

    // Split duties vs required vs preferred qualifications
    const sentences = extractSentences(rawDesc);
    const duties = [];
    const requiredQualifications = [];
    const preferredQualifications = [];

    for (const s of sentences) {
        const sl = s.toLowerCase();
        if (/\b(preferred|nice to have|bonus|plus)\b/.test(sl)) {
            preferredQualifications.push(s);
        } else if (/\b(required|must have|minimum|bachelor|master|license|certification|years of experience)\b/.test(sl)) {
            requiredQualifications.push(s);
        } else {
            duties.push(s);
        }
    }

    // Mandatory licenses & degrees
    const mandatoryLicenseRegex = /\b(?:active\s+(?:rn|registered\s+nurse|nursing|lpn|aprn|cpa|medical)\s+license|registered\s+nurse|\brn\b\s+license|bsn\s+required|licensed\s+(?:nurse|pharmacist|physician|attorney)|series\s+7)\b/i;
    const mandatoryDegreeWithoutEquivRegex = /\b(?:(?:bachelor'?s|master'?s|phd|md|bsn|msn|jd)\s+(?:degree\s+)?(?:required|mandatory)|must\s+hold\s+a\s+(?:bachelor|master|phd|bsn|md|jd))\b/i;
    const equivalentExperienceRegex = /\bor\s+equivalent(?:\s+(?:work|practical|professional))?\s+experience\b/i;

    const licenseQuote = findQuoteMatching(fullText, mandatoryLicenseRegex);
    const degreeQuote = findQuoteMatching(fullText, mandatoryDegreeWithoutEquivRegex);
    const hasEquivalentOption = equivalentExperienceRegex.test(fullText);

    return {
        employer: header.employer,
        roleTitle: header.roleTitle,
        requisitionId,
        canonicalUrl: canonicalizeJobUrl(job.link || job.url || ''),
        postingDate: job.pubDate || job.postingDate || '',
        employmentType,
        salary,
        locationStatus,
        locationRestriction,
        travel,
        duties,
        requiredQualifications,
        preferredQualifications,
        hasMandatoryLicense: Boolean(licenseQuote),
        hasMandatoryDegreeWithoutEquiv: Boolean(degreeQuote) && !hasEquivalentOption,
        hasEquivalentOption,
        evidenceQuotes: {
            location: locationQuote,
            salary: salary.quote,
            travel: travelQuote,
            license: licenseQuote,
            degree: degreeQuote,
            requisitionId: reqMatch ? reqMatch[0] : '',
        },
        rawText: fullText,
    };
}

function isTtkeFallbackRole(extracted, job = {}) {
    const employerLower = String(extracted?.employer || '').toLowerCase();
    const roleLower = String(extracted?.roleTitle || '').toLowerCase();
    const explicitFlag = Boolean(job.isTtkeFallback || job.allowTtkeFallback);
    return explicitFlag || employerLower.includes('ttke') || roleLower.includes('ttke');
}

/**
 * Step 3: Evaluate eligibility gates with three outcomes: pass | fail | unknown.
 */
export function evaluateEligibilityGates(extracted, job = {}, candidate = DEFAULT_CANDIDATE_PROFILE) {
    const baseFloor = Number(candidate?.salaryFloor) > 0 ? Number(candidate.salaryFloor) : DEFAULT_SALARY_FLOOR;
    const ttkeFallback = isTtkeFallbackRole(extracted, job);
    const effectiveFloor = ttkeFallback ? TTKE_FALLBACK_SALARY_FLOOR : baseFloor;

    // 1. Location / Puerto Rico Residence Gate
    const locationGate = {
        status: extracted.locationStatus || ELIGIBILITY_OUTCOMES.UNKNOWN,
        reason: extracted.locationRestriction || 'Puerto Rico eligibility not verified',
        quote: extracted.evidenceQuotes?.location || '',
    };

    // 2. Credentials Gate (License / Mandatory Degree without Equivalent Experience)
    const candidateLicenses = new Set((candidate?.licenses || []).map(l => String(l).toLowerCase()));
    const completedDegrees = new Set((candidate?.completedDegrees || ["Bachelor's Degree"]).map(d => String(d).toLowerCase()));
    let credentialsStatus = ELIGIBILITY_OUTCOMES.PASS;
    let credentialsReason = 'No missing mandatory licenses or unmeetable degree gates';
    let credentialsQuote = '';

    if (extracted.hasMandatoryLicense) {
        const licenseText = (extracted.evidenceQuotes?.license || '').toLowerCase();
        const hasMatch = Array.from(candidateLicenses).some(l => l && licenseText.includes(l));
        if (!hasMatch) {
            credentialsStatus = ELIGIBILITY_OUTCOMES.FAIL;
            credentialsReason = 'Requires mandatory professional/clinical license not held';
            credentialsQuote = extracted.evidenceQuotes?.license || '';
        }
    } else if (extracted.hasMandatoryDegreeWithoutEquiv) {
        const degText = (extracted.evidenceQuotes?.degree || '').toLowerCase();
        const requiresGradOrClinical = /\b(master|phd|md|bsn|msn|jd)\b/.test(degText);
        const hasBachelor = completedDegrees.has("bachelor's degree") || completedDegrees.has('bachelor');
        if (requiresGradOrClinical || !hasBachelor) {
            credentialsStatus = ELIGIBILITY_OUTCOMES.FAIL;
            credentialsReason = 'Mandatory specific degree required without equivalent-experience option';
            credentialsQuote = extracted.evidenceQuotes?.degree || '';
        }
    }

    const credentialsGate = {
        status: credentialsStatus,
        reason: credentialsReason,
        quote: credentialsQuote,
    };

    // 3. Salary Floor Gate
    let salaryStatus = ELIGIBILITY_OUTCOMES.UNKNOWN;
    let salaryReason = 'Salary undisclosed — verify compensation range';
    const sal = extracted.salary || {};

    if (sal.payPeriod === 'stipend') {
        salaryStatus = ELIGIBILITY_OUTCOMES.UNKNOWN;
        salaryReason = 'Stipend / non-salaried compensation — not treated as guaranteed annual salary';
    } else if (sal.payPeriod === 'hourly') {
        salaryStatus = ELIGIBILITY_OUTCOMES.UNKNOWN;
        salaryReason = `Hourly contract (${sal.raw}) — not treated as guaranteed annual salary`;
    } else if (sal.payPeriod === 'annual' && sal.annualizedMax !== null) {
        if (sal.annualizedMax < effectiveFloor) {
            salaryStatus = ELIGIBILITY_OUTCOMES.FAIL;
            salaryReason = `Pay ceiling ($${sal.annualizedMax.toLocaleString()}) is below $${effectiveFloor.toLocaleString()} floor`;
        } else if (sal.annualizedMin !== null && sal.annualizedMin >= effectiveFloor) {
            salaryStatus = ELIGIBILITY_OUTCOMES.PASS;
            salaryReason = ttkeFallback
                ? `Meets TTKE one-role fallback floor ($${TTKE_FALLBACK_SALARY_FLOOR.toLocaleString()})`
                : `Meets $${baseFloor.toLocaleString()} annual salary floor`;
        } else {
            // Range straddles the floor (e.g. $75k - $95k)
            salaryStatus = ELIGIBILITY_OUTCOMES.PASS;
            salaryReason = ttkeFallback
                ? `Range reaches TTKE fallback floor ($${TTKE_FALLBACK_SALARY_FLOOR.toLocaleString()})`
                : `Range reaches $${baseFloor.toLocaleString()} annual salary floor`;
        }
    }

    const salaryGate = {
        status: salaryStatus,
        reason: salaryReason,
        effectiveFloor,
        isTtkeFallback: ttkeFallback,
        quote: sal.quote || '',
    };

    // 4. Travel Gate (occasional travel is acceptable)
    let travelStatus = ELIGIBILITY_OUTCOMES.PASS;
    let travelReason = 'No excessive travel required';
    if (extracted.travel === 'occasional') {
        travelStatus = ELIGIBILITY_OUTCOMES.PASS;
        travelReason = 'Occasional travel is acceptable';
    } else if (extracted.travel === 'heavy') {
        travelStatus = ELIGIBILITY_OUTCOMES.UNKNOWN;
        travelReason = 'Heavy travel requirement — clarify schedule expectations';
    }

    const gates = {
        location: locationGate,
        credentials: credentialsGate,
        salary: salaryGate,
        travel: { status: travelStatus, reason: travelReason, quote: extracted.evidenceQuotes?.travel || '' },
    };

    const statuses = Object.values(gates).map(g => g.status);
    let overall = ELIGIBILITY_OUTCOMES.PASS;
    if (statuses.includes(ELIGIBILITY_OUTCOMES.FAIL)) {
        overall = ELIGIBILITY_OUTCOMES.FAIL;
    } else if (statuses.includes(ELIGIBILITY_OUTCOMES.UNKNOWN)) {
        overall = ELIGIBILITY_OUTCOMES.UNKNOWN;
    }

    return {
        overall,
        gates,
        hardExclusions: Object.entries(gates)
            .filter(([, g]) => g.status === ELIGIBILITY_OUTCOMES.FAIL)
            .map(([key, g]) => `${key}: ${g.reason}`),
        clarificationsNeeded: Object.entries(gates)
            .filter(([, g]) => g.status === ELIGIBILITY_OUTCOMES.UNKNOWN)
            .map(([key, g]) => `${key}: ${g.reason}`),
    };
}

/**
 * Step 7: Check duplicate against Job Helper tracked jobs + synced application emails.
 * Checks (normalizedEmployer + requisitionId) AND canonicalUrl.
 * A different role at the same company is NOT a duplicate.
 */
export function checkDuplicateApplication(extracted, trackedJobs = [], applicationEmails = []) {
    const targetEmployer = normalizeEmployerName(extracted.employer);
    const targetReqId = String(extracted.requisitionId || '').trim().toLowerCase();
    const targetUrl = String(extracted.canonicalUrl || '').trim();
    const targetRoleLower = String(extracted.roleTitle || '').trim().toLowerCase();

    for (const item of [...(trackedJobs || []), ...(applicationEmails || [])]) {
        if (!item || item.status === 'deleted') continue;

        const existingUrl = canonicalizeJobUrl(item.url || item.link || '');
        if (targetUrl && existingUrl && targetUrl === existingUrl) {
            return {
                isDuplicate: true,
                matchedBy: 'canonicalUrl',
                matchedRecord: `${item.company || item.employer || ''} — ${item.role || item.title || ''}`.trim(),
            };
        }

        const existingEmployer = normalizeEmployerName(item.company || item.employer || '');
        const existingReqId = String(item.requisitionId || '').trim().toLowerCase();
        if (targetEmployer && existingEmployer && targetEmployer === existingEmployer) {
            if (targetReqId && existingReqId && targetReqId === existingReqId) {
                return {
                    isDuplicate: true,
                    matchedBy: 'employerAndRequisitionId',
                    matchedRecord: `${item.company || item.employer} (${item.requisitionId})`,
                };
            }
            // If no req ID on either side, only flag duplicate when the exact role title also matches
            const existingRole = String(item.role || item.title || '').trim().toLowerCase();
            if (!targetReqId && !existingReqId && targetRoleLower && existingRole && targetRoleLower === existingRole) {
                return {
                    isDuplicate: true,
                    matchedBy: 'employerAndExactTitle',
                    matchedRecord: `${item.company || item.employer} — ${item.role || item.title}`,
                };
            }
        }
    }

    return { isDuplicate: false, matchedBy: null, matchedRecord: null };
}

/**
 * Step 4 & 5: Match actual duties to evidence & score with explainable weights:
 * 40% core duties & outcomes, 25% required skills, 15% ownership & seniority,
 * 10% industry context, 10% working arrangement.
 */
export function scorePostingAgainstEvidence(extracted, eligibility, candidate = DEFAULT_CANDIDATE_PROFILE) {
    const lowerText = extracted.rawText.toLowerCase();
    const dutiesText = `${extracted.roleTitle} ${extracted.duties.join(' ')}`.toLowerCase();
    const reqText = `${extracted.requiredQualifications.join(' ')} ${lowerText}`.toLowerCase();

    const evidenceItems = Array.isArray(candidate?.evidenceItems) && candidate.evidenceItems.length > 0
        ? candidate.evidenceItems
        : DEFAULT_CANDIDATE_PROFILE.evidenceItems;

    const matchedEvidence = [];
    const realGaps = [];

    // Guardrails: non-equivalent domain checks
    const requiresDataEngineering = /\b(data engineer|spark|airflow|kafka|dbt\s+models|etl\s+pipeline|snowflake\s+administration|distributed\s+data\s+systems)\b/i.test(lowerText);
    const requiresNursingOrClinical = /\b(registered\s+nurse|\brn\b|clinical\s+care|patient\s+triage|bedside|bsn|msn|nursing)\b/i.test(lowerText);
    const requiresHipaaComplianceOwnership = /\b(hipaa\s+compliance\s+officer|own\s+hipaa\s+compliance|hipaa\s+privacy\s+officer|regulatory\s+hipaa\s+audits)\b/i.test(lowerText);
    const requiresSoftwareEngineeringOwnership = /\b(full[-\s]?stack\s+engineer|backend\s+engineer|software\s+engineer|staff\s+frontend|kubernetes|distributed\s+microservices|production\s+go\/java)\b/i.test(lowerText);

    if (requiresDataEngineering) {
        realGaps.push('Requires production data engineering (SQL analytics is not production data engineering)');
    }
    if (requiresNursingOrClinical) {
        realGaps.push('Requires clinical/nursing credentials (healthcare marketing is not nursing)');
    }
    if (requiresHipaaComplianceOwnership) {
        realGaps.push('Requires HIPAA compliance ownership (healthcare marketing is not HIPAA compliance ownership)');
    }
    if (requiresSoftwareEngineeringOwnership) {
        realGaps.push('Requires production software engineering/coding ownership');
    }

    // Score each evidence item against duties and requirements
    let directHits = 0;
    let transferableHits = 0;
    const matchedSkillTerms = new Set();

    for (const item of evidenceItems) {
        const dutyHits = (item.keywords || []).filter(kw => dutiesText.includes(kw.toLowerCase()));
        const allHits = (item.keywords || []).filter(kw => reqText.includes(kw.toLowerCase()));
        if (allHits.length > 0) {
            allHits.forEach(k => matchedSkillTerms.add(k));
            matchedEvidence.push({
                competency: item.competency,
                strength: item.strength,
                roleType: item.roleType,
                source: item.source,
                project: item.project,
                outcome: item.outcome,
                matchedTerms: allHits.slice(0, 5),
                dutyMatchCount: dutyHits.length,
            });
            if (item.strength === 'direct') directHits += dutyHits.length > 0 ? 2 : 1;
            else transferableHits += 1;
        }
    }

    // Target family alignment boost inside Core Duties
    const matchedFamilies = TARGET_ROLE_FAMILIES.filter(fam =>
        fam.keywords.some(kw => lowerText.includes(kw))
    );

    // 1. Core Duties & Outcomes (0-40)
    let coreDutiesScore = Math.min(40, matchedFamilies.length * 10 + directHits * 5 + transferableHits * 3);
    if (requiresSoftwareEngineeringOwnership && matchedFamilies.every(f => f.id === 'practical_ai_operations' || f.id === 'business_intelligence')) {
        coreDutiesScore = Math.min(coreDutiesScore, 14);
    }
    if (requiresNursingOrClinical) {
        coreDutiesScore = Math.min(coreDutiesScore, 8);
    }

    // 2. Required Skills (0-25)
    let requiredSkillsScore = Math.min(25, matchedSkillTerms.size * 4);
    if (requiresDataEngineering && matchedSkillTerms.has('sql') && matchedSkillTerms.size <= 2) {
        requiredSkillsScore = Math.min(requiredSkillsScore, 10);
    }

    // 3. Ownership & Seniority (0-15) — non-senior roles are explicitly welcomed, never penalized!
    const titleLower = extracted.roleTitle.toLowerCase();
    const isNonSeniorRole = /\b(specialist|coordinator|analyst|associate|strategist|manager)\b/.test(titleLower)
        && !/\b(vp|vice president|chief|cxo|director|head of)\b/.test(titleLower);
    const nonOverlappingMonths = computeNonOverlappingMonths(candidate?.periods || DEFAULT_CANDIDATE_PROFILE.periods);
    let ownershipSeniorityScore = 10;
    if (matchedEvidence.some(e => e.roleType === 'leadership')) {
        ownershipSeniorityScore = isNonSeniorRole ? 14 : 15;
    } else if (nonOverlappingMonths >= 24) {
        ownershipSeniorityScore = 12;
    }

    // 4. Industry Context (0-10)
    const industryTerms = ['saas', 'b2b', 'b2c', 'fintech', 'ecommerce', 'agency', 'healthcare', 'ai', 'martech', 'insurance', 'financial'];
    const industryHits = industryTerms.filter(t => lowerText.includes(t));
    const industryContextScore = Math.min(10, industryHits.length > 0 ? 6 + industryHits.length * 2 : 5);

    // 5. Working Arrangement (0-10)
    let workingArrangementScore = 5;
    if (eligibility.gates.location.status === ELIGIBILITY_OUTCOMES.PASS) {
        workingArrangementScore = extracted.travel === 'heavy' ? 6 : 10;
    } else if (eligibility.gates.location.status === ELIGIBILITY_OUTCOMES.UNKNOWN) {
        workingArrangementScore = extracted.travel === 'heavy' ? 4 : 7;
    } else {
        workingArrangementScore = 0;
    }

    const totalScore = Math.max(
        0,
        Math.min(
            100,
            Math.round(
                coreDutiesScore +
                requiredSkillsScore +
                ownershipSeniorityScore +
                industryContextScore +
                workingArrangementScore
            )
        )
    );

    // Evidence confidence (separate from score & eligibility)
    const directCount = matchedEvidence.filter(e => e.strength === 'direct').length;
    let evidenceConfidence = 'low';
    if (directCount >= 3 && realGaps.length === 0) evidenceConfidence = 'high';
    else if (directCount >= 1) evidenceConfidence = 'medium';

    // Identify missing target-fit gaps when score is low
    if (matchedEvidence.length === 0) {
        realGaps.push('Limited verified direct evidence matching core posting duties');
    }
    if (extracted.hasMandatoryLicense) {
        realGaps.push('Missing mandatory professional license');
    }
    if (extracted.hasMandatoryDegreeWithoutEquiv) {
        realGaps.push('Mandatory specific degree without equivalent-experience option');
    }

    return {
        totalScore,
        breakdown: {
            coreDuties: coreDutiesScore,
            requiredSkills: requiredSkillsScore,
            ownershipSeniority: ownershipSeniorityScore,
            industryContext: industryContextScore,
            workingArrangement: workingArrangementScore,
        },
        matchedFamilies: matchedFamilies.map(f => f.label),
        matchedEvidence,
        realGaps: Array.from(new Set(realGaps)),
        evidenceConfidence,
        nonOverlappingExperienceMonths: nonOverlappingMonths,
    };
}

/**
 * Step 6: Assign final label: Recommend | Worthwhile stretch | Needs clarification | Skip
 */
export function evaluateJobPosting(job = {}, context = {}) {
    const candidate = context.candidate || DEFAULT_CANDIDATE_PROFILE;
    const trackedJobs = context.trackedJobs || [];
    const applicationEmails = context.applicationEmails || [];

    const extracted = extractPostingFacts(job);
    const eligibility = evaluateEligibilityGates(extracted, job, candidate);
    const duplicate = checkDuplicateApplication(extracted, trackedJobs, applicationEmails);
    const scoring = scorePostingAgainstEvidence(extracted, eligibility, candidate);

    let label = RECOMMENDATION_LABELS.SKIP;
    if (duplicate.isDuplicate || eligibility.overall === ELIGIBILITY_OUTCOMES.FAIL) {
        // High score NEVER overrides a hard exclusion or duplicate
        label = RECOMMENDATION_LABELS.SKIP;
    } else if (eligibility.overall === ELIGIBILITY_OUTCOMES.UNKNOWN) {
        // Only surface as Needs clarification if the role itself is actually relevant (>= 55)
        label = scoring.totalScore >= 55
            ? RECOMMENDATION_LABELS.NEEDS_CLARIFICATION
            : RECOMMENDATION_LABELS.SKIP;
    } else if (scoring.totalScore >= 72 && scoring.evidenceConfidence !== 'low') {
        label = RECOMMENDATION_LABELS.RECOMMEND;
    } else if (scoring.totalScore >= 55) {
        label = RECOMMENDATION_LABELS.WORTHWHILE_STRETCH;
    } else {
        label = RECOMMENDATION_LABELS.SKIP;
    }

    const strongestEvidence = scoring.matchedEvidence
        .slice(0, 3)
        .map(e => `${e.competency} (${e.strength}, ${e.roleType}): ${e.outcome} [${e.source}]`);

    const paySummary = extracted.salary.payPeriod === 'annual'
        ? `${extracted.salary.raw} (${eligibility.gates.salary.reason})`
        : `${extracted.salary.raw} (${eligibility.gates.salary.reason})`;

    const reasoningParts = [];
    if (duplicate.isDuplicate) {
        reasoningParts.push(`Already tracked (${duplicate.matchedBy}: ${duplicate.matchedRecord}).`);
    }
    if (eligibility.hardExclusions.length > 0) {
        reasoningParts.push(`Excluded: ${eligibility.hardExclusions.join('; ')}.`);
    }
    if (eligibility.clarificationsNeeded.length > 0) {
        reasoningParts.push(`Clarify: ${eligibility.clarificationsNeeded.join('; ')}.`);
    }
    if (strongestEvidence.length > 0) {
        reasoningParts.push(`Top evidence: ${scoring.matchedEvidence.slice(0, 2).map(e => e.competency).join(' + ')}.`);
    }
    reasoningParts.push('Score is a ranking aid, not a hiring probability.');

    return {
        ...job,
        title: job.title || `${extracted.employer}: ${extracted.roleTitle}`,
        employer: extracted.employer,
        roleTitle: extracted.roleTitle,
        requisitionId: extracted.requisitionId,
        canonicalUrl: extracted.canonicalUrl,
        extracted,
        eligibility,
        duplicate,
        scoring,
        relevanceScore: scoring.totalScore,
        label,
        strongestEvidence,
        realGaps: scoring.realGaps,
        paySummary,
        puertoRicoStatus: eligibility.gates.location.status,
        puertoRicoDetail: eligibility.gates.location.reason,
        evidenceConfidence: scoring.evidenceConfidence,
        matchReason: reasoningParts.join(' '),
    };
}

/**
 * Filter evaluated postings down to actionable recommendations without padding.
 * Returns zero items when none qualify as Recommend or Worthwhile stretch.
 */
export function selectActionableRecommendations(evaluatedJobs = [], { includeNeedsClarification = false } = {}) {
    const allowed = new Set([
        RECOMMENDATION_LABELS.RECOMMEND,
        RECOMMENDATION_LABELS.WORTHWHILE_STRETCH,
        ...(includeNeedsClarification ? [RECOMMENDATION_LABELS.NEEDS_CLARIFICATION] : []),
    ]);

    return (Array.isArray(evaluatedJobs) ? evaluatedJobs : [])
        .filter(item => item && allowed.has(item.label))
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}

/**
 * Step 8: Stable content fingerprint for caching unchanged postings and skipping re-scoring.
 */
export function computePostingFingerprint(job = {}) {
    const keyParts = [
        canonicalizeJobUrl(job.link || job.url || ''),
        String(job.title || '').trim(),
        String(job.description || '').slice(0, 600).trim(),
        String(job.salary || '').trim(),
        String(job.location || '').trim(),
    ].join('|');

    let hash = 5381;
    for (let i = 0; i < keyParts.length; i += 1) {
        hash = ((hash << 5) + hash) ^ keyParts.charCodeAt(i);
    }
    return `fp_${(hash >>> 0).toString(36)}`;
}
