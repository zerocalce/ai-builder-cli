"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentPipeline = exports.DeploymentEngineImpl = void 0;
const events_1 = require("events");
const path = __importStar(require("path"));
const deployment_store_1 = require("./deployment-store");
const types_1 = require("../types");
class DeploymentEngineImpl extends events_1.EventEmitter {
    constructor(logger, store) {
        var _a;
        super();
        this.activeDeployments = new Map();
        this.cloudProviders = new Map();
        this.logger = logger;
        // Default: try SQLite-backed store (faster, transactional). Fall back to file store if SQLite not available.
        if (store) {
            this.store = store;
        }
        else {
            try {
                const dbPath = path.join(process.cwd(), '.ai-builder', 'deployments.db');
                this.store = new deployment_store_1.SQLiteDeploymentStore(dbPath, logger);
            }
            catch (err) {
                // fallback to file store
                (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn('SQLite store not available, falling back to file-backed store');
                this.store = new deployment_store_1.FileDeploymentStore(path.join(process.cwd(), '.ai-builder', 'deployments'), logger);
            }
        }
        this.initializeCloudProviders();
    }
    // Expose persisted store helpers
    async listPersistedDeployments(projectId) {
        return this.store.listDeployments(projectId);
    }
    async getPersistedDeployment(id) {
        return this.store.getDeployment(id);
    }
    initializeCloudProviders() {
        // Register cloud providers (would be implemented as separate classes)
        // For now, we'll register mock providers
        this.cloudProviders.set('local', new LocalProvider(this.logger));
        this.cloudProviders.set('docker', new DockerProvider(this.logger));
        this.cloudProviders.set('aws', new AWSProvider(this.logger));
        this.cloudProviders.set('ssh', new SSHProvider(this.logger));
    }
    async deploy(project, target) {
        this.logger.info(`Starting deployment of project '${project.name}' to target '${target.name}'`);
        const deployment = {
            id: this.generateDeploymentId(),
            projectId: project.id,
            target,
            version: project.version,
            status: types_1.DeploymentStatus.PENDING,
            logs: [],
            createdAt: new Date()
        };
        this.activeDeployments.set(deployment.id, deployment);
        // Persist initial deployment record
        await this.store.saveDeployment(deployment);
        this.emit('deploymentStarted', deployment);
        try {
            // Build project first
            await this.updateDeploymentStatus(deployment, types_1.DeploymentStatus.BUILDING);
            await this.addDeploymentLog(deployment, 'info', 'Starting build process', 'build-engine');
            const buildResult = await this.buildProject(project);
            if (!buildResult.success) {
                throw new Error(`Build failed: ${buildResult.error}`);
            }
            deployment.buildResult = buildResult;
            await this.addDeploymentLog(deployment, 'info', 'Build completed successfully', 'build-engine');
            await this.store.saveDeployment(deployment);
            // Deploy to target
            await this.updateDeploymentStatus(deployment, types_1.DeploymentStatus.DEPLOYING);
            await this.addDeploymentLog(deployment, 'info', `Starting deployment to ${target.name}`, 'deployment-engine');
            const deploymentConfig = {
                project,
                target,
                buildResult,
                environment: this.mergeEnvironmentVariables(project, target)
            };
            const provider = this.cloudProviders.get(target.type);
            if (!provider) {
                throw new Error(`No provider found for target type: ${target.type}`);
            }
            const result = await provider.deploy(deploymentConfig);
            if (!result.success) {
                throw new Error(`Deployment failed: ${result.error}`);
            }
            // Update deployment with result
            deployment.status = types_1.DeploymentStatus.SUCCESS;
            deployment.completedAt = new Date();
            await this.addDeploymentLog(deployment, 'info', 'Deployment completed successfully', 'deployment-engine');
            await this.addDeploymentLog(deployment, 'info', `Deployment URL: ${result.url || 'N/A'}`, 'deployment-engine');
            // Persist final state
            await this.store.saveDeployment(deployment);
            this.emit('deploymentCompleted', deployment);
            this.logger.info(`Deployment '${deployment.id}' completed successfully`);
            return deployment;
        }
        catch (error) {
            deployment.status = types_1.DeploymentStatus.FAILED;
            deployment.completedAt = new Date();
            await this.addDeploymentLog(deployment, 'error', error.message, 'deployment-engine');
            await this.store.saveDeployment(deployment);
            this.emit('deploymentFailed', deployment, error);
            this.logger.error(`Deployment '${deployment.id}' failed: ${error}`);
            throw error;
        }
        finally {
            this.activeDeployments.delete(deployment.id);
            // ensure last state persisted
            try {
                await this.store.saveDeployment(deployment);
            }
            catch (err) { /* swallow */ }
        }
    }
    async rollback(deployment, version) {
        this.logger.info(`Starting rollback of deployment '${deployment.id}' to version '${version}'`);
        try {
            await this.updateDeploymentStatus(deployment, types_1.DeploymentStatus.ROLLING_BACK);
            await this.addDeploymentLog(deployment, 'info', `Starting rollback to version ${version}`, 'rollback-engine');
            const provider = this.cloudProviders.get(deployment.target.type);
            if (!provider) {
                throw new Error(`No provider found for target type: ${deployment.target.type}`);
            }
            await provider.rollback(deployment.id, version);
            deployment.status = types_1.DeploymentStatus.ROLLED_BACK;
            deployment.rollbackFrom = deployment.version;
            deployment.version = version;
            await this.addDeploymentLog(deployment, 'info', `Rollback to version ${version} completed successfully`, 'rollback-engine');
            // Persist rollback state
            await this.store.saveDeployment(deployment);
            this.emit('rollbackCompleted', deployment);
            this.logger.info(`Rollback of deployment '${deployment.id}' completed successfully`);
        }
        catch (error) {
            await this.addDeploymentLog(deployment, 'error', `Rollback failed: ${error.message}`, 'rollback-engine');
            await this.store.saveDeployment(deployment);
            this.emit('rollbackFailed', deployment, error);
            this.logger.error(`Rollback of deployment '${deployment.id}' failed: ${error}`);
            throw error;
        }
    }
    async getStatus(deployment) {
        const provider = this.cloudProviders.get(deployment.target.type);
        if (!provider) {
            throw new Error(`No provider found for target type: ${deployment.target.type}`);
        }
        try {
            const remoteStatus = await provider.getStatus(deployment.id);
            // Update local status if different
            if (remoteStatus !== deployment.status) {
                await this.updateDeploymentStatus(deployment, remoteStatus);
            }
            return deployment.status;
        }
        catch (error) {
            this.logger.warn(`Failed to get remote status for deployment '${deployment.id}': ${error}`);
            return deployment.status;
        }
    }
    async getLogs(deployment) {
        // If we have persisted logs, prefer them
        try {
            const stored = await this.store.getDeployment(deployment.id);
            if (stored && stored.logs && stored.logs.length)
                return stored.logs;
        }
        catch (err) {
            // ignore
        }
        return deployment.logs;
    }
    async cancelDeployment(deployment) {
        this.logger.info(`Cancelling deployment '${deployment.id}'`);
        if (deployment.status === types_1.DeploymentStatus.SUCCESS ||
            deployment.status === types_1.DeploymentStatus.FAILED ||
            deployment.status === types_1.DeploymentStatus.ROLLED_BACK) {
            throw new Error(`Cannot cancel deployment in '${deployment.status}' state`);
        }
        deployment.status = types_1.DeploymentStatus.FAILED;
        deployment.completedAt = new Date();
        await this.addDeploymentLog(deployment, 'info', 'Deployment cancelled by user', 'deployment-engine');
        this.emit('deploymentCancelled', deployment);
        this.activeDeployments.delete(deployment.id);
    }
    async buildProject(project) {
        // This would integrate with the ProjectManager
        // For now, return a mock build result
        return {
            success: true,
            output: 'Build completed successfully',
            artifacts: [
                {
                    path: 'dist/index.js',
                    size: 1024,
                    hash: 'abc123',
                    type: 'file'
                }
            ],
            duration: 1500
        };
    }
    mergeEnvironmentVariables(project, target) {
        var _a;
        const baseEnv = ((_a = project.config.environment) === null || _a === void 0 ? void 0 : _a.variables) || {};
        const targetEnv = target.config.environment || {};
        return { ...baseEnv, ...targetEnv };
    }
    generateDeploymentId() {
        return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async updateDeploymentStatus(deployment, status) {
        deployment.status = status;
        this.emit('statusUpdated', deployment, status);
        try {
            await this.store.saveDeployment(deployment);
        }
        catch (err) { /* ignore */ }
    }
    async addDeploymentLog(deployment, level, message, source) {
        const log = {
            id: this.generateLogId(),
            level,
            message,
            timestamp: new Date(),
            source
        };
        deployment.logs.push(log);
        this.emit('logAdded', deployment, log);
        try {
            await this.store.appendLog(deployment.id, log);
        }
        catch (err) { /* ignore */ }
    }
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getActiveDeployments() {
        return Array.from(this.activeDeployments.values());
    }
}
exports.DeploymentEngineImpl = DeploymentEngineImpl;
// Cloud Provider Implementations
class LocalProvider {
    constructor(logger) {
        this.logger = logger;
        this.name = 'local';
        this.type = 'local';
    }
    async deploy(config) {
        this.logger.info(`Deploying ${config.project.name} to local environment`);
        // Simulate local deployment
        await this.simulateDeployment();
        return {
            success: true,
            deploymentId: `local_${Date.now()}`,
            url: `http://localhost:3000`,
            endpoint: 'http://localhost:3000/api',
            metadata: {
                type: 'local',
                port: 3000,
                pid: process.pid
            }
        };
    }
    async getStatus(deploymentId) {
        // Check if local process is running
        return types_1.DeploymentStatus.SUCCESS;
    }
    async rollback(deploymentId, targetVersion) {
        this.logger.info(`Rolling back local deployment ${deploymentId} to version ${targetVersion}`);
        await this.simulateDeployment();
    }
    async listDeployments() {
        // List local deployments
        return [];
    }
    async simulateDeployment() {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
class DockerProvider {
    constructor(logger) {
        this.logger = logger;
        this.name = 'docker';
        this.type = 'docker';
    }
    async deploy(config) {
        this.logger.info(`Deploying ${config.project.name} to Docker container`);
        // Simulate Docker deployment
        await this.simulateDeployment();
        return {
            success: true,
            deploymentId: `docker_${Date.now()}`,
            url: `http://localhost:8080`,
            endpoint: `http://localhost:8080/api`,
            metadata: {
                type: 'docker',
                image: `${config.project.name}:${config.project.version}`,
                containerId: `container_${Date.now()}`,
                port: config.target.config.port || 8080
            }
        };
    }
    async getStatus(deploymentId) {
        // Check Docker container status
        return types_1.DeploymentStatus.SUCCESS;
    }
    async rollback(deploymentId, targetVersion) {
        this.logger.info(`Rolling back Docker deployment ${deploymentId} to version ${targetVersion}`);
        await this.simulateDeployment();
    }
    async listDeployments() {
        return [];
    }
    async simulateDeployment() {
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
class AWSProvider {
    constructor(logger) {
        this.logger = logger;
        this.name = 'aws';
        this.type = 'aws';
    }
    async deploy(config) {
        this.logger.info(`Deploying ${config.project.name} to AWS`);
        // Simulate AWS deployment
        await this.simulateDeployment();
        return {
            success: true,
            deploymentId: `aws_${Date.now()}`,
            url: `https://${config.project.name}.execute-api.us-east-1.amazonaws.com/prod`,
            endpoint: `https://${config.project.name}.execute-api.us-east-1.amazonaws.com/prod/api`,
            metadata: {
                type: 'aws',
                region: config.target.config.region || 'us-east-1',
                service: config.target.config.service || 'lambda',
                apiGatewayId: `api_${Date.now()}`
            }
        };
    }
    async getStatus(deploymentId) {
        // Check AWS deployment status
        return types_1.DeploymentStatus.SUCCESS;
    }
    async rollback(deploymentId, targetVersion) {
        this.logger.info(`Rolling back AWS deployment ${deploymentId} to version ${targetVersion}`);
        await this.simulateDeployment();
    }
    async listDeployments() {
        return [];
    }
    async simulateDeployment() {
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}
class SSHProvider {
    constructor(logger) {
        this.logger = logger;
        this.name = 'ssh';
        this.type = 'ssh';
    }
    async deploy(config) {
        this.logger.info(`Deploying ${config.project.name} via SSH to ${config.target.config.host}`);
        // Simulate SSH deployment
        await this.simulateDeployment();
        return {
            success: true,
            deploymentId: `ssh_${Date.now()}`,
            url: `http://${config.target.config.host}:3000`,
            endpoint: `http://${config.target.config.host}:3000/api`,
            metadata: {
                type: 'ssh',
                host: config.target.config.host,
                user: config.target.config.user || 'root',
                path: '/var/www/app',
                port: 3000
            }
        };
    }
    async getStatus(deploymentId) {
        // Check remote deployment status
        return types_1.DeploymentStatus.SUCCESS;
    }
    async rollback(deploymentId, targetVersion) {
        this.logger.info(`Rolling back SSH deployment ${deploymentId} to version ${targetVersion}`);
        await this.simulateDeployment();
    }
    async listDeployments() {
        return [];
    }
    async simulateDeployment() {
        await new Promise(resolve => setTimeout(resolve, 2500));
    }
}
// Deployment Pipeline with Health Checks and Monitoring
class DeploymentPipeline {
    constructor(deploymentEngine, logger) {
        this.healthChecks = new Map();
        this.deploymentEngine = deploymentEngine;
        this.logger = logger;
        this.setupEventListeners();
    }
    setupEventListeners() {
        if (this.deploymentEngine.on) {
            this.deploymentEngine.on('deploymentCompleted', async (deployment) => {
                await this.startHealthChecks(deployment);
            });
            this.deploymentEngine.on('deploymentFailed', (deployment) => {
                this.logger.error(`Deployment ${deployment.id} failed, checking for rollback triggers`);
                this.checkRollbackTriggers(deployment);
            });
        }
    }
    async executeDeployment(project, target, options = {}) {
        this.logger.info(`Executing deployment pipeline for project '${project.name}'`);
        const progress = options.progressCallback || (() => { });
        try {
            progress(10, 'Starting deployment...');
            // Pre-deployment checks
            await this.runPreDeploymentChecks(project, target);
            progress(20, 'Pre-deployment checks completed');
            // Execute deployment
            const deployment = await this.deploymentEngine.deploy(project, target);
            progress(80, 'Deployment completed');
            // Post-deployment verification
            if (options.healthCheck) {
                progress(90, 'Running health checks...');
                await this.runPostDeploymentHealthChecks(deployment);
            }
            progress(100, 'Deployment pipeline completed successfully');
            return deployment;
        }
        catch (error) {
            progress(0, 'Deployment failed');
            if (options.autoRollback) {
                this.logger.info('Auto-rollback triggered due to deployment failure');
                // Implement auto-rollback logic
            }
            throw error;
        }
    }
    async runPreDeploymentChecks(project, target) {
        // Validate project configuration
        // Check target availability
        // Verify credentials
        // Check resource limits
        this.logger.info('Running pre-deployment checks');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate checks
    }
    async runPostDeploymentHealthChecks(deployment) {
        if (!deployment.target.config.healthCheck) {
            this.logger.info('No health check configured for deployment');
            return;
        }
        const healthConfig = deployment.target.config.healthCheck;
        const healthChecker = new HealthChecker(healthConfig, this.logger);
        this.healthChecks.set(deployment.id, healthChecker);
        try {
            await healthChecker.startMonitoring(deployment);
            this.logger.info(`Health checks started for deployment ${deployment.id}`);
        }
        catch (error) {
            this.logger.error(`Failed to start health checks: ${error}`);
        }
    }
    async checkRollbackTriggers(deployment) {
        // Check if rollback should be triggered based on deployment failure
        // This would implement the rollback logic based on configuration
    }
    async startHealthChecks(deployment) {
        if (deployment.target.config.healthCheck) {
            await this.runPostDeploymentHealthChecks(deployment);
        }
    }
}
exports.DeploymentPipeline = DeploymentPipeline;
class HealthChecker {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.monitoring = false;
    }
    async startMonitoring(deployment) {
        this.monitoring = true;
        this.interval = setInterval(async () => {
            if (!this.monitoring)
                return;
            try {
                await this.performHealthCheck(deployment);
            }
            catch (error) {
                this.logger.error(`Health check failed: ${error}`);
                // Handle health check failure (alert, rollback, etc.)
            }
        }, this.config.interval);
    }
    stopMonitoring() {
        this.monitoring = false;
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
    async performHealthCheck(deployment) {
        // Implement actual health check logic
        // This would make HTTP requests to the deployed service
        this.logger.debug(`Performing health check for deployment ${deployment.id}`);
    }
}
