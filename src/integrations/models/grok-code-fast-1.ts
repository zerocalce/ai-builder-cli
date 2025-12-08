import { EventEmitter } from 'events';
import {
  AIModelProvider,
  AIModelConfig,
  AIModelRequest,
  AIModelResponse,
  ModelPerformanceMetrics,
  ProviderStatus,
  RateLimitStatus,
  UserConsentRecord,
  AnalyticsEvent,
  UsageMetrics
} from '../../types/ai-models';
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
export class GrokCodeFast1Provider extends EventEmitter implements AIModelProvider {
  public readonly name = 'grok-code-fast-1';
  public readonly config: AIModelConfig;
  
  private logger: Logger;
  private metrics: ModelPerformanceMetrics;
  private requestCount: number = 0;
  private rateLimitTracker: Map<string, RateLimitTracking> = new Map();
  private consentRecords: Map<string, UserConsentRecord> = new Map();
  private analyticsBuffer: AnalyticsEvent[] = [];
  private initialized: boolean = false;

  constructor(logger: Logger, config?: Partial<AIModelConfig>) {
    super();
    this.logger = logger;
    
    // Initialize model configuration
    this.config = {
      name: 'Grok Code Fast 1',
      provider: 'xAI',
      modelId: 'grok-code-fast-1',
      version: '1.0.0',
      description: 'High-performance reasoning model optimized for rapid agentic coding tasks',
      capabilities: {
        maxTokens: 32000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsCodeCompletion: true,
        supportsCodeGeneration: true,
        supportsCodeAnalysis: true,
        languages: [
          'typescript', 'javascript', 'python', 'java', 'go', 'rust',
          'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin', 'scala'
        ],
        specializations: [
          'agentic-coding',
          'rapid-prototyping',
          'code-refactoring',
          'bug-fixing',
          'code-review',
          'architectural-design'
        ]
      },
      pricing: {
        tier: 'free',
        requiresConsent: true,
        consentMessage: 'By using Grok Code Fast 1 during the promotional period, you acknowledge that all prompt interactions and completions will be recorded by xAI for model improvement purposes. This data helps us enhance the model\'s performance and capabilities.'
      },
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        tokensPerMinute: 100000,
        concurrentRequests: 10
      },
      endpoint: config?.endpoint || 'https://api.x.ai/v1/chat/completions',
      ...config
    };

    // Initialize metrics
    this.metrics = {
      modelId: this.config.modelId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      totalTokensProcessed: 0,
      totalCost: 0,
      uptime: 100,
      lastUpdated: new Date()
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('GrokCodeFast1Provider already initialized');
      return;
    }

    this.logger.info('Initializing Grok Code Fast 1 provider...');
    
    try {
      // Perform health check
      const healthy = await this.healthCheck();
      if (!healthy) {
        throw new Error('Health check failed during initialization');
      }

      this.initialized = true;
      this.logger.info('Grok Code Fast 1 provider initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Grok Code Fast 1 provider', error as Error);
      throw error;
    }
  }

  async generateResponse(request: AIModelRequest): Promise<AIModelResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Check user consent
      const userId = request.metadata?.userId || 'anonymous';
      const hasConsent = await this.checkConsent(userId);
      
      if (!hasConsent) {
        throw new Error('User consent required to use Grok Code Fast 1. Please acknowledge the data usage policy.');
      }

      // Check rate limits
      const rateLimitStatus = await this.checkRateLimit(userId);
      if (!rateLimitStatus.allowed) {
        throw new Error(`Rate limit exceeded. Please try again in ${rateLimitStatus.retryAfter} seconds.`);
      }

      // Build the prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(request);
      
      // Simulate API call to xAI Grok Code Fast 1
      // In production, this would make an actual HTTP request to the xAI API
      const response = await this.callGrokAPI(enhancedPrompt, request.options);
      
      const processingTime = Date.now() - startTime;

      // Calculate usage metrics
      const usage: UsageMetrics = {
        promptTokens: this.estimateTokens(enhancedPrompt),
        completionTokens: this.estimateTokens(response.content),
        totalTokens: this.estimateTokens(enhancedPrompt) + this.estimateTokens(response.content),
        processingTime,
        cost: 0 // Free tier
      };

      // Update metrics
      await this.updateMetrics(usage, processingTime, true);

      // Record analytics
      await this.recordAnalytics({
        eventId: requestId,
        eventType: 'completion',
        modelId: this.config.modelId,
        userId,
        sessionId: request.metadata?.sessionId || 'unknown',
        timestamp: new Date(),
        data: {
          prompt: request.prompt,
          response: response.content,
          context: request.context
        },
        performanceMetrics: usage
      });

      const aiResponse: AIModelResponse = {
        content: response.content,
        model: this.config.modelId,
        usage,
        metadata: {
          requestId,
          timestamp: new Date(),
          modelVersion: this.config.version,
          cached: false,
          rateLimit: {
            remaining: rateLimitStatus.remaining - 1,
            reset: rateLimitStatus.resetTime,
            limit: this.config.rateLimits.requestsPerMinute
          }
        },
        finishReason: 'stop'
      };

      this.emit('response', aiResponse);
      return aiResponse;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.updateMetrics({ promptTokens: 0, completionTokens: 0, totalTokens: 0, processingTime }, processingTime, false);
      
      this.logger.error('Failed to generate response from Grok Code Fast 1', error as Error);
      this.emit('error', error);
      
      throw error;
    }
  }

  async *streamResponse(request: AIModelRequest): AsyncIterable<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check consent and rate limits
    const userId = request.metadata?.userId || 'anonymous';
    const hasConsent = await this.checkConsent(userId);
    if (!hasConsent) {
      throw new Error('User consent required to use Grok Code Fast 1');
    }

    const rateLimitStatus = await this.checkRateLimit(userId);
    if (!rateLimitStatus.allowed) {
      throw new Error(`Rate limit exceeded`);
    }

    // Simulate streaming response
    const enhancedPrompt = this.buildEnhancedPrompt(request);
    const fullResponse = await this.callGrokAPI(enhancedPrompt, request.options);
    
    // Stream the response in chunks
    const words = fullResponse.content.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate streaming delay
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simulate health check
      // In production, this would ping the xAI API endpoint
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100));
      const responseTime = Date.now() - startTime;
      
      this.logger.debug(`Health check passed (${responseTime}ms)`);
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      return false;
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const healthy = await this.healthCheck();
    const errorRate = this.metrics.totalRequests > 0 
      ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
      : 0;

    return {
      operational: healthy,
      lastCheck: new Date(),
      responseTime: this.metrics.averageLatency,
      errorRate,
      currentLoad: this.rateLimitTracker.size,
      message: healthy ? 'Service operational' : 'Service experiencing issues'
    };
  }

  async getMetrics(): Promise<ModelPerformanceMetrics> {
    return {
      ...this.metrics,
      lastUpdated: new Date()
    };
  }

  async recordAnalytics(event: AnalyticsEvent): Promise<void> {
    this.analyticsBuffer.push(event);
    
    // Flush analytics buffer when it reaches a threshold
    if (this.analyticsBuffer.length >= 100) {
      await this.flushAnalytics();
    }
  }

  async checkConsent(userId: string): Promise<boolean> {
    const consent = this.consentRecords.get(userId);
    return consent ? consent.consentGiven && consent.dataUsageAcknowledged : false;
  }

  async recordConsent(consent: UserConsentRecord): Promise<void> {
    this.consentRecords.set(consent.userId, consent);
    this.logger.info(`Consent recorded for user ${consent.userId}`);
    
    await this.recordAnalytics({
      eventId: `consent_${Date.now()}`,
      eventType: 'consent_recorded',
      modelId: this.config.modelId,
      userId: consent.userId,
      sessionId: 'system',
      timestamp: new Date(),
      data: {
        consentGiven: consent.consentGiven,
        dataUsageAcknowledged: consent.dataUsageAcknowledged,
        consentVersion: consent.consentVersion
      }
    });
  }

  async checkRateLimit(userId: string): Promise<RateLimitStatus> {
    const now = Date.now();
    let tracking = this.rateLimitTracker.get(userId);
    
    if (!tracking) {
      tracking = {
        requests: [],
        tokens: 0,
        resetTime: new Date(now + 60000) // 1 minute from now
      };
      this.rateLimitTracker.set(userId, tracking);
    }

    // Clean up old requests (older than 1 minute)
    tracking.requests = tracking.requests.filter(time => now - time < 60000);

    // Check if rate limit is exceeded
    const requestsInLastMinute = tracking.requests.length;
    const allowed = requestsInLastMinute < this.config.rateLimits.requestsPerMinute;

    if (allowed) {
      tracking.requests.push(now);
    }

    return {
      allowed,
      remaining: Math.max(0, this.config.rateLimits.requestsPerMinute - requestsInLastMinute - 1),
      resetTime: tracking.resetTime,
      retryAfter: allowed ? undefined : Math.ceil((tracking.resetTime.getTime() - now) / 1000)
    };
  }

  private buildEnhancedPrompt(request: AIModelRequest): string {
    let prompt = request.prompt;

    // Add code context if available
    if (request.context?.codeContext) {
      const ctx = request.context.codeContext;
      prompt = `Language: ${ctx.language}\n${ctx.filePath ? `File: ${ctx.filePath}\n` : ''}${ctx.framework ? `Framework: ${ctx.framework}\n` : ''}\n\nCode:\n\`\`\`${ctx.language}\n${ctx.code}\n\`\`\`\n\n${prompt}`;
    }

    // Add project context if available
    if (request.context?.projectContext) {
      const proj = request.context.projectContext;
      prompt = `Project: ${proj.projectName} (${proj.template})\nTechnologies: ${proj.technologies.join(', ')}\n\n${prompt}`;
    }

    return prompt;
  }

  private async callGrokAPI(prompt: string, options?: any): Promise<{ content: string }> {
    // Simulate API call to xAI Grok Code Fast 1
    // In production, this would use fetch/axios to call the actual API
    
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300)); // Simulate network latency
    
    // Generate a simulated response optimized for coding tasks
    const response = this.generateCodeOptimizedResponse(prompt);
    
    return { content: response };
  }

  private generateCodeOptimizedResponse(prompt: string): string {
    // This is a simplified simulation. In production, the actual xAI API would be called.
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('function') || lowerPrompt.includes('implement')) {
      return `Based on your request, here's an optimized implementation:

\`\`\`typescript
export async function processData(input: string[]): Promise<string[]> {
  // Efficient implementation with proper error handling
  return input
    .filter(item => item && item.trim().length > 0)
    .map(item => item.trim().toLowerCase())
    .sort();
}
\`\`\`

This implementation is:
- Type-safe with TypeScript
- Handles edge cases (null/empty strings)
- Efficient with chained array operations
- Well-documented for maintainability`;
    }
    
    if (lowerPrompt.includes('debug') || lowerPrompt.includes('fix') || lowerPrompt.includes('error')) {
      return `I've analyzed the code and identified the issue. Here's the fix:

The problem is likely in the async handling. Here's the corrected version:

\`\`\`typescript
async function fetchData() {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}
\`\`\`

Key improvements:
- Added proper error handling
- Check response.ok before parsing
- Return data explicitly`;
    }
    
    return `I understand your coding request. As Grok Code Fast 1, I'm optimized for rapid, efficient code generation and analysis. 

Based on your prompt, here's my recommendation:

1. Break down the problem into smaller, testable components
2. Use modern language features for cleaner code
3. Implement proper error handling and logging
4. Add type safety where applicable
5. Consider performance implications

Would you like me to provide a specific implementation?`;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private async updateMetrics(usage: UsageMetrics, latency: number, success: boolean): Promise<void> {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.totalTokensProcessed += usage.totalTokens;
    
    // Update average latency
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency) / this.metrics.totalRequests;
    
    // Update P95/P99 (simplified - in production would use proper percentile calculation)
    this.metrics.p95Latency = Math.max(this.metrics.p95Latency, latency * 0.95);
    this.metrics.p99Latency = Math.max(this.metrics.p99Latency, latency * 0.99);
  }

  private async flushAnalytics(): Promise<void> {
    if (this.analyticsBuffer.length === 0) return;

    this.logger.debug(`Flushing ${this.analyticsBuffer.length} analytics events`);
    
    // In production, this would send events to the analytics service
    // For now, we just log and clear the buffer
    this.emit('analytics_flush', this.analyticsBuffer);
    this.analyticsBuffer = [];
  }

  private generateRequestId(): string {
    return `grok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getConsentMessage(): string {
    return this.config.pricing.consentMessage || '';
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Grok Code Fast 1 provider...');
    
    // Flush any pending analytics
    await this.flushAnalytics();
    
    // Clear rate limit tracking
    this.rateLimitTracker.clear();
    
    this.initialized = false;
    this.emit('shutdown');
  }
}

interface RateLimitTracking {
  requests: number[];
  tokens: number;
  resetTime: Date;
}
