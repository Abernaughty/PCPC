export interface ApiResponse<T> {
    status: number;
    data?: T;
    error?: string;
    timestamp: string;
    cached?: boolean;
    cacheAge?: number;
}

export interface ErrorResponse {
    error: string;
    status: number;
    timestamp: string;
    path?: string;
    details?: any;
}

export interface PaginatedResponse<T> {
    items: T[];
    totalCount: number;
    pageSize: number;
    pageNumber: number;
    totalPages: number;
}
