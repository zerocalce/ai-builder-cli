export interface AIModelConfig {
    name: string;
    provider: string;
    modelId: string;
    version: string;
    description: string;
    capabilities: ModelCapabilities;
    pricing: ModelPricing;
    rateLimits: RateLimits;
    endpoint?: string;
    apiKey?: string;
}
export interface ModelCapabilities {
    maxTokens: number;
    supportsStreaming: boolean;
    supportsFunctionCalling: boolean;
    supportsCodeCompletion: boolean;
    supportsCodeGeneration: boolean;
    supportsCodeAnalysis: boolean;
    languages: string[];
    specializations: string[];
}
export interface ModelPricing {
    tier: 'free' | 'paid' | 'enterprise';
    inputCostPerToken?: number;
    outputCostPerToken?: number;
    monthlyQuota?: number;
    requiresConsent?: boolean;
    consentMessage?: string;
}
export interface RateLimits {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    tokensPerMinute: number;
    concurrentRequests: number;
}
export interface AIModelRequest {
    prompt: string;
    context?: ModelContext;
    options?: ModelOptions;
    metadata?: Record<string, any>;
}
export interface ModelContext {
    conversationHistory?: ConversationMessage[];
    codeContext?: CodeContext;
    projectContext?: ProjectContext;
    userContext?: UserContext;
}
export interface ConversationMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: Date;
}
export interface CodeContext {
    language: string;
    code: string;
    filePath?: string;
    dependencies?: string[];
    framework?: string;
}
export interface ProjectContext {
    projectId: string;
    projectName: string;
    template: string;
    technologies: string[];
}
export interface UserContext {
    userId: string;
    sessionId: string;
    preferences?: Record<string, any>;
}
export interface ModelOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stream?: boolean;
    stopSequences?: string[];
}
export interface AIModelResponse {
    content: string;
    model: string;
    usage: UsageMetrics;
    metadata: ResponseMetadata;
    finishReason: 'stop' | 'length' | 'error';
}
export interface UsageMetrics {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    processingTime: number;
    cost?: number;
}
export interface ResponseMetadata {
    requestId: string;
    timestamp: Date;
    modelVersion: string;
    cached?: boolean;
    rateLimit?: RateLimitInfo;
}
export interface RateLimitInfo {
    remaining: number;
    reset: Date;
    limit: number;
}
export interface ModelPerformanceMetrics {
    modelId: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    totalTokensProcessed: number;
    totalCost: number;
    uptime: number;
    lastUpdated: Date;
}
export interface UserConsentRecord {
    userId: string;
    modelId: string;
    consentGiven: boolean;
    consentDate: Date;
    consentVersion: string;
    dataUsageAcknowledged: boolean;
    ipAddress?: string;
    userAgent?: string;
}
export interface AnalyticsEvent {
    eventId: string;
    eventType: string;
    modelId: string;
    userId: string;
    sessionId: string;
    timestamp: Date;
    data: Record<string, any>;
    performanceMetrics?: UsageMetrics;
}
export interface AIModelProvider {
    name: string;
    config: AIModelConfig;
    initialize(): Promise<void>;
    generateResponse(request: AIModelRequest): Promise<AIModelResponse>;
    streamResponse?(request: AIModelRequest): AsyncIterable<string>;
    healthCheck(): Promise<boolean>;
    getStatus(): Promise<ProviderStatus>;
    getMetrics(): Promise<ModelPerformanceMetrics>;
    recordAnalytics(event: AnalyticsEvent): Promise<void>;
    checkConsent(userId: string): Promise<boolean>;
    recordConsent(consent: UserConsentRecord): Promise<void>;
    checkRateLimit(userId: string): Promise<RateLimitStatus>;
}
export interface ProviderStatus {
    operational: boolean;
    lastCheck: Date;
    responseTime: number;
    errorRate: number;
    currentLoad: number;
    message?: string;
}
export interface RateLimitStatus {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
}
export interface CloudServiceConfig {
    serviceName: string;
    endpoint: string;
    apiKey?: string;
    region?: string;
    environment: 'development' | 'staging' | 'production';
    features: CloudServiceFeatures;
}
export interface CloudServiceFeatures {
    analytics: boolean;
    monitoring: boolean;
    logging: boolean;
    caching: boolean;
    rateLimiting: boolean;
}
export interface CloudServiceResponse<T = any> {
    success: boolean;
    data?: T;
    error?: CloudServiceError;
    metadata: {
        requestId: string;
        timestamp: Date;
        service: string;
    };
}
export interface CloudServiceError {
    code: string;
    message: string;
    statusCode: number;
    retryable: boolean;
    details?: Record<string, any>;
}
