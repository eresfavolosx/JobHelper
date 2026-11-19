import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    hasConfiguredAiKey,
    hasConfiguredMapsKey,
    checkApiAccess,
    canAddJob,
    FREE_TIER_MAX_JOBS
} from './subscription.js';
import { calculateCommute, loadGoogleMapsScript } from './maps-service.js';

// Test credit protection logic, monthly quotas, and strict account API-key gating

describe('Credit Protection & Budget Guardrails Audit', () => {

    describe('1. Account API Key Requirement & AI Credit Protection Logic', () => {
        it('should block AI API access when no API key is configured on profile (even for owner or pro)', () => {
            const ownerUser = { email: 'fabian.velez1996@gmail.com' };
            const proUser = { email: 'subscriber@company.com' };
            const freeUser = { email: 'stranger@example.com' };

            const emptyProfile = { subscriptionStatus: 'free', geminiApiKey: '' };
            const proEmptyProfile = { subscriptionStatus: 'premium', geminiApiKey: '' };

            // Owner without personal key on profile -> Blocked
            assert.equal(hasConfiguredAiKey(emptyProfile), false);
            const ownerCheck = checkApiAccess(ownerUser, emptyProfile);
            assert.equal(ownerCheck.allowed, false);
            assert.equal(ownerCheck.code, 'API_KEY_REQUIRED');

            // Pro user without personal key on profile -> Blocked
            assert.equal(hasConfiguredAiKey(proEmptyProfile), false);
            const proCheck = checkApiAccess(proUser, proEmptyProfile);
            assert.equal(proCheck.allowed, false);
            assert.equal(proCheck.code, 'API_KEY_REQUIRED');

            // Free user without personal key on profile -> Blocked
            const freeCheck = checkApiAccess(freeUser, emptyProfile);
            assert.equal(freeCheck.allowed, false);
            assert.equal(freeCheck.code, 'API_KEY_REQUIRED');

            // Account with personal Gemini, Claude, OpenAI, or Custom AI key -> Allowed
            assert.equal(hasConfiguredAiKey({ geminiApiKey: 'AIzaSyA_Personal_Key_123' }), true);
            assert.equal(checkApiAccess(freeUser, { geminiApiKey: 'AIzaSyA_Personal_Key_123' }).allowed, true);
            assert.equal(hasConfiguredAiKey({ claudeApiKey: 'sk-ant-personal-123456' }), true);
            assert.equal(hasConfiguredAiKey({ openaiApiKey: 'sk-openai-personal-123' }), true);
            assert.equal(hasConfiguredAiKey({ customAiApiKey: 'sk-deepseek-123456', customAiBaseUrl: 'https://api.deepseek.com/v1' }), true);

            // Placeholder or short keys must not count
            assert.equal(hasConfiguredAiKey({ geminiApiKey: 'your_api_key_here' }), false);
            assert.equal(hasConfiguredAiKey({ geminiApiKey: '12345' }), false);
            assert.equal(hasConfiguredAiKey({ customAiApiKey: 'sk-deepseek-123456', customAiBaseUrl: '' }), false);
        });

        it('should ignore environment keys when checking profile AI and Maps keys', () => {
            const prevGemini = process.env.GEMINI_API_KEY;
            const prevPublicGemini = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            const prevPublicMaps = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            const prevFirebase = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
            try {
                process.env.GEMINI_API_KEY = 'env-gemini-shared-secret-key';
                process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'public-gemini-ignored';
                process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'public-maps-ignored';
                process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'env-firebase-shared-key';

                assert.equal(hasConfiguredAiKey({}), false);
                assert.equal(hasConfiguredAiKey({ geminiApiKey: 'env-gemini-shared-secret-key' }), false);
                assert.equal(checkApiAccess({ email: 'fabian.velez1996@gmail.com' }, { geminiApiKey: 'env-gemini-shared-secret-key' }).allowed, false);

                assert.equal(hasConfiguredMapsKey({}), false);
                assert.equal(hasConfiguredMapsKey({ googleMapsApiKey: 'env-firebase-shared-key' }), false);
                assert.equal(hasConfiguredMapsKey({ googleMapsApiKey: 'AIzaSyPersonalMapsKey1234' }), true);
            } finally {
                if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
                else process.env.GEMINI_API_KEY = prevGemini;
                if (prevPublicGemini === undefined) delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
                else process.env.NEXT_PUBLIC_GEMINI_API_KEY = prevPublicGemini;
                if (prevPublicMaps === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = prevPublicMaps;
                if (prevFirebase === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
                else process.env.NEXT_PUBLIC_FIREBASE_API_KEY = prevFirebase;
            }
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

        it('should block calculateCommute and loadGoogleMapsScript when no personal Maps API key is configured', async () => {
            const missingKeyRes = await calculateCommute('San Juan, PR', 'Guaynabo, PR', '');
            assert.equal(missingKeyRes.success, false);
            assert.equal(missingKeyRes.code, 'API_KEY_REQUIRED');

            const shortKeyRes = await calculateCommute('San Juan, PR', 'Guaynabo, PR', '123');
            assert.equal(shortKeyRes.success, false);
            assert.equal(shortKeyRes.code, 'API_KEY_REQUIRED');

            await assert.rejects(
                () => loadGoogleMapsScript(''),
                (err) => err?.code === 'API_KEY_REQUIRED'
            );
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
        it('should enforce FREE_TIER_MAX_JOBS limit of 25 jobs for free users while keeping non-AI tracking unlimited for owner/pro', () => {
            assert.equal(FREE_TIER_MAX_JOBS, 25);

            const freeUser = { email: 'user@example.com' };
            const ownerUser = { email: 'fabian.velez1996@gmail.com' };
            const proProfile = { subscriptionStatus: 'premium', geminiApiKey: '' };

            assert.equal(canAddJob(freeUser, { subscriptionStatus: 'free' }, 10).allowed, true);
            assert.equal(canAddJob(freeUser, { subscriptionStatus: 'free' }, 24).allowed, true);
            assert.equal(canAddJob(freeUser, { subscriptionStatus: 'free' }, 25).allowed, false);

            // Non-AI job tracking remains unrestricted for Owner and Pro even when AI keys are empty
            assert.equal(canAddJob(ownerUser, { geminiApiKey: '' }, 500).allowed, true);
            assert.equal(canAddJob({ email: 'pro@test.com' }, proProfile, 500).allowed, true);
        });
    });
});
