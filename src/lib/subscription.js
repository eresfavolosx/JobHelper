// Subscription and Access Control System for NovuJobs
// Enforces:
// 1. Owner privileges for fabian.velez1996@gmail.com (Unlimited lifetime access)
// 2. Stripe $9.99/mo Pro subscription gating for shared API & advanced features
// 3. Strict Firebase cost protection (limits free users to 25 jobs, 0 shared API usage)
// 4. Free BYOK (Bring Your Own Key) option so users can use Gemini for free without costing Fabian anything

export const OWNER_EMAIL = 'fabian.velez1996@gmail.com';
export const PRO_MONTHLY_PRICE = '$9.99';
export const FREE_TIER_MAX_JOBS = 25;

// Default Stripe Payment Link (can be overridden via NEXT_PUBLIC_STRIPE_PAYMENT_LINK in .env.local)
export const DEFAULT_STRIPE_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/test_novujobs_pro_999';

/**
 * Checks if the given user or email is the platform owner (Fabian).
 */
export function isOwner(userOrEmail) {
    if (!userOrEmail) return false;
    const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
    if (!email) return false;
    return email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim();
}

/**
 * Checks if the user has an active Pro subscription or owner privileges.
 */
export function isProUser(user, profile) {
    if (isOwner(user)) return true;
    if (!profile) return false;
    if (profile.subscriptionStatus === 'premium') return true;
    if (profile.subscriptionStatus === 'trial' && profile.trialEndDate) {
        return new Date().getTime() < new Date(profile.trialEndDate).getTime();
    }
    return false;
}

/**
 * Checks whether the account profile has at least one personal AI API key configured.
 * Environment/platform keys are intentionally NOT counted so AI features stay paused
 * whenever the account itself has no API key saved.
 */
export function hasConfiguredAiKey(profile) {
    if (!profile || typeof profile !== 'object') return false;

    const envGemini = (typeof process !== 'undefined'
        ? (process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '')
        : '').trim();

    const geminiKey = String(profile.geminiApiKey || '').trim();
    const gemini = Boolean(
        geminiKey.length > 5 &&
        geminiKey !== 'your_api_key_here' &&
        (!envGemini || geminiKey !== envGemini)
    );

    const claudeKey = String(profile.claudeApiKey || '').trim();
    const claude = Boolean(claudeKey.length > 5 && claudeKey !== 'your_api_key_here');

    const openaiKey = String(profile.openaiApiKey || '').trim();
    const openai = Boolean(openaiKey.length > 5 && openaiKey !== 'your_api_key_here');

    const customKey = String(profile.customAiApiKey || '').trim();
    const customUrl = String(profile.customAiBaseUrl || '').trim();
    const custom = Boolean(customKey.length > 5 && customKey !== 'your_api_key_here' && customUrl.length > 0);

    return Boolean(gemini || claude || openai || custom);
}

/**
 * Checks whether the account profile has a personal Google Maps API key configured.
 * Environment/platform keys are excluded so Maps calls stay blocked when the account has no key.
 */
export function hasConfiguredMapsKey(profile) {
    if (!profile || typeof profile !== 'object') return false;

    const envMaps = (typeof process !== 'undefined'
        ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '')
        : '').trim();
    const envFirebase = (typeof process !== 'undefined'
        ? (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '')
        : '').trim();

    const key = String(profile.googleMapsApiKey || '').trim();
    return Boolean(
        key.length > 5 &&
        key !== 'your_api_key_here' &&
        (!envMaps || key !== envMaps) &&
        (!envFirebase || key !== envFirebase)
    );
}

/**
 * Verifies if AI API access is permitted for the current account.
 * Strictly requires a personal AI API key saved on `profile` (no shared/owner bypass).
 */
export function checkApiAccess(user, profile) {
    if (!hasConfiguredAiKey(profile)) {
        return {
            allowed: false,
            isPersonalKey: false,
            code: 'API_KEY_REQUIRED',
            reason: 'AI features are paused because no API key is configured on your account. Add an API key in Profile Settings to enable AI features.'
        };
    }

    return {
        allowed: true,
        isPersonalKey: true,
        reason: 'Personal API key configured on account'
    };
}

/**
 * Checks if a user is allowed to add more tracked jobs to Firestore.
 * Prevents Firestore database write spam by capping free users at FREE_TIER_MAX_JOBS.
 */
export function canAddJob(user, profile, currentJobCount = 0) {
    if (isOwner(user) || isProUser(user, profile)) {
        return {
            allowed: true,
            remaining: Infinity,
            cap: Infinity
        };
    }

    const remaining = Math.max(0, FREE_TIER_MAX_JOBS - currentJobCount);
    return {
        allowed: currentJobCount < FREE_TIER_MAX_JOBS,
        remaining,
        cap: FREE_TIER_MAX_JOBS
    };
}

/**
 * Constructs a Stripe checkout URL with the user's ID and email prefilled for seamless activation.
 */
export function getStripeCheckoutUrl(user) {
    const baseUrl = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || DEFAULT_STRIPE_PAYMENT_LINK;
    const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'https://jobhelper.novu.works');

    if (user?.uid) {
        url.searchParams.set('client_reference_id', user.uid);
    }
    if (user?.email) {
        url.searchParams.set('prefilled_email', user.email);
    }
    return url.toString();
}
