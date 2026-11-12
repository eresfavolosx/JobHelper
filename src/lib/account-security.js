export const MIN_PASSWORD_LENGTH = 6;

export function hasPasswordProvider(user) {
    const providers = Array.isArray(user?.providerData) ? user.providerData : [];
    return providers.some((entry) => entry?.providerId === 'password');
}

export function hasGoogleProvider(user) {
    const providers = Array.isArray(user?.providerData) ? user.providerData : [];
    return providers.some((entry) => entry?.providerId === 'google.com');
}

export function validateNewPassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
        return { valid: false, error: 'Please enter a new password.' };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        return {
            valid: false,
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        };
    }
    return { valid: true, error: '' };
}

export function mapPasswordActionError(err) {
    const code = err?.code || '';
    switch (code) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/weak-password':
            return `Please choose a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`;
        case 'auth/requires-recent-login':
            return 'For your security, please verify your Google sign-in in the popup and try again.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
            return 'Verification popup was closed before completing. Please try again.';
        case 'auth/provider-already-linked':
            return 'An email & password sign-in is already linked to this account. You can update it or send a reset email.';
        default:
            return err?.message || 'Unable to update password right now. Please try again.';
    }
}
