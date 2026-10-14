/**
 * Email and Role Matcher for NovuJobs.
 * Provides deterministic company matching, email classification,
 * and timeline alert calculations to verify that no updates are missed.
 */

// Common corporate suffixes to strip for normalized matching
const CORP_SUFFIXES = /\b(inc|llc|corp|corporation|ltd|limited|co|company|group|technologies|tech|holdings|labs|io|ai)\b\.?/gi;

/**
 * Normalizes a company name for fuzzy comparison.
 * e.g. "Stripe, Inc." -> "stripe", "Google LLC" -> "google"
 */
export function normalizeCompanyName(name) {
    if (!name || typeof name !== 'string') return '';
    return name
        .toLowerCase()
        .replace(CORP_SUFFIXES, '')
        .replace(/[^\w\s]/g, '') // remove punctuation
        .trim();
}

/**
 * Extracts domain name from an email address.
 * e.g. "recruiting@stripe.com" -> "stripe"
 */
export function extractDomainFromEmail(emailStr) {
    if (!emailStr || typeof emailStr !== 'string') return '';
    const match = emailStr.match(/@([a-zA-Z0-9.-]+)/);
    if (!match) return '';
    const host = match[1].toLowerCase();
    // Ignore generic mail providers and ATS vendors
    const genericHosts = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
    if (genericHosts.includes(host)) return '';
    
    // For ATS domains like "greenhouse-mail.io", "ashbyhq.com", "lever.co", don't treat as company
    const atsDomains = ['greenhouse-mail.io', 'ashbyhq.com', 'lever.co', 'workday.com', 'smartrecruiters.com', 'jobvite.com'];
    if (atsDomains.some(ats => host.includes(ats))) return '';

    // Strip top-level domain e.g. "stripe.com" -> "stripe"
    return host.split('.')[0];
}

/**
 * Deterministically finds matching job from the user's active jobs list.
 */
export function findMatchingJob(email, activeJobs = []) {
    if (!email || !activeJobs || activeJobs.length === 0) return null;

    const emailSubject = (email.subject || '').toLowerCase();
    const emailFrom = (email.from || '').toLowerCase();
    const emailBody = (email.snippet || email.body || '').toLowerCase();
    const fromDomain = extractDomainFromEmail(emailFrom);

    for (const job of activeJobs) {
        if (!job || !job.company) continue;

        const rawCompany = job.company.toLowerCase().trim();
        const normCompany = normalizeCompanyName(rawCompany);

        if (!normCompany || normCompany.length < 2) continue;

        // 1. Direct company domain match in sender email
        if (fromDomain && (fromDomain === normCompany || fromDomain.includes(normCompany))) {
            return job;
        }

        // 2. Company name explicitly mentioned in Subject
        const subjectRegex = new RegExp(`\\b${escapeRegExp(normCompany)}\\b`, 'i');
        if (subjectRegex.test(emailSubject)) {
            return job;
        }

        // 3. Raw company name in Subject or From
        if (emailSubject.includes(rawCompany) || emailFrom.includes(rawCompany)) {
            return job;
        }

        // 4. Company name in email body snippet
        if (subjectRegex.test(emailBody)) {
            return job;
        }
    }

    return null;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Evaluates whether an active job is in a Ghost Alert (>= 10 days),
 * Follow-up Window (5-9 days), or is Healthy (< 5 days).
 */
export function calculateJobAlertStatus(job, nowMs = Date.now()) {
    if (!job || job.status === 'deleted' || job.status === 'offer' || job.status === 'rejected') {
        return { type: 'inactive', days: 0, isAlert: false };
    }

    const refDate = job.updatedAt || job.appliedAt || job.createdAt || job.dateAdded;
    if (!refDate) {
        return { type: 'unknown', days: 0, isAlert: false };
    }

    const diff = nowMs - new Date(refDate).getTime();
    const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));

    if (days >= 10) {
        return {
            type: 'ghost',
            days,
            isAlert: true,
            label: `Ghost Alert (${days}d silent)`
        };
    } else if (days >= 5) {
        return {
            type: 'followup',
            days,
            isAlert: true,
            label: `Follow-Up Window (${days}d since activity)`
        };
    }

    return {
        type: 'healthy',
        days,
        isAlert: false,
        label: `Active (${days}d ago)`
    };
}

/**
 * Deterministic rule-based email intent classifier (used for offline tests and validation).
 */
export function classifyEmailIntent(text) {
    if (!text || typeof text !== 'string') return { category: 'unknown', suggestedStatus: null };

    const lower = text.toLowerCase();

    // Rejection signals
    if (
        lower.includes('move forward with other candidates') ||
        lower.includes('moving forward with other candidates') ||
        lower.includes('move forward with another candidate') ||
        lower.includes('moving forward with another candidate') ||
        lower.includes('pursue other candidates') ||
        lower.includes('pursuing other candidates') ||
        lower.includes('decided not to move forward') ||
        lower.includes('not moving forward') ||
        lower.includes('will not be moving forward') ||
        lower.includes('will not be advancing') ||
        lower.includes('not advancing') ||
        lower.includes('position has been filled') ||
        lower.includes('unfortunately, at this time') ||
        lower.includes('we will keep your resume on file') ||
        (lower.includes('after careful consideration') && lower.includes('decided'))
    ) {
        return {
            category: 'rejection',
            suggestedStatus: 'rejected',
            confidence: 95
        };
    }

    // Offer signals
    if (
        lower.includes('pleased to offer') ||
        lower.includes('delighted to offer') ||
        lower.includes('offer of employment') ||
        lower.includes('formal job offer') ||
        lower.includes('attached is your offer') ||
        lower.includes('offer letter')
    ) {
        return {
            category: 'offer',
            suggestedStatus: 'offer',
            confidence: 98
        };
    }

    // Interview signals
    if (
        lower.includes('schedule a time') ||
        lower.includes('schedule an interview') ||
        lower.includes('invitation to interview') ||
        lower.includes('phone screen') ||
        lower.includes('technical screen') ||
        lower.includes('take-home assignment') ||
        lower.includes('hackerrank') ||
        lower.includes('codility') ||
        lower.includes('next round of interviews') ||
        lower.includes('speak with our team') ||
        lower.includes('calendly.com')
    ) {
        return {
            category: 'interview_invite',
            suggestedStatus: 'interviewing',
            confidence: 95
        };
    }

    // Application confirmation signals
    if (
        lower.includes('thank you for applying') ||
        lower.includes('application received') ||
        lower.includes('we have received your application') ||
        lower.includes('confirming receipt of your application')
    ) {
        return {
            category: 'confirmation',
            suggestedStatus: 'applied',
            confidence: 90
        };
    }

    return {
        category: 'unknown',
        suggestedStatus: null,
        confidence: 40
    };
}
