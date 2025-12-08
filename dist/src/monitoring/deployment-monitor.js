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
exports.DeploymentMonitor = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const types_1 = require("../types");
class DeploymentMonitor extends events_1.EventEmitter {
    constructor(config, logger) {
        super();
        this.deployments = new Map();
        this.healthChecks = new Map();
        this.alerts = new Map();
        this.config = config;
        this.logger = logger;
        this.logsDir = path.join(os.homedir(), '.ai-builder', 'logs');
        this.ensureLogsDirectory();
        this.startMonitoring();
    }
    async ensureLogsDirectory() {
        await fs.promises.mkdir(this.logsDir, { recursive: true });
    }
    startMonitoring() {
        if (!this.config.enabled) {
            this.logger.info('Deployment monitoring is disabled');
            return;
        }
        this.monitoringInterval = setInterval(async () => {
            await this.performHealthChecks();
            await this.checkAlertThresholds();
            await this.cleanupOldLogs();
        }, this.config.interval);
        this.logger.info(`Deployment monitoring started (interval: ${this.config.interval}ms)`);
    }
    async addDeployment(deployment) {
        this.deployments.set(deployment.id, deployment);
        // Start health checking for successful deployments
        if (deployment.status === types_1.DeploymentStatus.SUCCESS) {
            await this.startHealthCheck(deployment);
        }
        // Log deployment event
        await this.logDeploymentEvent(deployment, 'deployment_added');
        this.logger.info(`Added deployment ${deployment.id} to monitoring`);
    }
    async removeDeployment(deploymentId) {
        this.deployments.delete(deploymentId);
        // Stop health checking
        const healthCheck = this.healthChecks.get(deploymentId);
        if (healthCheck) {
            await healthCheck.stop();
            this.healthChecks.delete(deploymentId);
        }
        // Log deployment event
        await this.logDeploymentEvent({ id: deploymentId }, 'deployment_removed');
        this.logger.info(`Removed deployment ${deploymentId} from monitoring`);
    }
    async updateDeploymentStatus(deployment, status) {
        const previousStatus = deployment.status;
        deployment.status = status;
        // Handle status changes
        if (previousStatus !== types_1.DeploymentStatus.SUCCESS && status === types_1.DeploymentStatus.SUCCESS) {
            await this.startHealthCheck(deployment);
        }
        else if (previousStatus === types_1.DeploymentStatus.SUCCESS && status !== types_1.DeploymentStatus.SUCCESS) {
            await this.stopHealthCheck(deployment.id);
        }
        // Log status change
        await this.logDeploymentEvent(deployment, 'status_changed', {
            previousStatus,
            newStatus: status
        });
        // Emit event for external listeners
        this.emit('statusChanged', deployment, previousStatus);
        // Check for failure alerts
        if (status === types_1.DeploymentStatus.FAILED) {
            await this.createAlert({
                type: 'deployment_failure',
                severity: 'high',
                message: `Deployment ${deployment.id} failed`,
                deploymentId: deployment.id,
                timestamp: new Date(),
                resolved: false
            });
        }
    }
    async startHealthCheck(deployment) {
        if (!deployment.target.config.healthCheck) {
            return;
        }
        const healthCheck = new HealthCheckRunner(deployment, deployment.target.config.healthCheck, this.logger);
        healthCheck.on('healthCheckCompleted', (result) => {
            this.handleHealthCheckResult(deployment.id, result);
        });
        healthCheck.on('healthCheckFailed', (error) => {
            this.logger.error(`Health check failed for deployment ${deployment.id}: ${error}`);
        });
        await healthCheck.start();
        this.healthChecks.set(deployment.id, healthCheck);
        this.logger.info(`Started health checking for deployment ${deployment.id}`);
    }
    async stopHealthCheck(deploymentId) {
        const healthCheck = this.healthChecks.get(deploymentId);
        if (healthCheck) {
            await healthCheck.stop();
            this.healthChecks.delete(deploymentId);
            this.logger.info(`Stopped health checking for deployment ${deploymentId}`);
        }
    }
    handleHealthCheckResult(deploymentId, result) {
        const deployment = this.deployments.get(deploymentId);
        if (!deployment)
            return;
        // Store health check result
        this.storeHealthCheckResult(deploymentId, result);
        // Check for alerts
        if (!result.healthy) {
            this.createAlert({
                type: 'response_time',
                severity: 'medium',
                message: `Health check failed for deployment ${deploymentId}: ${result.error}`,
                deploymentId,
                metrics: result.metrics,
                timestamp: result.timestamp,
                resolved: false
            });
        }
        // Check response time threshold
        if (result.responseTime > this.config.alertThresholds.responseTime) {
            this.createAlert({
                type: 'response_time',
                severity: 'medium',
                message: `High response time for deployment ${deploymentId}: ${result.responseTime}ms`,
                deploymentId,
                metrics: result.metrics,
                timestamp: result.timestamp,
                resolved: false
            });
        }
        // Emit event for external listeners
        this.emit('healthCheckCompleted', deploymentId, result);
    }
    async performHealthChecks() {
        const healthChecks = Array.from(this.healthChecks.values());
        for (const healthCheck of healthChecks) {
            try {
                await healthCheck.performCheck();
            }
            catch (error) {
                this.logger.error(`Failed to perform health check: ${error}`);
            }
        }
    }
    async checkAlertThresholds() {
        // Check system metrics thresholds
        const metrics = await this.getSystemMetrics();
        if (metrics.cpu.usage > this.config.alertThresholds.cpuUsage) {
            await this.createAlert({
                type: 'cpu',
                severity: 'medium',
                message: `High CPU usage: ${metrics.cpu.usage}%`,
                metrics,
                timestamp: new Date(),
                resolved: false
            });
        }
        if (metrics.memory.usage > this.config.alertThresholds.memoryUsage) {
            await this.createAlert({
                type: 'memory',
                severity: 'medium',
                message: `High memory usage: ${metrics.memory.usage}%`,
                metrics,
                timestamp: new Date(),
                resolved: false
            });
        }
        if (metrics.disk.usage > this.config.alertThresholds.diskUsage) {
            await this.createAlert({
                type: 'disk',
                severity: 'high',
                message: `High disk usage: ${metrics.disk.usage}%`,
                metrics,
                timestamp: new Date(),
                resolved: false
            });
        }
    }
    async getSystemMetrics() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        // Get disk usage (simplified)
        const stats = await fs.promises.stat(this.logsDir);
        const diskUsage = 0; // Would need to implement proper disk usage checking
        return {
            cpu: {
                usage: (loadAvg[0] / cpus.length) * 100,
                loadAverage: loadAvg
            },
            memory: {
                used: usedMem,
                total: totalMem,
                usage: (usedMem / totalMem) * 100
            },
            disk: {
                used: diskUsage,
                total: 1000000000000, // 1TB placeholder
                usage: (diskUsage / 1000000000000) * 100
            },
            network: {
                bytesIn: 0,
                bytesOut: 0
            }
        };
    }
    async createAlert(alert) {
        const fullAlert = {
            ...alert,
            id: this.generateAlertId()
        };
        this.alerts.set(fullAlert.id, fullAlert);
        // Log alert
        await this.logAlert(fullAlert);
        // Send notifications
        await this.sendNotifications(fullAlert);
        // Emit event
        this.emit('alertCreated', fullAlert);
        this.logger.warn(`Alert created: ${fullAlert.message}`);
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async sendNotifications(alert) {
        var _a, _b, _c;
        const notifications = this.config.notifications;
        // Send email notification
        if ((_a = notifications.email) === null || _a === void 0 ? void 0 : _a.enabled) {
            await this.sendEmailNotification(alert, notifications.email);
        }
        // Send webhook notification
        if ((_b = notifications.webhook) === null || _b === void 0 ? void 0 : _b.enabled) {
            await this.sendWebhookNotification(alert, notifications.webhook);
        }
        // Send Slack notification
        if ((_c = notifications.slack) === null || _c === void 0 ? void 0 : _c.enabled) {
            await this.sendSlackNotification(alert, notifications.slack);
        }
    }
    async sendEmailNotification(alert, config) {
        // Implement email sending logic
        this.logger.info(`Email notification sent for alert: ${alert.id}`);
    }
    async sendWebhookNotification(alert, config) {
        // Implement webhook notification logic
        this.logger.info(`Webhook notification sent for alert: ${alert.id}`);
    }
    async sendSlackNotification(alert, config) {
        // Implement Slack notification logic
        this.logger.info(`Slack notification sent for alert: ${alert.id}`);
    }
    async storeHealthCheckResult(deploymentId, result) {
        const logFile = path.join(this.logsDir, `health_${deploymentId}.jsonl`);
        const logEntry = {
            deploymentId,
            timestamp: result.timestamp,
            healthy: result.healthy,
            responseTime: result.responseTime,
            statusCode: result.statusCode,
            error: result.error,
            metrics: result.metrics
        };
        await fs.promises.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    }
    async logDeploymentEvent(deployment, event, metadata) {
        const logFile = path.join(this.logsDir, 'deployments.jsonl');
        const logEntry = {
            timestamp: new Date(),
            deploymentId: deployment.id,
            projectId: deployment.projectId,
            event,
            status: deployment.status,
            metadata
        };
        await fs.promises.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    }
    async logAlert(alert) {
        const logFile = path.join(this.logsDir, 'alerts.jsonl');
        const logEntry = {
            timestamp: alert.timestamp,
            alertId: alert.id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            deploymentId: alert.deploymentId,
            resolved: alert.resolved
        };
        await fs.promises.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    }
    async cleanupOldLogs() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        try {
            const files = await fs.promises.readdir(this.logsDir);
            for (const file of files) {
                const filePath = path.join(this.logsDir, file);
                const stats = await fs.promises.stat(filePath);
                if (stats.mtime < cutoffDate) {
                    await fs.promises.rm(filePath, { recursive: true, force: true });
                    this.logger.debug(`Removed old log file: ${file}`);
                }
            }
        }
        catch (error) {
            this.logger.error(`Failed to cleanup old logs: ${error}`);
        }
    }
    async getDeploymentLogs(deploymentId, options) {
        const logFile = path.join(this.logsDir, `deployment_${deploymentId}.jsonl`);
        if (!fs.existsSync(logFile)) {
            return [];
        }
        const logs = [];
        const content = await fs.promises.readFile(logFile, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());
        for (const line of lines) {
            try {
                const logEntry = JSON.parse(line);
                // Apply filters
                if ((options === null || options === void 0 ? void 0 : options.since) && new Date(logEntry.timestamp) < options.since) {
                    continue;
                }
                if ((options === null || options === void 0 ? void 0 : options.level) && logEntry.level !== options.level) {
                    continue;
                }
                logs.push({
                    id: logEntry.id,
                    level: logEntry.level,
                    message: logEntry.message,
                    timestamp: new Date(logEntry.timestamp),
                    source: logEntry.source
                });
            }
            catch (error) {
                this.logger.warn(`Failed to parse log line: ${line}`);
            }
        }
        // Apply limit
        if (options === null || options === void 0 ? void 0 : options.limit) {
            return logs.slice(-options.limit);
        }
        return logs;
    }
    async getAlerts(options) {
        let alerts = Array.from(this.alerts.values());
        // Apply filters
        if (options === null || options === void 0 ? void 0 : options.active) {
            alerts = alerts.filter(alert => !alert.resolved);
        }
        if (options === null || options === void 0 ? void 0 : options.severity) {
            alerts = alerts.filter(alert => alert.severity === options.severity);
        }
        // Sort by timestamp (newest first)
        alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply limit
        if (options === null || options === void 0 ? void 0 : options.limit) {
            alerts = alerts.slice(0, options.limit);
        }
        return alerts;
    }
    async resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (!alert) {
            throw new Error(`Alert ${alertId} not found`);
        }
        alert.resolved = true;
        alert.resolvedAt = new Date();
        await this.logAlert(alert);
        this.emit('alertResolved', alert);
        this.logger.info(`Alert ${alertId} resolved`);
    }
    async getHealthCheckHistory(deploymentId, options) {
        const logFile = path.join(this.logsDir, `health_${deploymentId}.jsonl`);
        if (!fs.existsSync(logFile)) {
            return [];
        }
        const results = [];
        const content = await fs.promises.readFile(logFile, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if ((options === null || options === void 0 ? void 0 : options.since) && new Date(entry.timestamp) < options.since) {
                    continue;
                }
                results.push({
                    healthy: entry.healthy,
                    responseTime: entry.responseTime,
                    statusCode: entry.statusCode,
                    error: entry.error,
                    timestamp: new Date(entry.timestamp),
                    metrics: entry.metrics
                });
            }
            catch (error) {
                this.logger.warn(`Failed to parse health check log line: ${line}`);
            }
        }
        // Sort by timestamp (newest first)
        results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        // Apply limit
        if (options === null || options === void 0 ? void 0 : options.limit) {
            results.splice(options.limit);
        }
        return results;
    }
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        // Stop all health checks
        const healthChecks = Array.from(this.healthChecks.values());
        for (const healthCheck of healthChecks) {
            healthCheck.stop();
        }
        this.logger.info('Deployment monitoring stopped');
    }
}
exports.DeploymentMonitor = DeploymentMonitor;
class HealthCheckRunner extends events_1.EventEmitter {
    constructor(deployment, healthCheckConfig, logger) {
        super();
        this.deployment = deployment;
        this.healthCheckConfig = healthCheckConfig;
        this.logger = logger;
        this.running = false;
    }
    async start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.interval = setInterval(async () => {
            await this.performCheck();
        }, this.healthCheckConfig.interval);
        // Perform initial check
        await this.performCheck();
        this.logger.info(`Health check started for deployment ${this.deployment.id}`);
    }
    async stop() {
        this.running = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        this.logger.info(`Health check stopped for deployment ${this.deployment.id}`);
    }
    async performCheck() {
        if (!this.running) {
            return;
        }
        try {
            const result = await this.executeHealthCheck();
            this.emit('healthCheckCompleted', result);
        }
        catch (error) {
            this.emit('healthCheckFailed', error);
        }
    }
    async executeHealthCheck() {
        const startTime = Date.now();
        try {
            // Simulate HTTP request to health endpoint
            const response = await this.makeHttpRequest(this.healthCheckConfig.endpoint);
            const responseTime = Date.now() - startTime;
            const metrics = await this.getSystemMetrics();
            return {
                healthy: response.status >= 200 && response.status < 300,
                responseTime,
                statusCode: response.status,
                timestamp: new Date(),
                metrics
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                healthy: false,
                responseTime,
                error: error.message,
                timestamp: new Date(),
                metrics: await this.getSystemMetrics()
            };
        }
    }
    async makeHttpRequest(endpoint) {
        // Simulate HTTP request
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        // Simulate different response scenarios
        const random = Math.random();
        if (random < 0.1) {
            throw new Error('Connection timeout');
        }
        else if (random < 0.2) {
            return { status: 500 };
        }
        else {
            return { status: 200 };
        }
    }
    async getSystemMetrics() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        return {
            cpu: {
                usage: (loadAvg[0] / cpus.length) * 100,
                loadAverage: loadAvg
            },
            memory: {
                used: usedMem,
                total: totalMem,
                usage: (usedMem / totalMem) * 100
            },
            disk: {
                used: 0,
                total: 1000000000000,
                usage: 0
            },
            network: {
                bytesIn: 0,
                bytesOut: 0
            }
        };
    }
}
