import {
  AnalyticsEvent,
  ModelPerformanceMetrics,
  UserConsentRecord
} from '../types/ai-models';
import { Logger } from '../types';
import { RooCodeCloudService } from './roo-code-cloud';

/**
 * Analytics Tracker
 * 
 * Handles performance tracking, analytics collection, and reporting
 * for AI model usage with emphasis on transparency and user consent
 */
export class AnalyticsTracker {
  private logger: Logger;
  private cloudService: RooCodeCloudService;
  private events: AnalyticsEvent[] = [];
  private metricsHistory: Map<string, ModelPerformanceMetrics[]> = new Map();
  private performanceBuffer: PerformanceDataPoint[] = [];

  constructor(logger: Logger, cloudService: RooCodeCloudService) {
    this.logger = logger;
    this.cloudService = cloudService;
  }

  /**
   * Track a model request
   */
  async trackRequest(data: RequestTrackingData): Promise<void> {
    const event: AnalyticsEvent = {
      eventId: this.generateEventId(),
      eventType: 'model_request',
      modelId: data.modelId,
      userId: data.userId,
      sessionId: data.sessionId,
      timestamp: new Date(),
      data: {
        promptLength: data.promptLength,
        hasContext: data.hasContext,
        options: data.options
      },
      performanceMetrics: data.performanceMetrics
    };

    this.events.push(event);
    await this.cloudService.submitAnalytics(event);
    
    this.logger.debug(`Tracked request for model ${data.modelId}`);
  }

  /**
   * Track a model response
   */
  async trackResponse(data: ResponseTrackingData): Promise<void> {
    const event: AnalyticsEvent = {
      eventId: this.generateEventId(),
      eventType: 'model_response',
      modelId: data.modelId,
      userId: data.userId,
      sessionId: data.sessionId,
      timestamp: new Date(),
      data: {
        responseLength: data.responseLength,
        finishReason: data.finishReason,
        cached: data.cached
      },
      performanceMetrics: data.performanceMetrics
    };

    this.events.push(event);
    await this.cloudService.submitAnalytics(event);

    // Track performance data
    this.performanceBuffer.push({
      modelId: data.modelId,
      latency: data.performanceMetrics.processingTime,
      tokens: data.performanceMetrics.totalTokens,
      success: data.finishReason === 'stop',
      timestamp: new Date()
    });

    this.logger.debug(`Tracked response for model ${data.modelId}`);
  }

  /**
   * Track an error
   */
  async trackError(data: ErrorTrackingData): Promise<void> {
    const event: AnalyticsEvent = {
      eventId: this.generateEventId(),
      eventType: 'model_error',
      modelId: data.modelId,
      userId: data.userId,
      sessionId: data.sessionId,
      timestamp: new Date(),
      data: {
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        errorType: data.errorType,
        retryable: data.retryable
      }
    };

    this.events.push(event);
    await this.cloudService.submitAnalytics(event);
    
    this.logger.error(`Tracked error for model ${data.modelId}: ${data.errorMessage}`);
  }

  /**
   * Track consent acceptance
   */
  async trackConsent(consent: UserConsentRecord): Promise<void> {
    const event: AnalyticsEvent = {
      eventId: this.generateEventId(),
      eventType: 'consent_event',
      modelId: consent.modelId,
      userId: consent.userId,
      sessionId: 'system',
      timestamp: new Date(),
      data: {
        consentGiven: consent.consentGiven,
        dataUsageAcknowledged: consent.dataUsageAcknowledged,
        consentVersion: consent.consentVersion,
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent
      }
    };

    this.events.push(event);
    await this.cloudService.submitAnalytics(event);
    await this.cloudService.recordConsent(consent);
    
    this.logger.info(`Tracked consent for user ${consent.userId}, model ${consent.modelId}`);
  }

  /**
   * Generate performance report for a model
   */
  async generatePerformanceReport(modelId: string): Promise<PerformanceReport> {
    const dataPoints = this.performanceBuffer.filter(dp => dp.modelId === modelId);
    
    if (dataPoints.length === 0) {
      return this.getEmptyReport(modelId);
    }

    const latencies = dataPoints.map(dp => dp.latency).sort((a, b) => a - b);
    const successCount = dataPoints.filter(dp => dp.success).length;
    const totalTokens = dataPoints.reduce((sum, dp) => sum + dp.tokens, 0);

    const report: PerformanceReport = {
      modelId,
      period: {
        start: dataPoints[0].timestamp,
        end: dataPoints[dataPoints.length - 1].timestamp
      },
      totalRequests: dataPoints.length,
      successfulRequests: successCount,
      failedRequests: dataPoints.length - successCount,
      successRate: (successCount / dataPoints.length) * 100,
      latency: {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        mean: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
        median: latencies[Math.floor(latencies.length / 2)],
        p95: latencies[Math.floor(latencies.length * 0.95)],
        p99: latencies[Math.floor(latencies.length * 0.99)]
      },
      tokens: {
        total: totalTokens,
        average: totalTokens / dataPoints.length
      },
      generated: new Date()
    };

    // Store in history
    const history = this.metricsHistory.get(modelId) || [];
    history.push(this.reportToMetrics(report));
    this.metricsHistory.set(modelId, history);

    return report;
  }

  /**
   * Get aggregated analytics for a time period
   */
  async getAnalytics(filter: AnalyticsFilter): Promise<AnalyticsReport> {
    const filteredEvents = this.filterEvents(filter);

    const byType = this.groupBy(filteredEvents, 'eventType');
    const byModel = this.groupBy(filteredEvents, 'modelId');
    const byUser = this.groupBy(filteredEvents, 'userId');

    return {
      period: filter.period,
      totalEvents: filteredEvents.length,
      eventsByType: Object.entries(byType).map(([type, events]) => ({
        type,
        count: events.length
      })),
      eventsByModel: Object.entries(byModel).map(([modelId, events]) => ({
        modelId,
        count: events.length
      })),
      uniqueUsers: Object.keys(byUser).length,
      generated: new Date()
    };
  }

  /**
   * Export analytics data for compliance/auditing
   */
  async exportAnalytics(filter: AnalyticsFilter): Promise<AnalyticsExport> {
    const filteredEvents = this.filterEvents(filter);

    return {
      exportId: this.generateEventId(),
      filter,
      events: filteredEvents,
      metadata: {
        totalEvents: filteredEvents.length,
        exportedAt: new Date(),
        exportedBy: 'system',
        format: 'json',
        version: '1.0'
      }
    };
  }

  /**
   * Clear analytics data (for privacy compliance)
   */
  async clearAnalytics(filter: AnalyticsFilter): Promise<number> {
    const before = this.events.length;
    this.events = this.events.filter(event => !this.matchesFilter(event, filter));
    const removed = before - this.events.length;

    this.logger.info(`Cleared ${removed} analytics events`);
    return removed;
  }

  /**
   * Get consent status for a user and model
   */
  async getConsentStatus(userId: string, modelId: string): Promise<UserConsentRecord | null> {
    const response = await this.cloudService.getConsentStatus(userId, modelId);
    return response.success && response.data ? response.data : null;
  }

  private filterEvents(filter: AnalyticsFilter): AnalyticsEvent[] {
    return this.events.filter(event => this.matchesFilter(event, filter));
  }

  private matchesFilter(event: AnalyticsEvent, filter: AnalyticsFilter): boolean {
    if (filter.modelId && event.modelId !== filter.modelId) return false;
    if (filter.userId && event.userId !== filter.userId) return false;
    if (filter.eventType && event.eventType !== filter.eventType) return false;
    if (filter.period) {
      const eventTime = event.timestamp.getTime();
      if (filter.period.start && eventTime < filter.period.start.getTime()) return false;
      if (filter.period.end && eventTime > filter.period.end.getTime()) return false;
    }
    return true;
  }

  private groupBy<T extends Record<string, any>>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private reportToMetrics(report: PerformanceReport): ModelPerformanceMetrics {
    return {
      modelId: report.modelId,
      totalRequests: report.totalRequests,
      successfulRequests: report.successfulRequests,
      failedRequests: report.failedRequests,
      averageLatency: report.latency.mean,
      p95Latency: report.latency.p95,
      p99Latency: report.latency.p99,
      totalTokensProcessed: report.tokens.total,
      totalCost: 0,
      uptime: report.successRate,
      lastUpdated: report.generated
    };
  }

  private getEmptyReport(modelId: string): PerformanceReport {
    return {
      modelId,
      period: { start: new Date(), end: new Date() },
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      latency: {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0
      },
      tokens: {
        total: 0,
        average: 0
      },
      generated: new Date()
    };
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getEventCount(): number {
    return this.events.length;
  }

  getPerformanceDataPointCount(): number {
    return this.performanceBuffer.length;
  }
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
  eventsByType: Array<{ type: string; count: number }>;
  eventsByModel: Array<{ modelId: string; count: number }>;
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
