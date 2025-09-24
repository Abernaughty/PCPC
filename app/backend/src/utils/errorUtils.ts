import { ErrorResponse } from '../models/ApiResponse';

/**
 * Create a standardized error response
 * @param message The error message
 * @param status The HTTP status code
 * @param path The request path
 * @param details Additional error details
 * @returns The error response
 */
export function createErrorResponse(
    message: string,
    status: number = 500,
    path?: string,
    details?: any
): ErrorResponse {
    return {
        error: message,
        status,
        timestamp: new Date().toISOString(),
        path,
        details
    };
}

/**
 * Create a not found error response
 * @param resourceType The type of resource that was not found
 * @param resourceId The ID of the resource that was not found
 * @param path The request path
 * @returns The error response
 */
export function createNotFoundError(
    resourceType: string,
    resourceId: string,
    path?: string
): ErrorResponse {
    return createErrorResponse(
        `${resourceType} not found: ${resourceId}`,
        404,
        path
    );
}

/**
 * Create a bad request error response
 * @param message The error message
 * @param path The request path
 * @param details Additional error details
 * @returns The error response
 */
export function createBadRequestError(
    message: string,
    path?: string,
    details?: any
): ErrorResponse {
    return createErrorResponse(
        message,
        400,
        path,
        details
    );
}

/**
 * Create a server error response
 * @param message The error message
 * @param path The request path
 * @param details Additional error details
 * @returns The error response
 */
export function createServerError(
    message: string,
    path?: string,
    details?: any
): ErrorResponse {
    return createErrorResponse(
        message,
        500,
        path,
        details
    );
}

/**
 * Handle an error and return a standardized error response
 * @param error The error to handle
 * @param path The request path
 * @returns The error response
 */
export function handleError(error: any, path?: string): ErrorResponse {
    console.error(`Error in request to ${path || 'unknown path'}:`, error);
    
    // If it's already an ErrorResponse, return it
    if (error && typeof error === 'object' && 'error' in error && 'status' in error) {
        return error as ErrorResponse;
    }
    
    // Handle specific error types
    if (error instanceof SyntaxError) {
        return createBadRequestError('Invalid JSON in request', path);
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return createServerError('Unable to connect to external service', path, {
            code: error.code,
            service: error.address
        });
    }
    
    // Default error handling
    return createServerError(
        error.message || 'An unexpected error occurred',
        path,
        process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined
    );
}

/**
 * Log an error with context information
 * @param error The error to log
 * @param context Additional context information
 */
export function logError(error: any, context: Record<string, any> = {}): void {
    console.error('Error:', {
        message: error.message,
        stack: error.stack,
        ...context,
        timestamp: new Date().toISOString()
    });
}
