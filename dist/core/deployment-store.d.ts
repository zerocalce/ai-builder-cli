import { Deployment, DeploymentLog, Logger } from '../types';
export interface DeploymentStore {
    saveDeployment(deployment: Deployment): Promise<void>;
    getDeployment(id: string): Promise<Deployment | null>;
    listDeployments(projectId?: string): Promise<Deployment[]>;
    appendLog(deploymentId: string, log: DeploymentLog): Promise<void>;
    getDeploymentHistory(projectId: string): Promise<Deployment[]>;
}
export declare class FileDeploymentStore implements DeploymentStore {
    private baseDir;
    private logger?;
    constructor(baseDir?: string, logger?: Logger);
    private getPathForId;
    appendLog(deploymentId: string, log: DeploymentLog): Promise<void>;
    getDeploymentHistory(projectId: string): Promise<Deployment[]>;
}
