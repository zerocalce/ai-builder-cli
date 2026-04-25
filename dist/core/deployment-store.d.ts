import { Deployment, DeploymentLog } from '../types';
export interface DeploymentStore {
    saveDeployment(d: Deployment): Promise<void>;
    getDeployment(id: string): Promise<Deployment | null>;
    listDeployments(projectId?: string): Promise<Deployment[]>;
    appendLog(id: string, log: DeploymentLog): Promise<void>;
    getDeploymentHistory(id: string): Promise<DeploymentLog[]>;
}
export declare class FileDeploymentStore implements DeploymentStore {
    private dir;
    private logger;
    constructor(dir?: string, logger?: any);
    private fileFor;
    saveDeployment(d: Deployment): Promise<void>;
    getDeployment(id: string): Promise<Deployment | null>;
    listDeployments(projectId?: string): Promise<Deployment[]>;
    appendLog(id: string, log: DeploymentLog): Promise<void>;
    getDeploymentHistory(id: string): Promise<DeploymentLog[]>;
}
export declare class SQLiteDeploymentStore implements DeploymentStore {
    private db;
    private logger;
    private dbPath;
    constructor(dbPath?: string, logger?: any);
    private init;
    saveDeployment(d: Deployment): Promise<void>;
    getDeployment(id: string): Promise<Deployment | null>;
    listDeployments(projectId?: string): Promise<Deployment[]>;
    appendLog(id: string, log: DeploymentLog): Promise<void>;
    getDeploymentHistory(id: string): Promise<DeploymentLog[]>;
}
