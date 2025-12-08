import { EventEmitter } from 'events';
import { CloudServiceConfig, CloudServiceResponse, AnalyticsEvent, UserConsentRecord, ModelPerformanceMetrics } from '../types/ai-models';
import { Logger } from '../types';
/**
 * Roo Code Cloud Integration Service
 *
 * Provides integration with Roo Code Cloud for:
 * - Model hosting and access
 * - Analytics and telemetry
 * - Usage tracking and metrics
 * - Free tier management
 */
export declare class RooCodeCloudService extends EventEmitter {
    private config;
    private logger;
    private analyticsQueue;
    private metricsCache;
    private flushInterval;
    private connected;
    constructor(logger: Logger, config?: Partial<CloudServiceConfig>);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    /**
     * Submit analytics event to Roo Code Cloud
     */
    submitAnalytics(event: AnalyticsEvent): Promise<CloudServiceResponse<void>>;
    /**
     * Submit batch of analytics events
     */
    submitAnalyticsBatch(events: AnalyticsEvent[]): Promise<CloudServiceResponse<void>>;
    /**
     * Record user consent
     */
    recordConsent(consent: UserConsentRecord): Promise<CloudServiceResponse<void>>;
    /**
     * Get user consent status
     */
    getConsentStatus(userId: string, modelId: string): Promise<CloudServiceResponse<UserConsentRecord>>;
    /**
     * Submit model performance metrics
     */
    submitMetrics(metrics: ModelPerformanceMetrics): Promise<CloudServiceResponse<void>>;
    /**
     * Get model performance metrics
     */
    getMetrics(modelId: string): Promise<CloudServiceResponse<ModelPerformanceMetrics>>;
    /**
     * Check model availability on Roo Code Cloud
     */
    checkModelAvailability(modelId: string): Promise<CloudServiceResponse<boolean>>;
    /**
     * Get free tier usage information
     */
    getFreeTierUsage(userId: string): Promise<CloudServiceResponse<FreeTierUsage>>;
    /**
     * Log model usage for free tier tracking
     */
    logUsage(usage: UsageLog): Promise<CloudServiceResponse<void>>;
    /**
     * Get service health status
     */
    getHealthStatus(): Promise<CloudServiceResponse<ServiceHealth>>;
    private validateConnection;
    private makeRequest;
    private simulateConsentResponse;
    private simulateMetricsResponse;
    private simulateHealthResponse;
    private simulateUsageResponse;
    private flushAnalytics;
    private startAnalyticsFlush;
    private createResponse;
    private createErrorResponse;
    private generateRequestId;
    isConnected(): boolean;
    getConfig(): CloudServiceConfig;
}
export interface FreeTierUsage {
    userId: string;
    tier: 'free' | 'paid' | 'enterprise';
    requestsUsed: number;
    requestsLimit: number;
    tokensUsed: number;
    tokensLimit: number;
    resetDate: Date;
    percentUsed: number;
}
export interface UsageLog {
    userId: string;
    modelId: string;
    sessionId: string;
    tokensUsed: number;
    requestCount: number;
    tier: 'free' | 'paid' | 'enterprise';
    timestamp: Date;
}
export interface ServiceHealth {
    status: 'operational' | 'degraded' | 'outage';
    uptime: number;
    latency: number;
    activeConnections: number;
    timestamp: Date;
}
