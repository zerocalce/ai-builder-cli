"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentManager = void 0;
/**
 * Consent Manager
 *
 * Manages user consent for AI model data usage with emphasis on transparency
 * and compliance with data protection regulations
 */
class ConsentManager {
    constructor(logger, cloudService, analyticsTracker) {
        this.consentCache = new Map();
        this.consentVersion = '1.0.0';
        this.logger = logger;
        this.cloudService = cloudService;
        this.analyticsTracker = analyticsTracker;
    }
    /**
     * Request consent from user for a specific model
     */
    async requestConsent(request) {
        this.logger.info(`Requesting consent for user ${request.userId}, model ${request.modelId}`);
        // Check if consent already exists
        const existingConsent = await this.getConsent(request.userId, request.modelId);
        if (existingConsent) {
            return {
                required: false,
                alreadyGiven: true,
                consent: existingConsent,
                message: 'Consent already granted'
            };
        }
        // Build consent prompt
        const consentPrompt = this.buildConsentPrompt(request.modelId, request.modelDescription);
        return {
            required: true,
            alreadyGiven: false,
            consentPrompt,
            consentVersion: this.consentVersion,
            message: 'User consent required to proceed'
        };
    }
    /**
     * Record user consent
     */
    async recordConsent(record) {
        this.logger.info(`Recording consent for user ${record.userId}, model ${record.modelId}`);
        const consentRecord = {
            userId: record.userId,
            modelId: record.modelId,
            consentGiven: record.consentGiven,
            consentDate: new Date(),
            consentVersion: this.consentVersion,
            dataUsageAcknowledged: record.dataUsageAcknowledged,
            ipAddress: record.ipAddress,
            userAgent: record.userAgent
        };
        // Store in cache
        const cacheKey = this.getCacheKey(record.userId, record.modelId);
        this.consentCache.set(cacheKey, consentRecord);
        // Submit to cloud service
        try {
            await this.cloudService.recordConsent(consentRecord);
            await this.analyticsTracker.trackConsent(consentRecord);
            return {
                success: true,
                consent: consentRecord,
                message: 'Consent recorded successfully'
            };
        }
        catch (error) {
            this.logger.error('Failed to record consent', error);
            return {
                success: false,
                message: 'Failed to record consent'
            };
        }
    }
    /**
     * Check if user has given consent
     */
    async hasConsent(userId, modelId) {
        const consent = await this.getConsent(userId, modelId);
        return consent ? consent.consentGiven && consent.dataUsageAcknowledged : false;
    }
    /**
     * Get consent record
     */
    async getConsent(userId, modelId) {
        // Check cache first
        const cacheKey = this.getCacheKey(userId, modelId);
        const cached = this.consentCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        // Fetch from cloud service
        try {
            const response = await this.cloudService.getConsentStatus(userId, modelId);
            if (response.success && response.data) {
                this.consentCache.set(cacheKey, response.data);
                return response.data;
            }
        }
        catch (error) {
            this.logger.debug(`No consent found for user ${userId}, model ${modelId}`);
        }
        return null;
    }
    /**
     * Revoke consent
     */
    async revokeConsent(userId, modelId) {
        this.logger.info(`Revoking consent for user ${userId}, model ${modelId}`);
        const consentRecord = {
            userId,
            modelId,
            consentGiven: false,
            consentDate: new Date(),
            consentVersion: this.consentVersion,
            dataUsageAcknowledged: false
        };
        // Update cache
        const cacheKey = this.getCacheKey(userId, modelId);
        this.consentCache.set(cacheKey, consentRecord);
        // Submit revocation
        try {
            await this.cloudService.recordConsent(consentRecord);
            await this.analyticsTracker.trackConsent(consentRecord);
            return {
                success: true,
                message: 'Consent revoked successfully'
            };
        }
        catch (error) {
            this.logger.error('Failed to revoke consent', error);
            return {
                success: false,
                message: 'Failed to revoke consent'
            };
        }
    }
    /**
     * Get consent history for a user
     */
    async getConsentHistory(userId) {
        const history = [];
        for (const [key, record] of this.consentCache.entries()) {
            if (record.userId === userId) {
                history.push(record);
            }
        }
        return history.sort((a, b) => b.consentDate.getTime() - a.consentDate.getTime());
    }
    /**
     * Validate consent is still valid
     */
    async validateConsent(userId, modelId) {
        const consent = await this.getConsent(userId, modelId);
        if (!consent) {
            return {
                valid: false,
                reason: 'No consent record found'
            };
        }
        if (!consent.consentGiven) {
            return {
                valid: false,
                reason: 'Consent not given'
            };
        }
        if (!consent.dataUsageAcknowledged) {
            return {
                valid: false,
                reason: 'Data usage not acknowledged'
            };
        }
        // Check if consent version matches
        if (consent.consentVersion !== this.consentVersion) {
            return {
                valid: false,
                reason: 'Consent version outdated',
                requiresUpdate: true
            };
        }
        return {
            valid: true,
            consent
        };
    }
    /**
     * Build consent prompt for a model
     */
    buildConsentPrompt(modelId, modelDescription) {
        const baseMessage = `This feature uses the ${modelId} AI model provided by xAI.`;
        const dataUsageMessage = `During the promotional free tier period, all prompt interactions and completions will be recorded by xAI for model improvement purposes. This includes:
- Your prompts and questions
- The model's responses
- Performance metrics (response time, token usage)
- Context information (code snippets, project details)

This data helps improve the model's accuracy, performance, and capabilities.`;
        const rightsMessage = `Your rights:
- You can revoke consent at any time
- Data is used solely for model improvement
- No personal identifying information is stored beyond what you provide in prompts
- Data retention follows xAI's privacy policy`;
        return {
            title: 'AI Model Data Usage Consent',
            message: baseMessage,
            dataUsagePolicy: dataUsageMessage,
            userRights: rightsMessage,
            modelId,
            modelDescription,
            consentVersion: this.consentVersion,
            actionRequired: [
                'I understand and consent to my interactions being recorded for model improvement',
                'I acknowledge the data usage policy'
            ]
        };
    }
    getCacheKey(userId, modelId) {
        return `${userId}:${modelId}`;
    }
    /**
     * Clear consent cache
     */
    clearCache() {
        this.consentCache.clear();
        this.logger.debug('Consent cache cleared');
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = {
            totalRecords: this.consentCache.size,
            consentedUsers: 0,
            revokedUsers: 0
        };
        for (const record of this.consentCache.values()) {
            if (record.consentGiven) {
                stats.consentedUsers++;
            }
            else {
                stats.revokedUsers++;
            }
        }
        return stats;
    }
}
exports.ConsentManager = ConsentManager;
