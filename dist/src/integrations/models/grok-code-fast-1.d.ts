import { EventEmitter } from 'events';
import { AIModelProvider, AIModelConfig, AIModelRequest, AIModelResponse, ModelPerformanceMetrics, ProviderStatus, RateLimitStatus, UserConsentRecord, AnalyticsEvent } from '../../types/ai-models';
import { Logger } from '../../types';
/**
 * Grok Code Fast 1 - High-performance reasoning model optimized for rapid agentic coding tasks
 *
 * Features:
 * - Optimized for code generation and completion
 * - Fast response times for agentic workflows
 * - Free tier available via Roo Code Cloud
 * - All free interactions recorded for model improvement
 */
export declare class GrokCodeFast1Provider extends EventEmitter implements AIModelProvider {
    readonly name = "grok-code-fast-1";
    readonly config: AIModelConfig;
    private logger;
    private metrics;
    private requestCount;
    private rateLimitTracker;
    private consentRecords;
    private analyticsBuffer;
    private initialized;
    constructor(logger: Logger, config?: Partial<AIModelConfig>);
    initialize(): Promise<void>;
    generateResponse(request: AIModelRequest): Promise<AIModelResponse>;
    streamResponse(request: AIModelRequest): AsyncIterable<string>;
    healthCheck(): Promise<boolean>;
    getStatus(): Promise<ProviderStatus>;
    getMetrics(): Promise<ModelPerformanceMetrics>;
    recordAnalytics(event: AnalyticsEvent): Promise<void>;
    checkConsent(userId: string): Promise<boolean>;
    recordConsent(consent: UserConsentRecord): Promise<void>;
    checkRateLimit(userId: string): Promise<RateLimitStatus>;
    private buildEnhancedPrompt;
    private callGrokAPI;
    private generateCodeOptimizedResponse;
    private estimateTokens;
    private updateMetrics;
    private flushAnalytics;
    private generateRequestId;
    getConsentMessage(): string;
    shutdown(): Promise<void>;
}
