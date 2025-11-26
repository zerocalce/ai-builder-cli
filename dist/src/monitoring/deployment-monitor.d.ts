/// <reference types="node" />
import { EventEmitter } from 'events';
import { Deployment, DeploymentStatus, DeploymentLog, Logger as ILogger } from '../types';
export interface MonitoringConfig {
    enabled: boolean;
    interval: number;
    retentionDays: number;
    alertThresholds: AlertThresholds;
    notifications: NotificationConfig;
}
export interface AlertThresholds {
    errorRate: number;
    responseTime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
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
export declare class DeploymentMonitor extends EventEmitter {
    private deployments;
    private healthChecks;
    private alerts;
    private config;
    private logger;
    private logsDir;
    private monitoringInterval?;
    constructor(config: MonitoringConfig, logger: ILogger);
    private ensureLogsDirectory;
    private startMonitoring;
    addDeployment(deployment: Deployment): Promise<void>;
    removeDeployment(deploymentId: string): Promise<void>;
    updateDeploymentStatus(deployment: Deployment, status: DeploymentStatus): Promise<void>;
    private startHealthCheck;
    private stopHealthCheck;
    private handleHealthCheckResult;
    private performHealthChecks;
    private checkAlertThresholds;
    private getSystemMetrics;
    private createAlert;
    private generateAlertId;
    private sendNotifications;
    private sendEmailNotification;
    private sendWebhookNotification;
    private sendSlackNotification;
    private storeHealthCheckResult;
    private logDeploymentEvent;
    private logAlert;
    private cleanupOldLogs;
    getDeploymentLogs(deploymentId: string, options?: {
        since?: Date;
        level?: 'info' | 'warn' | 'error';
        limit?: number;
    }): Promise<DeploymentLog[]>;
    getAlerts(options?: {
        active?: boolean;
        severity?: string;
        limit?: number;
    }): Promise<Alert[]>;
    resolveAlert(alertId: string): Promise<void>;
    getHealthCheckHistory(deploymentId: string, options?: {
        since?: Date;
        limit?: number;
    }): Promise<HealthCheckResult[]>;
    stop(): void;
}
