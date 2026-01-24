/**
 * Validation utility for review data
 */

interface ReviewData {
    entity: string;
    entityId: string;
    rating: number;
    comments: string;
}

interface ValidationError {
    field: string;
    message: string;
}

/**
 * Validates a single review entry
 * @param review - The review data to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateReview(review: ReviewData): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if review is an object
    if (!review || typeof review !== 'object') {
        return [{ field: 'review', message: 'Review must be an object' }];
    }

    // Validate entity field
    if (!review.entity || typeof review.entity !== 'string') {
        errors.push({ field: 'entity', message: 'Entity must be a non-empty string' });
    } else if (!['event', 'venue', 'dj'].includes(review.entity.toLowerCase())) {
        errors.push({ field: 'entity', message: 'Entity must be one of: event, venue, dj' });
    }

    // Validate entityId field
    if (!review.entityId || typeof review.entityId !== 'string') {
        errors.push({ field: 'entityId', message: 'EntityId must be a non-empty string' });
    }

    // Validate rating field
    if (typeof review.rating !== 'number') {
        errors.push({ field: 'rating', message: 'Rating must be a number' });
    } else if (review.rating < 0 || review.rating > 5) {
        errors.push({ field: 'rating', message: 'Rating must be between 0 and 5' });
    } else if (!Number.isInteger(review.rating)) {
        errors.push({ field: 'rating', message: 'Rating must be an integer' });
    }

    // Validate comments field
    if (typeof review.comments !== 'string') {
        errors.push({ field: 'comments', message: 'Comments must be a string' });
    } else if (review.comments.length > 1000) {
        errors.push({ field: 'comments', message: 'Comments cannot exceed 1000 characters' });
    }

    return errors;
}

/**
 * Validates multiple review entries
 * @param reviews - Array of review data to validate
 * @returns Map of review indices to validation errors (empty map if all valid)
 */
export function validateReviews(reviews: any): Map<number, ValidationError[]> {
    const errors = new Map<number, ValidationError[]>();

    if (!reviews || !Array.isArray(reviews)) {
        errors.set(-1, [{ field: 'reviews', message: 'Reviews must be an array' }]);
        return errors;
    }

    if (reviews.length === 0) {
        errors.set(-1, [{ field: 'reviews', message: 'At least one review must be provided' }]);
        return errors;
    }

    reviews.forEach((review, index) => {
        const reviewErrors = validateReview(review);
        if (reviewErrors.length > 0) {
            errors.set(index, reviewErrors);
        }
    });

    return errors;
}

/**
 * Checks if reviews are valid (wrapper for easier boolean checks)
 * @param reviews - Array of review data to validate
 * @returns true if all reviews are valid, false otherwise
 */
export function isValidReviews(reviews: ReviewData[]): boolean {
    return validateReviews(reviews).size === 0;
}

/**
 * Formats validation errors into a readable string
 * @param errors - Map of validation errors from validateReviews
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: Map<number, ValidationError[]>): string {
    if (errors.size === 0) {
        return '';
    }

    const messages: string[] = [];

    errors.forEach((fieldErrors, index) => {
        if (index === -1) {
            fieldErrors.forEach(err => {
                messages.push(`${err.message}`);
            });
        } else {
            fieldErrors.forEach(err => {
                messages.push(`Review ${index + 1} - ${err.field}: ${err.message}`);
            });
        }
    });

    return messages.join('; ');
}

/**
 * Sanitizes review data by trimming strings and ensuring correct types
 * @param review - The review data to sanitize
 * @returns Sanitized review data
 */
export function sanitizeReview(review: Partial<ReviewData>): ReviewData {
    return {
        entity: String(review.entity || '').trim().toLowerCase(),
        entityId: String(review.entityId || '').trim(),
        rating: Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0))),
        comments: String(review.comments || '').trim().substring(0, 1000),
    };
}

/**
 * Sanitizes multiple review entries
 * @param reviews - Array of review data to sanitize
 * @returns Array of sanitized review data
 */
export function sanitizeReviews(reviews: Partial<ReviewData>[]): ReviewData[] {
    return reviews.map(review => sanitizeReview(review));
}

/**
 * Validates and sanitizes reviews in one step
 * @param reviews - Array of review data to validate and sanitize
 * @returns Object with sanitized reviews and any validation errors
 */
export function validateAndSanitizeReviews(reviews: any) {
    // Handle null or undefined input
    if (!reviews) {
        return {
            reviews: [],
            errors: new Map([[-1, [{ field: 'reviews', message: 'Reviews data is required' }]]]),
            isValid: false,
            errorMessage: 'Reviews data is required',
        };
    }

    // Ensure reviews is an array
    const reviewsArray = Array.isArray(reviews) ? reviews : [];
    
    const sanitized = sanitizeReviews(reviewsArray);
    const errors = validateReviews(sanitized);

    return {
        reviews: sanitized,
        errors,
        isValid: errors.size === 0,
        errorMessage: formatValidationErrors(errors),
    };
}
