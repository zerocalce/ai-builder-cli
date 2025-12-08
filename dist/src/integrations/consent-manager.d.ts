import { UserConsentRecord } from '../types/ai-models';
import { Logger } from '../types';
import { RooCodeCloudService } from './roo-code-cloud';
import { AnalyticsTracker } from './analytics-tracker';
/**
 * Consent Manager
 *
 * Manages user consent for AI model data usage with emphasis on transparency
 * and compliance with data protection regulations
 */
export declare class ConsentManager {
    private logger;
    private cloudService;
    private analyticsTracker;
    private consentCache;
    private consentVersion;
    constructor(logger: Logger, cloudService: RooCodeCloudService, analyticsTracker: AnalyticsTracker);
    /**
     * Request consent from user for a specific model
     */
    requestConsent(request: ConsentRequest): Promise<ConsentResponse>;
    /**
     * Record user consent
     */
    recordConsent(record: ConsentRecord): Promise<ConsentRecordResult>;
    /**
     * Check if user has given consent
     */
    hasConsent(userId: string, modelId: string): Promise<boolean>;
    /**
     * Get consent record
     */
    getConsent(userId: string, modelId: string): Promise<UserConsentRecord | null>;
    /**
     * Revoke consent
     */
    revokeConsent(userId: string, modelId: string): Promise<ConsentRevokeResult>;
    /**
     * Get consent history for a user
     */
    getConsentHistory(userId: string): Promise<UserConsentRecord[]>;
    /**
     * Validate consent is still valid
     */
    validateConsent(userId: string, modelId: string): Promise<ConsentValidation>;
    /**
     * Build consent prompt for a model
     */
    private buildConsentPrompt;
    private getCacheKey;
    /**
     * Clear consent cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): ConsentCacheStats;
}
export interface ConsentRequest {
    userId: string;
    modelId: string;
    modelDescription?: string;
}
export interface ConsentResponse {
    required: boolean;
    alreadyGiven: boolean;
    consentPrompt?: ConsentPrompt;
    consent?: UserConsentRecord;
    consentVersion?: string;
    message: string;
}
export interface ConsentPrompt {
    title: string;
    message: string;
    dataUsagePolicy: string;
    userRights: string;
    modelId: string;
    modelDescription?: string;
    consentVersion: string;
    actionRequired: string[];
}
export interface ConsentRecord {
    userId: string;
    modelId: string;
    consentGiven: boolean;
    dataUsageAcknowledged: boolean;
    ipAddress?: string;
    userAgent?: string;
}
export interface ConsentRecordResult {
    success: boolean;
    consent?: UserConsentRecord;
    message: string;
}
export interface ConsentRevokeResult {
    success: boolean;
    message: string;
}
export interface ConsentValidation {
    valid: boolean;
    reason?: string;
    requiresUpdate?: boolean;
    consent?: UserConsentRecord;
}
export interface ConsentCacheStats {
    totalRecords: number;
    consentedUsers: number;
    revokedUsers: number;
}
