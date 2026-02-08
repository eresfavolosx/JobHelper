
/**
 * Safely parses various date formats ensuring a valid Date object is returned.
 * Handles: Date objects, ISO strings, Firestore Timestamps, and invalid inputs.
 */
export const safeDate = (input) => {
    if (!input) return new Date();

    // Already a Date object
    if (input instanceof Date) {
        // Check if it's "Invalid Date"
        if (isNaN(input.getTime())) return new Date();
        return input;
    }

    // Handle Firestore Timestamp (duck typing)
    if (typeof input === 'object' && typeof input.toDate === 'function') {
        return input.toDate();
    }

    // Handle strings or numbers
    const d = new Date(input);

    // Check for invalid date
    if (isNaN(d.getTime())) {
        console.warn('Invalid date encountered:', input);
        return new Date(); // Fallback to current time to prevent crashes
    }

    return d;
};
