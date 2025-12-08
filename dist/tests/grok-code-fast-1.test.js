"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const grok_code_fast_1_1 = require("../src/integrations/models/grok-code-fast-1");
describe('GrokCodeFast1Provider', () => {
    let provider;
    let mockLogger;
    beforeEach(() => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        provider = new grok_code_fast_1_1.GrokCodeFast1Provider(mockLogger);
    });
    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await expect(provider.initialize()).resolves.not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Initializing'));
        });
        it('should have correct configuration', () => {
            expect(provider.config.modelId).toBe('grok-code-fast-1');
            expect(provider.config.provider).toBe('xAI');
            expect(provider.config.name).toBe('Grok Code Fast 1');
        });
        it('should have free tier pricing', () => {
            expect(provider.config.pricing.tier).toBe('free');
            expect(provider.config.pricing.requiresConsent).toBe(true);
        });
        it('should support code capabilities', () => {
            expect(provider.config.capabilities.supportsCodeGeneration).toBe(true);
            expect(provider.config.capabilities.supportsCodeCompletion).toBe(true);
            expect(provider.config.capabilities.supportsCodeAnalysis).toBe(true);
        });
    });
    describe('consent management', () => {
        it('should require consent before generating responses', async () => {
            await provider.initialize();
            const request = {
                prompt: 'Generate a function',
                metadata: { userId: 'test-user' }
            };
            await expect(provider.generateResponse(request)).rejects.toThrow('consent required');
        });
        it('should record consent correctly', async () => {
            await provider.initialize();
            const consent = {
                userId: 'test-user',
                modelId: 'grok-code-fast-1',
                consentGiven: true,
                consentDate: new Date(),
                consentVersion: '1.0.0',
                dataUsageAcknowledged: true
            };
            await provider.recordConsent(consent);
            const hasConsent = await provider.checkConsent('test-user');
            expect(hasConsent).toBe(true);
        });
        it('should get consent message', () => {
            const message = provider.getConsentMessage();
            expect(message).toContain('xAI');
            expect(message).toContain('recorded');
            expect(message).toContain('model improvement');
        });
    });
    describe('response generation', () => {
        beforeEach(async () => {
            await provider.initialize();
            // Grant consent for tests
            await provider.recordConsent({
                userId: 'test-user',
                modelId: 'grok-code-fast-1',
                consentGiven: true,
                consentDate: new Date(),
                consentVersion: '1.0.0',
                dataUsageAcknowledged: true
            });
        });
        it('should generate response for code request', async () => {
            const request = {
                prompt: 'Create a TypeScript function to sort an array',
                metadata: { userId: 'test-user', sessionId: 'session-1' }
            };
            const response = await provider.generateResponse(request);
            expect(response).toBeDefined();
            expect(response.content).toBeTruthy();
            expect(response.model).toBe('grok-code-fast-1');
            expect(response.usage).toBeDefined();
            expect(response.usage.totalTokens).toBeGreaterThan(0);
        });
        it('should include usage metrics', async () => {
            const request = {
                prompt: 'Write a function',
                metadata: { userId: 'test-user' }
            };
            const response = await provider.generateResponse(request);
            expect(response.usage.promptTokens).toBeGreaterThan(0);
            expect(response.usage.completionTokens).toBeGreaterThan(0);
            expect(response.usage.processingTime).toBeGreaterThan(0);
            expect(response.usage.cost).toBe(0); // Free tier
        });
        it('should handle context in requests', async () => {
            const request = {
                prompt: 'Improve this code',
                context: {
                    codeContext: {
                        language: 'typescript',
                        code: 'const x = 1;',
                        filePath: 'test.ts'
                    }
                },
                metadata: { userId: 'test-user' }
            };
            const response = await provider.generateResponse(request);
            expect(response).toBeDefined();
            expect(response.finishReason).toBe('stop');
        });
    });
    describe('rate limiting', () => {
        beforeEach(async () => {
            await provider.initialize();
            await provider.recordConsent({
                userId: 'test-user',
                modelId: 'grok-code-fast-1',
                consentGiven: true,
                consentDate: new Date(),
                consentVersion: '1.0.0',
                dataUsageAcknowledged: true
            });
        });
        it('should check rate limits', async () => {
            const status = await provider.checkRateLimit('test-user');
            expect(status.allowed).toBe(true);
            expect(status.remaining).toBeLessThanOrEqual(60);
        });
        it('should track rate limit usage', async () => {
            const status1 = await provider.checkRateLimit('test-user');
            const remaining1 = status1.remaining;
            const status2 = await provider.checkRateLimit('test-user');
            const remaining2 = status2.remaining;
            expect(remaining2).toBeLessThan(remaining1);
        });
    });
    describe('metrics and analytics', () => {
        beforeEach(async () => {
            await provider.initialize();
        });
        it('should track performance metrics', async () => {
            const metrics = await provider.getMetrics();
            expect(metrics.modelId).toBe('grok-code-fast-1');
            expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
            expect(metrics.totalCost).toBe(0); // Free tier
        });
        it('should update metrics on successful request', async () => {
            await provider.recordConsent({
                userId: 'test-user',
                modelId: 'grok-code-fast-1',
                consentGiven: true,
                consentDate: new Date(),
                consentVersion: '1.0.0',
                dataUsageAcknowledged: true
            });
            const metricsBefore = await provider.getMetrics();
            await provider.generateResponse({
                prompt: 'test',
                metadata: { userId: 'test-user' }
            });
            const metricsAfter = await provider.getMetrics();
            expect(metricsAfter.totalRequests).toBeGreaterThan(metricsBefore.totalRequests);
        });
    });
    describe('health checks', () => {
        it('should perform health check', async () => {
            const healthy = await provider.healthCheck();
            expect(typeof healthy).toBe('boolean');
        });
        it('should get status', async () => {
            await provider.initialize();
            const status = await provider.getStatus();
            expect(status).toBeDefined();
            expect(status.operational).toBeDefined();
            expect(status.responseTime).toBeGreaterThanOrEqual(0);
            expect(status.errorRate).toBeGreaterThanOrEqual(0);
        });
    });
    describe('shutdown', () => {
        it('should shutdown gracefully', async () => {
            await provider.initialize();
            await expect(provider.shutdown()).resolves.not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Shutting down'));
        });
    });
});
