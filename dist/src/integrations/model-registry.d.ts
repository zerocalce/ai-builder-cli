import { AIModelProvider, AIModelConfig } from '../types/ai-models';
import { Logger } from '../types';
import { RooCodeCloudService } from './roo-code-cloud';
import { AnalyticsTracker } from './analytics-tracker';
import { ConsentManager } from './consent-manager';
/**
 * Model Registry
 *
 * Central registry for managing all AI model providers
 */
export declare class ModelRegistry {
    private logger;
    private cloudService;
    private analyticsTracker;
    private consentManager;
    private providers;
    private defaultModelId;
    constructor(logger: Logger);
    /**
     * Initialize the registry and all providers
     */
    initialize(): Promise<void>;
    /**
     * Register built-in AI models
     */
    private registerBuiltInModels;
    /**
     * Register a new AI model provider
     */
    registerProvider(provider: AIModelProvider): Promise<void>;
    /**
     * Get a provider by model ID
     */
    getProvider(modelId?: string): AIModelProvider | undefined;
    /**
     * Get all registered providers
     */
    getAllProviders(): AIModelProvider[];
    /**
     * Get all model configurations
     */
    getAllModelConfigs(): AIModelConfig[];
    /**
     * Check if a model is available
     */
    hasModel(modelId: string): boolean;
    /**
     * Set default model
     */
    setDefaultModel(modelId: string): void;
    /**
     * Get default model ID
     */
    getDefaultModelId(): string;
    /**
     * Get analytics tracker
     */
    getAnalyticsTracker(): AnalyticsTracker;
    /**
     * Get consent manager
     */
    getConsentManager(): ConsentManager;
    /**
     * Get cloud service
     */
    getCloudService(): RooCodeCloudService;
    /**
     * Get registry statistics
     */
    getStats(): RegistryStats;
    /**
     * Shutdown all providers and services
     */
    shutdown(): Promise<void>;
}
export interface RegistryStats {
    totalProviders: number;
    defaultModel: string;
    providers: string[];
    cloudConnected: boolean;
}
