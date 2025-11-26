/// <reference types="node" />
import { EventEmitter } from 'events';
import { DeploymentStore } from './deployment-store';
import { Deployment, DeploymentEngine, DeploymentStatus, DeploymentTarget, Project, DeploymentLog, Logger } from '../types';
export declare class DeploymentEngineImpl extends EventEmitter implements DeploymentEngine {
    private activeDeployments;
    private cloudProviders;
    private logger;
    private store;
    constructor(logger: Logger, store?: DeploymentStore);
    listPersistedDeployments(projectId?: string): Promise<Deployment[]>;
    getPersistedDeployment(id: string): Promise<Deployment | null>;
    private initializeCloudProviders;
    deploy(project: Project, target: DeploymentTarget): Promise<Deployment>;
    rollback(deployment: Deployment, version: string): Promise<void>;
    getStatus(deployment: Deployment): Promise<DeploymentStatus>;
    getLogs(deployment: Deployment): Promise<DeploymentLog[]>;
    cancelDeployment(deployment: Deployment): Promise<void>;
    private buildProject;
    private mergeEnvironmentVariables;
    private generateDeploymentId;
    private updateDeploymentStatus;
    private addDeploymentLog;
    private generateLogId;
    getActiveDeployments(): Deployment[];
}
export declare class DeploymentPipeline {
    private deploymentEngine;
    private healthChecks;
    private logger;
    constructor(deploymentEngine: DeploymentEngine, logger: Logger);
    private setupEventListeners;
    executeDeployment(project: Project, target: DeploymentTarget, options?: {
        healthCheck?: boolean;
        autoRollback?: boolean;
        progressCallback?: (progress: number, message: string) => void;
    }): Promise<Deployment>;
    private runPreDeploymentChecks;
    private runPostDeploymentHealthChecks;
    private checkRollbackTriggers;
    private startHealthChecks;
}
