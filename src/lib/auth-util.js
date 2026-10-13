import { firebaseConfig } from './firebase.js';

/**
 * Verifies a Firebase ID token using the Firebase Auth REST API.
 * This is a lightweight alternative to firebase-admin when it's not available.
 *
 * @param {Request} req The incoming request object
 * @returns {Promise<Object|null>} The user object if verified, or null if invalid
 */
export async function verifyAuth(req) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('[Auth] Missing or invalid Authorization header');
            return null;
        }

        const idToken = authHeader.split('Bearer ')[1];
        if (!idToken) {
            console.warn('[Auth] Empty token');
            return null;
        }

        // Use Firebase Identity Toolkit to verify the token
        // https://cloud.google.com/identity-platform/docs/use-rest-api#section-verify-id-token
        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Auth] Token verification failed:', errorData.error?.message || response.statusText);
            return null;
        }

        const data = await response.json();

        // If users list is present and not empty, the token is valid
        if (data.users && data.users.length > 0) {
            return data.users[0];
        }

        return null;
    } catch (error) {
        console.error('[Auth] Error during verification:', error);
        return null;
    }
}
