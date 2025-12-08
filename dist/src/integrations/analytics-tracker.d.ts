import { AnalyticsEvent, UserConsentRecord } from '../types/ai-models';
import { Logger } from '../types';
import { RooCodeCloudService } from './roo-code-cloud';
/**
 * Analytics Tracker
 *
 * Handles performance tracking, analytics collection, and reporting
 * for AI model usage with emphasis on transparency and user consent
 */
export declare class AnalyticsTracker {
    private logger;
    private cloudService;
    private events;
    private metricsHistory;
    private performanceBuffer;
    constructor(logger: Logger, cloudService: RooCodeCloudService);
    /**
     * Track a model request
     */
    trackRequest(data: RequestTrackingData): Promise<void>;
    /**
     * Track a model response
     */
    trackResponse(data: ResponseTrackingData): Promise<void>;
    /**
     * Track an error
     */
    trackError(data: ErrorTrackingData): Promise<void>;
    /**
     * Track consent acceptance
     */
    trackConsent(consent: UserConsentRecord): Promise<void>;
    /**
     * Generate performance report for a model
     */
    generatePerformanceReport(modelId: string): Promise<PerformanceReport>;
    /**
     * Get aggregated analytics for a time period
     */
    getAnalytics(filter: AnalyticsFilter): Promise<AnalyticsReport>;
    /**
     * Export analytics data for compliance/auditing
     */
    exportAnalytics(filter: AnalyticsFilter): Promise<AnalyticsExport>;
    /**
     * Clear analytics data (for privacy compliance)
     */
    clearAnalytics(filter: AnalyticsFilter): Promise<number>;
    /**
     * Get consent status for a user and model
     */
    getConsentStatus(userId: string, modelId: string): Promise<UserConsentRecord | null>;
    private filterEvents;
    private matchesFilter;
    private groupBy;
    private reportToMetrics;
    private getEmptyReport;
    private generateEventId;
    getEventCount(): number;
    getPerformanceDataPointCount(): number;
}
export interface RequestTrackingData {
    modelId: string;
    userId: string;
    sessionId: string;
    promptLength: number;
    hasContext: boolean;
    options?: Record<string, any>;
    performanceMetrics: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        processingTime: number;
    };
}
export interface ResponseTrackingData {
    modelId: string;
    userId: string;
    sessionId: string;
    responseLength: number;
    finishReason: string;
    cached: boolean;
    performanceMetrics: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        processingTime: number;
    };
}
export interface ErrorTrackingData {
    modelId: string;
    userId: string;
    sessionId: string;
    errorCode: string;
    errorMessage: string;
    errorType: string;
    retryable: boolean;
}
export interface PerformanceDataPoint {
    modelId: string;
    latency: number;
    tokens: number;
    success: boolean;
    timestamp: Date;
}
export interface PerformanceReport {
    modelId: string;
    period: {
        start: Date;
        end: Date;
    };
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    latency: {
        min: number;
        max: number;
        mean: number;
        median: number;
        p95: number;
        p99: number;
    };
    tokens: {
        total: number;
        average: number;
    };
    generated: Date;
}
export interface AnalyticsFilter {
    modelId?: string;
    userId?: string;
    eventType?: string;
    period?: {
        start?: Date;
        end?: Date;
    };
}
export interface AnalyticsReport {
    period?: {
        start?: Date;
        end?: Date;
    };
    totalEvents: number;
    eventsByType: Array<{
        type: string;
        count: number;
    }>;
    eventsByModel: Array<{
        modelId: string;
        count: number;
    }>;
    uniqueUsers: number;
    generated: Date;
}
export interface AnalyticsExport {
    exportId: string;
    filter: AnalyticsFilter;
    events: AnalyticsEvent[];
    metadata: {
        totalEvents: number;
        exportedAt: Date;
        exportedBy: string;
        format: string;
        version: string;
    };
}
