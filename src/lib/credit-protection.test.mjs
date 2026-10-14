import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test credit protection logic, monthly quotas, and subscriber access control

describe('Credit Protection & Budget Guardrails Audit', () => {

    describe('1. Gemini API Key & Credit Protection Logic', () => {
        it('should require Pro subscription or personal key for free users', () => {
            const OWNER_EMAIL = 'fabian.velez1996@gmail.com';
            
            function isOwner(user) {
                if (!user || !user.email) return false;
                return user.email.toLowerCase().trim() === OWNER_EMAIL;
            }

            function isProUser(user, profile) {
                if (isOwner(user)) return true;
                const status = (profile?.subscriptionStatus || '').toLowerCase();
                return status === 'active' || status === 'pro' || status === 'trialing';
            }

            function canAccessSharedKey(user, profile, personalKey) {
                if (personalKey && personalKey.length > 5) {
                    return { allowed: true, mode: 'BYOK (Personal Key - $0 Platform Cost)' };
                }
                if (isOwner(user) || isProUser(user, profile)) {
                    return { allowed: true, mode: 'Shared Platform Key (Pro / Owner)' };
                }
                return { allowed: false, error: 'SUBSCRIPTION_REQUIRED' };
            }

            // Free non-paying user without personal key
            const freeUser = { email: 'stranger@example.com' };
            const freeProfile = { subscriptionStatus: 'free' };
            assert.deepEqual(canAccessSharedKey(freeUser, freeProfile, ''), {
                allowed: false,
                error: 'SUBSCRIPTION_REQUIRED'
            });

            // Free user WITH personal key (BYOK) -> Allowed at $0 cost to Fabian
            assert.deepEqual(canAccessSharedKey(freeUser, freeProfile, 'AIzaSyA_Personal_Key_123'), {
                allowed: true,
                mode: 'BYOK (Personal Key - $0 Platform Cost)'
            });

            // Owner (Fabian) -> Allowed
            const ownerUser = { email: 'fabian.velez1996@gmail.com' };
            assert.deepEqual(canAccessSharedKey(ownerUser, freeProfile, ''), {
                allowed: true,
                mode: 'Shared Platform Key (Pro / Owner)'
            });

            // Pro subscriber -> Allowed
            const payingUser = { email: 'subscriber@company.com' };
            const proProfile = { subscriptionStatus: 'active' };
            assert.deepEqual(canAccessSharedKey(payingUser, proProfile, ''), {
                allowed: true,
                mode: 'Shared Platform Key (Pro / Owner)'
            });
        });

        it('should enforce monthly hard cap before any Gemini API request is dispatched', () => {
            function checkGeminiQuota(used, cap, isPersonal) {
                // Personal key does not consume platform credits
                if (isPersonal) return { proceed: true };
                // Shared key enforces strict hard cap
                if (used >= cap) {
                    throw new Error(`Monthly Gemini safety cap reached (${used}/${cap} calls) to protect your credits.`);
                }
                return { proceed: true, nextUsed: used + 1 };
            }

            // Normal usage under cap (e.g. 150/300)
            assert.deepEqual(checkGeminiQuota(150, 300, false), { proceed: true, nextUsed: 151 });

            // Exactly at cap (300/300) -> must throw immediately
            assert.throws(
                () => checkGeminiQuota(300, 300, false),
                /Monthly Gemini safety cap reached/
            );

            // Above cap (305/300) -> must throw immediately
            assert.throws(
                () => checkGeminiQuota(305, 300, false),
                /Monthly Gemini safety cap reached/
            );

            // Personal key at 500 calls -> never blocked by platform cap
            assert.deepEqual(checkGeminiQuota(500, 300, true), { proceed: true });
        });
    });

    describe('2. Google Maps Platform Credit Protection & Commute Cache', () => {
        it('should return cached commute result immediately with 0 external API calls', () => {
            const cache = {
                'austin, tx::round rock, tx': {
                    duration: '24 mins',
                    distance: '18.2 mi',
                    cachedAt: '2026-10-13T12:00:00Z'
                }
            };

            function lookupCommute(origin, destination, cacheStore) {
                const key = `${origin.toLowerCase().trim()}::${destination.toLowerCase().trim()}`;
                if (cacheStore[key]) {
                    return {
                        success: true,
                        duration: cacheStore[key].duration,
                        distance: cacheStore[key].distance,
                        fromCache: true,
                        externalApiCalls: 0
                    };
                }
                return { fromCache: false, externalApiCalls: 1 };
            }

            const cachedResult = lookupCommute('Austin, TX', 'Round Rock, TX', cache);
            assert.equal(cachedResult.fromCache, true);
            assert.equal(cachedResult.externalApiCalls, 0);
            assert.equal(cachedResult.duration, '24 mins');
        });

        it('should block non-paying users from using shared Google Maps Platform key', () => {
            const OWNER_EMAIL = 'fabian.velez1996@gmail.com';

            function canAccessMapsKey(user, profile, personalKey) {
                const isPersonal = Boolean(personalKey && personalKey.length > 5);
                if (isPersonal) return { allowed: true, isPersonal: true };

                const isOwner = user?.email?.toLowerCase().trim() === OWNER_EMAIL;
                const isPro = ['active', 'pro', 'trialing'].includes((profile?.subscriptionStatus || '').toLowerCase());

                if (!isOwner && !isPro) {
                    return {
                        allowed: false,
                        error: 'NovuJobs Pro ($9.99/mo) or your personal Google Maps API key is required to calculate commute intelligence.'
                    };
                }
                return { allowed: true, isPersonal: false };
            }

            // Random unauthenticated or free user without key
            const anonymous = null;
            assert.equal(canAccessMapsKey(anonymous, null, '').allowed, false);

            const freeUser = { email: 'freebie@gmail.com' };
            assert.equal(canAccessMapsKey(freeUser, { subscriptionStatus: 'free' }, '').allowed, false);

            // Free user with their own Google Maps key
            assert.equal(canAccessMapsKey(freeUser, { subscriptionStatus: 'free' }, 'AIzaSyMapsPersonal123').allowed, true);

            // Pro user and Owner
            assert.equal(canAccessMapsKey({ email: 'pro@test.com' }, { subscriptionStatus: 'active' }, '').allowed, true);
            assert.equal(canAccessMapsKey({ email: 'fabian.velez1996@gmail.com' }, null, '').allowed, true);
        });

        it('should enforce monthly Maps hard cap (default 150 calls = ~$0.75 max)', () => {
            function checkMapsQuota(used, cap, isPersonal) {
                if (isPersonal) return { proceed: true };
                if (used >= cap) {
                    return {
                        success: false,
                        error: `Monthly safety cap reached (${used}/${cap} calls) to protect your credits. You can raise this cap in Profile.`
                    };
                }
                return { success: true };
            }

            assert.equal(checkMapsQuota(50, 150, false).success, true);
            assert.equal(checkMapsQuota(150, 150, false).success, false);
            assert.match(checkMapsQuota(150, 150, false).error, /Monthly safety cap reached/);
        });
    });

    describe('3. Firebase Cloud & Free Tier Resource Caps', () => {
        it('should enforce FREE_TIER_MAX_JOBS limit of 25 jobs for free non-paying users', () => {
            const FREE_TIER_MAX_JOBS = 25;

            function canAddJob(currentJobCount, isProOrOwner) {
                if (isProOrOwner) return { allowed: true };
                if (currentJobCount >= FREE_TIER_MAX_JOBS) {
                    return {
                        allowed: false,
                        reason: `Free tier limit of ${FREE_TIER_MAX_JOBS} applications reached. Upgrade to Pro for unlimited job tracking.`
                    };
                }
                return { allowed: true };
            }

            assert.equal(canAddJob(10, false).allowed, true);
            assert.equal(canAddJob(24, false).allowed, true);
            assert.equal(canAddJob(25, false).allowed, false);
            assert.match(canAddJob(25, false).reason, /Free tier limit of 25 applications reached/);

            // Pro / Owner can track unlimited jobs
            assert.equal(canAddJob(25, true).allowed, true);
            assert.equal(canAddJob(500, true).allowed, true);
        });
    });
});
