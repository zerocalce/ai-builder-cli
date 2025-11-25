import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  Deployment, 
  DeploymentStatus, 
  DeploymentLog, 
  Logger as ILogger,
  ProgressIndicator
} from '../types';

export interface MonitoringConfig {
  enabled: boolean;
  interval: number; // milliseconds
  retentionDays: number;
  alertThresholds: AlertThresholds;
  notifications: NotificationConfig;
}

export interface AlertThresholds {
  errorRate: number; // percentage
  responseTime: number; // milliseconds
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  diskUsage: number; // percentage
}

export interface NotificationConfig {
  email?: EmailConfig;
  webhook?: WebhookConfig;
  slack?: SlackConfig;
}

export interface EmailConfig {
  enabled: boolean;
  recipients: string[];
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  headers?: Record<string, string>;
}

export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
  channel?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  timestamp: Date;
  metrics: SystemMetrics;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    usage: number;
  };
  disk: {
    used: number;
    total: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

export interface Alert {
  id: string;
  type: 'error_rate' | 'response_time' | 'cpu' | 'memory' | 'disk' | 'deployment_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  deploymentId?: string;
  metrics?: SystemMetrics;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export class DeploymentMonitor extends EventEmitter {
  private deployments: Map<string, Deployment> = new Map();
  private healthChecks: Map<string, HealthCheckRunner> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private config: MonitoringConfig;
  private logger: ILogger;
  private logsDir: string;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: MonitoringConfig, logger: ILogger) {
    super();
    this.config = config;
    this.logger = logger;
    this.logsDir = path.join(os.homedir(), '.ai-builder', 'logs');
    
    this.ensureLogsDirectory();
    this.startMonitoring();
  }

  private async ensureLogsDirectory(): Promise<void> {
    await fs.promises.mkdir(this.logsDir, { recursive: true });
  }

  private startMonitoring(): void {
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

  async addDeployment(deployment: Deployment): Promise<void> {
    this.deployments.set(deployment.id, deployment);
    
    // Start health checking for successful deployments
    if (deployment.status === DeploymentStatus.SUCCESS) {
      await this.startHealthCheck(deployment);
    }

    // Log deployment event
    await this.logDeploymentEvent(deployment, 'deployment_added');
    this.logger.info(`Added deployment ${deployment.id} to monitoring`);
  }

  async removeDeployment(deploymentId: string): Promise<void> {
    this.deployments.delete(deploymentId);
    
    // Stop health checking
    const healthCheck = this.healthChecks.get(deploymentId);
    if (healthCheck) {
      await healthCheck.stop();
      this.healthChecks.delete(deploymentId);
    }

    // Log deployment event
    await this.logDeploymentEvent({ id: deploymentId } as Deployment, 'deployment_removed');
    this.logger.info(`Removed deployment ${deploymentId} from monitoring`);
  }

  async updateDeploymentStatus(deployment: Deployment, status: DeploymentStatus): Promise<void> {
    const previousStatus = deployment.status;
    deployment.status = status;
    
    // Handle status changes
    if (previousStatus !== DeploymentStatus.SUCCESS && status === DeploymentStatus.SUCCESS) {
      await this.startHealthCheck(deployment);
    } else if (previousStatus === DeploymentStatus.SUCCESS && status !== DeploymentStatus.SUCCESS) {
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
    if (status === DeploymentStatus.FAILED) {
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

  private async startHealthCheck(deployment: Deployment): Promise<void> {
    if (!deployment.target.config.healthCheck) {
      return;
    }

    const healthCheck = new HealthCheckRunner(
      deployment,
      deployment.target.config.healthCheck,
      this.logger
    );

    healthCheck.on('healthCheckCompleted', (result: HealthCheckResult) => {
      this.handleHealthCheckResult(deployment.id, result);
    });

    healthCheck.on('healthCheckFailed', (error: Error) => {
      this.logger.error(`Health check failed for deployment ${deployment.id}: ${error}`);
    });

    await healthCheck.start();
    this.healthChecks.set(deployment.id, healthCheck);
    
    this.logger.info(`Started health checking for deployment ${deployment.id}`);
  }

  private async stopHealthCheck(deploymentId: string): Promise<void> {
    const healthCheck = this.healthChecks.get(deploymentId);
    if (healthCheck) {
      await healthCheck.stop();
      this.healthChecks.delete(deploymentId);
      this.logger.info(`Stopped health checking for deployment ${deploymentId}`);
    }
  }

  private handleHealthCheckResult(deploymentId: string, result: HealthCheckResult): void {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) return;

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

  private async performHealthChecks(): Promise<void> {
    const healthChecks = Array.from(this.healthChecks.values());
    
    for (const healthCheck of healthChecks) {
      try {
        await healthCheck.performCheck();
      } catch (error) {
        this.logger.error(`Failed to perform health check: ${error}`);
      }
    }
  }

  private async checkAlertThresholds(): Promise<void> {
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

  private async getSystemMetrics(): Promise<SystemMetrics> {
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

  private async createAlert(alert: Omit<Alert, 'id'>): Promise<void> {
    const fullAlert: Alert = {
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

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const notifications = this.config.notifications;

    // Send email notification
    if (notifications.email?.enabled) {
      await this.sendEmailNotification(alert, notifications.email);
    }

    // Send webhook notification
    if (notifications.webhook?.enabled) {
      await this.sendWebhookNotification(alert, notifications.webhook);
    }

    // Send Slack notification
    if (notifications.slack?.enabled) {
      await this.sendSlackNotification(alert, notifications.slack);
    }
  }

  private async sendEmailNotification(alert: Alert, config: EmailConfig): Promise<void> {
    // Implement email sending logic
    this.logger.info(`Email notification sent for alert: ${alert.id}`);
  }

  private async sendWebhookNotification(alert: Alert, config: WebhookConfig): Promise<void> {
    // Implement webhook notification logic
    this.logger.info(`Webhook notification sent for alert: ${alert.id}`);
  }

  private async sendSlackNotification(alert: Alert, config: SlackConfig): Promise<void> {
    // Implement Slack notification logic
    this.logger.info(`Slack notification sent for alert: ${alert.id}`);
  }

  private async storeHealthCheckResult(deploymentId: string, result: HealthCheckResult): Promise<void> {
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

  private async logDeploymentEvent(deployment: Deployment, event: string, metadata?: any): Promise<void> {
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

  private async logAlert(alert: Alert): Promise<void> {
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

  private async cleanupOldLogs(): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to cleanup old logs: ${error}`);
    }
  }

  async getDeploymentLogs(deploymentId: string, options?: {
    since?: Date;
    level?: 'info' | 'warn' | 'error';
    limit?: number;
  }): Promise<DeploymentLog[]> {
    const logFile = path.join(this.logsDir, `deployment_${deploymentId}.jsonl`);
    
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const logs: DeploymentLog[] = [];
    const content = await fs.promises.readFile(logFile, 'utf-8');
    const lines = content.split('\n').filter((line: string) => line.trim());

    for (const line of lines) {
      try {
        const logEntry = JSON.parse(line);
        
        // Apply filters
        if (options?.since && new Date(logEntry.timestamp) < options.since) {
          continue;
        }
        
        if (options?.level && logEntry.level !== options.level) {
          continue;
        }

        logs.push({
          id: logEntry.id,
          level: logEntry.level,
          message: logEntry.message,
          timestamp: new Date(logEntry.timestamp),
          source: logEntry.source
        });
      } catch (error) {
        this.logger.warn(`Failed to parse log line: ${line}`);
      }
    }

    // Apply limit
    if (options?.limit) {
      return logs.slice(-options.limit);
    }

    return logs;
  }

  async getAlerts(options?: {
    active?: boolean;
    severity?: string;
    limit?: number;
  }): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());

    // Apply filters
    if (options?.active) {
      alerts = alerts.filter(alert => !alert.resolved);
    }

    if (options?.severity) {
      alerts = alerts.filter(alert => alert.severity === options.severity);
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  async resolveAlert(alertId: string): Promise<void> {
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

  async getHealthCheckHistory(deploymentId: string, options?: {
    since?: Date;
    limit?: number;
  }): Promise<HealthCheckResult[]> {
    const logFile = path.join(this.logsDir, `health_${deploymentId}.jsonl`);
    
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const results: HealthCheckResult[] = [];
    const content = await fs.promises.readFile(logFile, 'utf-8');
    const lines = content.split('\n').filter((line: string) => line.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        if (options?.since && new Date(entry.timestamp) < options.since) {
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
      } catch (error) {
        this.logger.warn(`Failed to parse health check log line: ${line}`);
      }
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (options?.limit) {
      results.splice(options.limit);
    }

    return results;
  }

  stop(): void {
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

class HealthCheckRunner extends EventEmitter {
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(
    private deployment: Deployment,
    private healthCheckConfig: any,
    private logger: ILogger
  ) {
    super();
  }

  async start(): Promise<void> {
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

  async stop(): Promise<void> {
    this.running = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    this.logger.info(`Health check stopped for deployment ${this.deployment.id}`);
  }

  async performCheck(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      const result = await this.executeHealthCheck();
      this.emit('healthCheckCompleted', result);
    } catch (error) {
      this.emit('healthCheckFailed', error as Error);
    }
  }

  private async executeHealthCheck(): Promise<HealthCheckResult> {
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
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: false,
        responseTime,
        error: (error as Error).message,
        timestamp: new Date(),
        metrics: await this.getSystemMetrics()
      };
    }
  }

  private async makeHttpRequest(endpoint: string): Promise<{ status: number }> {
    // Simulate HTTP request
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    
    // Simulate different response scenarios
    const random = Math.random();
    if (random < 0.1) {
      throw new Error('Connection timeout');
    } else if (random < 0.2) {
      return { status: 500 };
    } else {
      return { status: 200 };
    }
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
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
