"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRegistry = void 0;
const grok_code_fast_1_1 = require("./models/grok-code-fast-1");
const roo_code_cloud_1 = require("./roo-code-cloud");
const analytics_tracker_1 = require("./analytics-tracker");
const consent_manager_1 = require("./consent-manager");
/**
 * Model Registry
 *
 * Central registry for managing all AI model providers
 */
class ModelRegistry {
    constructor(logger) {
        this.providers = new Map();
        this.defaultModelId = 'grok-code-fast-1';
        this.logger = logger;
        // Initialize services
        this.cloudService = new roo_code_cloud_1.RooCodeCloudService(logger);
        this.analyticsTracker = new analytics_tracker_1.AnalyticsTracker(logger, this.cloudService);
        this.consentManager = new consent_manager_1.ConsentManager(logger, this.cloudService, this.analyticsTracker);
    }
    /**
     * Initialize the registry and all providers
     */
    async initialize() {
        this.logger.info('Initializing Model Registry...');
        try {
            // Connect to cloud service
            await this.cloudService.connect();
            // Register built-in models
            await this.registerBuiltInModels();
            this.logger.info(`Model Registry initialized with ${this.providers.size} providers`);
        }
        catch (error) {
            this.logger.error('Failed to initialize Model Registry', error);
            throw error;
        }
    }
    /**
     * Register built-in AI models
     */
    async registerBuiltInModels() {
        // Register Grok Code Fast 1
        const grokProvider = new grok_code_fast_1_1.GrokCodeFast1Provider(this.logger);
        await this.registerProvider(grokProvider);
    }
    /**
     * Register a new AI model provider
     */
    async registerProvider(provider) {
        this.logger.info(`Registering provider: ${provider.name}`);
        try {
            await provider.initialize();
            this.providers.set(provider.config.modelId, provider);
            this.logger.info(`Provider registered: ${provider.name} (${provider.config.modelId})`);
        }
        catch (error) {
            this.logger.error(`Failed to register provider ${provider.name}`, error);
            throw error;
        }
    }
    /**
     * Get a provider by model ID
     */
    getProvider(modelId) {
        const id = modelId || this.defaultModelId;
        return this.providers.get(id);
    }
    /**
     * Get all registered providers
     */
    getAllProviders() {
        return Array.from(this.providers.values());
    }
    /**
     * Get all model configurations
     */
    getAllModelConfigs() {
        return this.getAllProviders().map(provider => provider.config);
    }
    /**
     * Check if a model is available
     */
    hasModel(modelId) {
        return this.providers.has(modelId);
    }
    /**
     * Set default model
     */
    setDefaultModel(modelId) {
        if (!this.hasModel(modelId)) {
            throw new Error(`Model ${modelId} is not registered`);
        }
        this.defaultModelId = modelId;
        this.logger.info(`Default model set to: ${modelId}`);
    }
    /**
     * Get default model ID
     */
    getDefaultModelId() {
        return this.defaultModelId;
    }
    /**
     * Get analytics tracker
     */
    getAnalyticsTracker() {
        return this.analyticsTracker;
    }
    /**
     * Get consent manager
     */
    getConsentManager() {
        return this.consentManager;
    }
    /**
     * Get cloud service
     */
    getCloudService() {
        return this.cloudService;
    }
    /**
     * Get registry statistics
     */
    getStats() {
        return {
            totalProviders: this.providers.size,
            defaultModel: this.defaultModelId,
            providers: Array.from(this.providers.keys()),
            cloudConnected: this.cloudService.isConnected()
        };
    }
    /**
     * Shutdown all providers and services
     */
    async shutdown() {
        this.logger.info('Shutting down Model Registry...');
        // Shutdown all providers
        for (const [id, provider] of this.providers.entries()) {
            try {
                if (typeof provider.shutdown === 'function') {
                    await provider.shutdown();
                }
                this.logger.debug(`Provider ${id} shut down`);
            }
            catch (error) {
                this.logger.error(`Error shutting down provider ${id}`, error);
            }
        }
        // Disconnect cloud service
        await this.cloudService.disconnect();
        this.providers.clear();
        this.logger.info('Model Registry shut down');
    }
}
exports.ModelRegistry = ModelRegistry;
