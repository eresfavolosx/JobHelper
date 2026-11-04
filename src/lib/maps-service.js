/**
 * Google Maps Platform service for JobHelper.
 * Provides location lookup, commute time calculation, and Google Maps deep-links.
 * Features built-in persistent caching and strict monthly budget protection to prevent credit overflow.
 */

import { auth } from './firebase';
import { isOwner } from './subscription';

let mapsScriptLoadingPromise = null;

const CACHE_STORAGE_KEY = 'jobhelper_maps_commute_cache';
const DEFAULT_MONTHLY_CAP = 150; // 150 calls/month costs ~$0.75, far below the $10 credit limit

function getCurrentMonthKey() {
    return new Date().toISOString().slice(0, 7); // e.g. "2026-10"
}

function getUsageStorageKey() {
    return `jobhelper_maps_usage_${getCurrentMonthKey()}`;
}

/**
 * Returns current monthly Google Maps usage and limit.
 */
export function getMapsUsageStats() {
    if (typeof window === 'undefined') {
        return { used: 0, cap: DEFAULT_MONTHLY_CAP, month: getCurrentMonthKey() };
    }
    const used = parseInt(localStorage.getItem(getUsageStorageKey()) || '0', 10);
    const cap = parseInt(localStorage.getItem('jobhelper_maps_monthly_cap') || String(DEFAULT_MONTHLY_CAP), 10);
    return { used, cap, month: getCurrentMonthKey() };
}

/**
 * Sets user-defined monthly limit for Google Maps calls.
 */
export function setMapsMonthlyCap(cap) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('jobhelper_maps_monthly_cap', String(cap));
    }
}

/**
 * Increments the monthly usage counter.
 */
function incrementMapsUsage() {
    if (typeof window === 'undefined') return;
    const stats = getMapsUsageStats();
    localStorage.setItem(getUsageStorageKey(), String(stats.used + 1));
}

/**
 * Reads cached commute result from localStorage if available.
 */
function getCachedCommute(origin, destination) {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CACHE_STORAGE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        const cacheKey = `${origin.toLowerCase().trim()}::${destination.toLowerCase().trim()}`;
        return cache[cacheKey] || null;
    } catch {
        return null;
    }
}

/**
 * Caches commute result locally to avoid redundant Google Maps API calls.
 */
function setCachedCommute(origin, destination, data) {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(CACHE_STORAGE_KEY);
        const cache = raw ? JSON.parse(raw) : {};
        const cacheKey = `${origin.toLowerCase().trim()}::${destination.toLowerCase().trim()}`;
        cache[cacheKey] = {
            duration: data.duration,
            distance: data.distance,
            cachedAt: new Date().toISOString()
        };
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('Failed to cache commute result:', e);
    }
}

/**
 * Clears the commute cache.
 */
export function clearMapsCache() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(CACHE_STORAGE_KEY);
    }
}

/**
 * Dynamically loads the Google Maps JavaScript API with the provided API key.
 * Caches the load promise to prevent multiple script tag injections.
 *
 * @param {string} apiKey - The user's Google Maps API key
 * @returns {Promise<typeof google.maps>}
 */
export function loadGoogleMapsScript(apiKey) {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Google Maps can only be loaded in the browser.'));
    }

    if (window.google && window.google.maps) {
        return Promise.resolve(window.google.maps);
    }

    if (mapsScriptLoadingPromise) {
        return mapsScriptLoadingPromise;
    }

    let resolvedKey = apiKey ? String(apiKey).trim() : '';
    const sharedMapsKey = typeof process !== 'undefined'
        ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '')
        : '';

    let currentUser = null;
    try {
        currentUser = auth?.currentUser;
    } catch {}

    // If a non-owner passes the platform owner's shared key as their personal key, treat it as empty so authorization is enforced
    if (resolvedKey && sharedMapsKey && resolvedKey === sharedMapsKey && !isOwner(currentUser)) {
        resolvedKey = '';
    }

    const isPersonalKey = Boolean(resolvedKey && resolvedKey.length > 5 && (resolvedKey !== sharedMapsKey || isOwner(currentUser)));

    if (!isPersonalKey) {
        // Shared platform Google Maps API key is strictly restricted to Platform Owner (fabian.velez1996@gmail.com)
        if (!isOwner(currentUser)) {
            return Promise.reject(new Error('Add your personal Google Maps API key in Profile settings to calculate commute times.'));
        }

        resolvedKey = sharedMapsKey;
    }

    if (!resolvedKey) {
        return Promise.reject(new Error('Google Maps API Key is required. Configure it in Profile settings.'));
    }

    mapsScriptLoadingPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById('google-maps-script');
        if (existingScript) {
            existingScript.remove();
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(resolvedKey)}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            if (window.google && window.google.maps) {
                resolve(window.google.maps);
            } else {
                reject(new Error('Google Maps API failed to initialize.'));
            }
        };

        script.onerror = () => {
            mapsScriptLoadingPromise = null;
            reject(new Error('Failed to load Google Maps script. Check your API key and network connection.'));
        };

        document.head.appendChild(script);
    });

    return mapsScriptLoadingPromise;
}

/**
 * Generates a direct Google Maps search link for a company and optional location.
 */
export function getMapsSearchUrl(company, location) {
    const queryParts = [company, location].filter(Boolean).map(s => String(s).trim());
    if (queryParts.length === 0) return 'https://www.google.com/maps';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts.join(', '))}`;
}

/**
 * Generates a Google Maps directions link from origin to destination.
 */
export function getDirectionsUrl(origin, destination) {
    if (!origin || !destination) return 'https://www.google.com/maps';
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/**
 * Calculates commute time and distance using Google Maps Distance Matrix service.
 * Enforces persistent cache and monthly usage limits to protect against unexpected charges.
 *
 * @param {string} origin - User's home address or location
 * @param {string} destination - Company address or job location
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<{ success: boolean, duration?: string, distance?: string, fromCache?: boolean, error?: string }>}
 */
export async function calculateCommute(origin, destination, apiKey) {
    if (!origin || !destination) {
        return { success: false, error: 'Both origin and destination are required.' };
    }

    // 1. Check persistent cache first (costs $0.00)
    const cached = getCachedCommute(origin, destination);
    if (cached) {
        return {
            success: true,
            duration: cached.duration,
            distance: cached.distance,
            fromCache: true
        };
    }

    const sharedMapsKey = typeof process !== 'undefined'
        ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '')
        : '';
    const currentUser = auth?.currentUser;

    let resolvedKey = apiKey ? String(apiKey).trim() : '';
    if (resolvedKey && sharedMapsKey && resolvedKey === sharedMapsKey && !isOwner(currentUser)) {
        resolvedKey = '';
    }

    if (!resolvedKey) {
        // Shared platform key fallback: restricted strictly to Platform Owner (fabian.velez1996@gmail.com)
        if (!isOwner(currentUser)) {
            return {
                success: false,
                error: 'Add your personal Google Maps API key in Profile settings to calculate commute intelligence.'
            };
        }
        resolvedKey = sharedMapsKey;
    }

    if (!resolvedKey) {
        return { success: false, error: 'Google Maps API key not configured. Set it in Profile.' };
    }

    const isPersonalKey = Boolean(resolvedKey && resolvedKey.length > 5 && (resolvedKey !== sharedMapsKey || isOwner(currentUser)));

    // 2. Enforce monthly safety quota cap for shared platform key
    if (!isPersonalKey) {
        const stats = getMapsUsageStats();
        if (stats.used >= stats.cap) {
            return {
                success: false,
                error: `Monthly safety cap reached (${stats.used}/${stats.cap} calls) to protect your credits. You can raise this cap in Profile.`
            };
        }
    }

    try {
        const maps = await loadGoogleMapsScript(resolvedKey);
        const service = new maps.DistanceMatrixService();

        return new Promise((resolve) => {
            service.getDistanceMatrix(
                {
                    origins: [origin],
                    destinations: [destination],
                    travelMode: maps.TravelMode.DRIVING,
                    unitSystem: maps.UnitSystem.IMPERIAL
                },
                (response, status) => {
                    if (status !== 'OK' || !response) {
                        resolve({ success: false, error: `Distance Matrix error: ${status}` });
                        return;
                    }

                    const element = response.rows?.[0]?.elements?.[0];
                    if (!element || element.status !== 'OK') {
                        resolve({
                            success: false,
                            error: element?.status === 'ZERO_RESULTS'
                                ? 'No driving route found between these locations.'
                                : `Could not calculate route (${element?.status || 'UNKNOWN'})`
                        });
                        return;
                    }

                    const result = {
                        success: true,
                        duration: element.duration.text,
                        distance: element.distance.text,
                        fromCache: false
                    };

                    // Cache locally and record usage
                    setCachedCommute(origin, destination, result);
                    if (!isPersonalKey) {
                        incrementMapsUsage();
                    }

                    resolve(result);
                }
            );
        });
    } catch (err) {
        return { success: false, error: err.message || 'Failed to calculate commute.' };
    }
}

/**
 * Tests whether a Google Maps API Key is valid and functional.
 * Does not count towards monthly commute quota.
 */
export async function testGoogleMapsApiKey(apiKey) {
    if (!apiKey || !apiKey.trim()) {
        return { success: false, message: 'Please provide an API key.' };
    }

    try {
        const maps = await loadGoogleMapsScript(apiKey.trim());
        const geocoder = new maps.Geocoder();

        return new Promise((resolve) => {
            geocoder.geocode({ address: 'San Francisco, CA' }, (results, status) => {
                if (status === 'OK' && results && results.length > 0) {
                    resolve({ success: true, message: 'Connection successful! Google Maps API is active.' });
                } else if (status === 'REQUEST_DENIED') {
                    resolve({ success: false, message: 'Request denied. Ensure Geocoding & Distance Matrix APIs are enabled in GCP Console.' });
                } else {
                    resolve({ success: false, message: `Maps check returned status: ${status}` });
                }
            });
        });
    } catch (err) {
        return { success: false, message: err.message || 'Failed to connect to Google Maps API.' };
    }
}
