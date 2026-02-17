import { firebaseConfig } from './firebase';

/**
 * Verifies the Firebase ID Token using the Identity Toolkit REST API.
 *
 * @param {Request} req - The incoming request object
 * @returns {Promise<Object|null>} - The user object if valid, null otherwise
 */
export async function verifyAuth(req) {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn('Missing or invalid Authorization header');
        return null;
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
        console.warn('No token provided in Authorization header');
        return null;
    }

    try {
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                idToken: token,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Token verification failed:', errorData.error?.message || response.statusText);
            return null;
        }

        const data = await response.json();

        if (data.users && data.users.length > 0) {
            return data.users[0];
        }

        return null;
    } catch (error) {
        console.error('Auth verification error:', error);
        return null;
    }
}
