/// <reference types="node" />
import { EventEmitter } from 'events';
import { ChatCommands, Project, Deployment, Logger, PluginHooks } from '../types';
export interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: any;
}
export interface ChatSession {
    id: string;
    userId: string;
    messages: ChatMessage[];
    createdAt: Date;
    lastActivity: Date;
    context: ChatContext;
}
export interface ChatContext {
    currentProject?: string;
    currentDeployment?: string;
    workingDirectory?: string;
    environment?: Record<string, any>;
}
export interface AIResponse {
    message: string;
    actions?: ChatAction[];
    context?: ChatContext;
}
export interface ChatAction {
    type: 'deploy' | 'build' | 'status' | 'rollback' | 'create_project' | 'list_projects';
    description: string;
    parameters: Record<string, any>;
    confirmation_required: boolean;
}
export declare class ChatInterface extends EventEmitter implements ChatCommands {
    private sessions;
    private wsServer;
    private logger;
    private projectManager;
    private deploymentEngine;
    private aiProvider;
    constructor(logger: Logger, projectManager: any, deploymentEngine: any, port?: number);
    private setupWebSocketServer;
    private handleConnection;
    private handleMessage;
    private processMessage;
    private buildContext;
    private getAvailableProjects;
    private getAvailableCommands;
    private parseActions;
    private isValidAction;
    private generateSessionId;
    private generateMessageId;
    private extractUserId;
    private sendMessage;
    private sendError;
    deployProject(projectName: string, target: string): Promise<string>;
    getDeploymentStatus(projectName: string): Promise<string>;
    listProjects(): Promise<string>;
    rollbackProject(projectName: string, version: string): Promise<string>;
    createProject(template: string, name: string): Promise<string>;
    executeAction(action: ChatAction): Promise<string>;
    private buildProject;
    close(): void;
}
export declare class ChatPluginHooks implements PluginHooks {
    private chatInterface;
    constructor(chatInterface: ChatInterface);
    beforeBuild(project: Project): Promise<void>;
    afterBuild(result: any): Promise<void>;
    beforeDeploy(deployment: Deployment): Promise<void>;
    afterDeploy(result: any): Promise<void>;
    beforeRollback(deployment: Deployment): Promise<void>;
    afterRollback(deployment: Deployment): Promise<void>;
    private broadcastMessage;
}
