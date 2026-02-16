import { firebaseConfig } from './firebase';

/**
 * Verifies a Firebase ID token using the Identity Toolkit REST API.
 * This is used for server-side verification where firebase-admin is not available.
 *
 * @param {string} token - The Firebase ID token to verify
 * @returns {Promise<Object|null>} - The user object if valid, null otherwise
 */
export async function verifyIdToken(token) {
    if (!token) return null;

    try {
        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken: token }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            // detailed error logging for debugging (exclude sensitive info if possible, but error code is useful)
            console.error('Token verification failed:', errorData.error ? errorData.error.message : 'Unknown error');
            return null;
        }

        const data = await response.json();
        if (data.users && data.users.length > 0) {
            return data.users[0];
        }

        return null;
    } catch (error) {
        console.error('Token verification error:', error);
        return null;
    }
}
