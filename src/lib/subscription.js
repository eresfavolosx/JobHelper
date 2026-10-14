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
 * Verifies if user is allowed to access shared Google Cloud / Gemini / Maps APIs.
 * Only fabian.velez1996@gmail.com or paying Pro users ($9.99/mo) can access Fabian's shared API keys.
 * Free users can ONLY use AI features if they provide their own Gemini API key (BYOK).
 */
export function checkApiAccess(user, profile) {
    // 1. Owner has unrestricted access
    if (isOwner(user)) {
        return {
            allowed: true,
            tier: 'owner',
            useSharedKey: true,
            message: 'Owner access active'
        };
    }

    // 2. Paid Pro user ($9.99/mo)
    if (isProUser(user, profile)) {
        return {
            allowed: true,
            tier: 'pro',
            useSharedKey: true,
            message: 'Pro subscription active'
        };
    }

    // 3. Free user with Bring-Your-Own-Key (BYOK) - costs Fabian $0.00
    if (profile?.geminiApiKey && String(profile.geminiApiKey).trim().length > 10) {
        return {
            allowed: true,
            tier: 'byok',
            useSharedKey: false,
            message: 'Using personal Gemini API key'
        };
    }

    // 4. Blocked
    return {
        allowed: false,
        tier: 'free',
        useSharedKey: false,
        message: 'This feature requires a NovuJobs Pro subscription ($9.99/mo) or your own free Gemini API key to protect cloud credits.'
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
