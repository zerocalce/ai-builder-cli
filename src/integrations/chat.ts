import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { 
  ChatCommands,
  Project,
  Deployment,
  Logger,
  PluginHooks
} from '../types';

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

export class ChatInterface extends EventEmitter implements ChatCommands {
  private sessions: Map<string, ChatSession> = new Map();
  private wsServer: WebSocket.Server;
  private logger: Logger;
  private projectManager: any;
  private deploymentEngine: any;
  private aiProvider: AIProvider;

  constructor(
    logger: Logger,
    projectManager: any,
    deploymentEngine: any,
    port: number = 8080
  ) {
    super();
    this.logger = logger;
    this.projectManager = projectManager;
    this.deploymentEngine = deploymentEngine;
    this.aiProvider = new AIProvider(logger);
    
    this.wsServer = new WebSocket.Server({ port });
    this.setupWebSocketServer();
    
    this.logger.info(`Chat interface started on port ${port}`);
  }

  private setupWebSocketServer(): void {
    this.wsServer.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    this.wsServer.on('error', (error) => {
      this.logger.error(`WebSocket server error: ${error}`);
    });
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const sessionId = this.generateSessionId();
    const userId = this.extractUserId(request);
    
    const session: ChatSession = {
      id: sessionId,
      userId,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      context: {}
    };

    this.sessions.set(sessionId, session);
    
    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(sessionId, message, ws);
      } catch (error) {
        this.logger.error(`Failed to handle message: ${error}`);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.sessions.delete(sessionId);
      this.logger.debug(`Chat session ${sessionId} closed`);
    });

    // Send welcome message
    this.sendMessage(ws, {
      id: this.generateMessageId(),
      type: 'assistant',
      content: '👋 Welcome to AI Builder Chat! I can help you manage your projects, deployments, and more. What would you like to do today?',
      timestamp: new Date()
    });
  }

  private async handleMessage(sessionId: string, message: any, ws: WebSocket): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(ws, 'Session not found');
      return;
    }

    // Add user message to session
    const userMessage: ChatMessage = {
      id: this.generateMessageId(),
      type: 'user',
      content: message.content,
      timestamp: new Date(),
      metadata: message.metadata
    };

    session.messages.push(userMessage);
    session.lastActivity = new Date();

    // Process message and generate response
    try {
      const response = await this.processMessage(userMessage, session);
      
      // Add assistant message to session
      const assistantMessage: ChatMessage = {
        id: this.generateMessageId(),
        type: 'assistant',
        content: response.message,
        timestamp: new Date(),
        metadata: {
          actions: response.actions,
          context: response.context
        }
      };

      session.messages.push(assistantMessage);
      
      // Send response
      this.sendMessage(ws, assistantMessage);
      
      // Update context if provided
      if (response.context) {
        session.context = { ...session.context, ...response.context };
      }

    } catch (error) {
      this.logger.error(`Failed to process message: ${error}`);
      this.sendError(ws, 'Failed to process your message');
    }
  }

  private async processMessage(message: ChatMessage, session: ChatSession): Promise<AIResponse> {
    // Build context for AI
    const context = this.buildContext(session, message);
    
    // Get AI response
    const response = await this.aiProvider.generateResponse(message.content, context);
    
    // Parse and validate actions
    const actions = response.actions ? await this.parseActions(response.actions) : [];
    
    return {
      message: response.message,
      actions,
      context: response.context
    };
  }

  private buildContext(session: ChatSession, message: ChatMessage): any {
    const recentMessages = session.messages.slice(-10); // Last 10 messages
    
    return {
      currentProject: session.context.currentProject,
      currentDeployment: session.context.currentDeployment,
      workingDirectory: session.context.workingDirectory,
      recentMessages: recentMessages.map(m => ({
        type: m.type,
        content: m.content,
        timestamp: m.timestamp
      })),
      availableProjects: this.getAvailableProjects(),
      availableCommands: this.getAvailableCommands()
    };
  }

  private getAvailableProjects(): string[] {
    // This would integrate with project manager
    return ['my-api', 'web-app', 'mobile-app'];
  }

  private getAvailableCommands(): string[] {
    return [
      'deploy', 'build', 'status', 'rollback', 'create_project', 
      'list_projects', 'get_logs', 'set_config', 'get_config'
    ];
  }

  private async parseActions(actions: ChatAction[]): Promise<ChatAction[]> {
    const validActions: ChatAction[] = [];
    
    for (const action of actions) {
      if (this.isValidAction(action)) {
        validActions.push(action);
      }
    }
    
    return validActions;
  }

  private isValidAction(action: ChatAction): boolean {
    const validTypes = ['deploy', 'build', 'status', 'rollback', 'create_project', 'list_projects'];
    return validTypes.includes(action.type);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractUserId(request: any): string {
    // Extract user ID from request (could be from JWT, session, etc.)
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  private sendMessage(ws: WebSocket, message: ChatMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      id: this.generateMessageId(),
      type: 'system',
      content: `Error: ${error}`,
      timestamp: new Date()
    });
  }

  // ChatCommands implementation
  async deployProject(projectName: string, target: string): Promise<string> {
    try {
      const project = await this.projectManager.loadProject(projectName);
      const deployment = await this.deploymentEngine.deploy(project, { name: target } as any);
      
      return `✅ Deployment started for project '${projectName}' to target '${target}'. Deployment ID: ${deployment.id}`;
    } catch (error) {
      return `❌ Deployment failed: ${(error as Error).message}`;
    }
  }

  async getDeploymentStatus(projectName: string): Promise<string> {
    try {
      const project = await this.projectManager.loadProject(projectName);
      const deployments = project.deployments;
      
      if (deployments.length === 0) {
        return `No deployments found for project '${projectName}'`;
      }
      
      const latest = deployments[deployments.length - 1];
      return `Latest deployment status: ${latest.status} (created: ${latest.createdAt.toLocaleString()})`;
    } catch (error) {
      return `❌ Failed to get deployment status: ${(error as Error).message}`;
    }
  }

  async listProjects(): Promise<string> {
    try {
      const projects = await this.projectManager.listProjects();
      
      if (projects.length === 0) {
        return 'No projects found';
      }
      
      const projectList = projects.map(p => `• ${p.name} (${p.template})`).join('\n');
      return `Available projects:\n${projectList}`;
    } catch (error) {
      return `❌ Failed to list projects: ${(error as Error).message}`;
    }
  }

  async rollbackProject(projectName: string, version: string): Promise<string> {
    try {
      const project = await this.projectManager.loadProject(projectName);
      const deployments = project.deployments;
      
      const deploymentToRollback = deployments.find(d => d.version === version);
      if (!deploymentToRollback) {
        return `❌ Deployment with version '${version}' not found`;
      }
      
      await this.deploymentEngine.rollback(deploymentToRollback, version);
      
      return `✅ Rollback initiated for project '${projectName}' to version '${version}'`;
    } catch (error) {
      return `❌ Rollback failed: ${(error as Error).message}`;
    }
  }

  async createProject(template: string, name: string): Promise<string> {
    try {
      const project = await this.projectManager.createProject(template, name, '.');
      
      return `✅ Project '${name}' created successfully from template '${template}'`;
    } catch (error) {
      return `❌ Project creation failed: ${(error as Error).message}`;
    }
  }

  public async executeAction(action: ChatAction): Promise<string> {
    switch (action.type) {
      case 'deploy':
        return await this.deployProject(action.parameters.projectName, action.parameters.target);
      
      case 'build':
        return this.buildProject(action.parameters.projectName);
      
      case 'status':
        return await this.getDeploymentStatus(action.parameters.projectName);
      
      case 'rollback':
        return await this.rollbackProject(action.parameters.projectName, action.parameters.version);
      
      case 'create_project':
        return await this.createProject(action.parameters.template, action.parameters.name);
      
      case 'list_projects':
        return await this.listProjects();
      
      default:
        return `❌ Unknown action type: ${action.type}`;
    }
  }

  private buildProject(projectName: string): string {
    // This would integrate with project manager
    return `🔨 Building project '${projectName}'...`;
  }

  public close(): void {
    this.wsServer.close();
    this.logger.info('Chat interface closed');
  }
}

class AIProvider {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async generateResponse(message: string, context: any): Promise<AIResponse> {
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const lowerMessage = message.toLowerCase();
    
    // Simple rule-based responses (in real implementation, would use actual AI)
    if (lowerMessage.includes('deploy')) {
      const projectName = this.extractProjectName(lowerMessage) || context.currentProject;
      const target = this.extractTarget(lowerMessage) || 'production';
      
      if (projectName) {
        return {
          message: `I can help you deploy '${projectName}' to '${target}'. Would you like me to proceed?`,
          actions: [{
            type: 'deploy',
            description: `Deploy ${projectName} to ${target}`,
            parameters: { projectName, target },
            confirmation_required: true
          }]
        };
      }
    }
    
    if (lowerMessage.includes('status')) {
      const projectName = this.extractProjectName(lowerMessage) || context.currentProject;
      
      if (projectName) {
        return {
          message: `I'll check the deployment status for '${projectName}'.`,
          actions: [{
            type: 'status',
            description: `Get deployment status for ${projectName}`,
            parameters: { projectName },
            confirmation_required: false
          }]
        };
      }
    }
    
    if (lowerMessage.includes('list') && lowerMessage.includes('project')) {
      return {
        message: "I'll list all your available projects.",
        actions: [{
          type: 'list_projects',
          description: 'List all projects',
          parameters: {},
          confirmation_required: false
        }]
      };
    }
    
    if (lowerMessage.includes('create') && lowerMessage.includes('project')) {
      return {
        message: "I can help you create a new project. What template would you like to use and what should we name it?",
        actions: [{
          type: 'create_project',
          description: 'Create new project',
          parameters: { template: 'express-api', name: 'new-project' },
          confirmation_required: true
        }]
      };
    }
    
    // Default response
    return {
      message: `I understand you want to: "${message}". I can help you with:\n\n• Deploying projects\n• Checking deployment status\n• Creating new projects\n• Listing existing projects\n• Rolling back deployments\n\nWhat would you like me to help you with?`
    };
  }

  private extractProjectName(message: string): string | undefined {
    const patterns = [
      /project\s+(\w+)/i,
      /deploy\s+(\w+)/i,
      /build\s+(\w+)/i,
      /status\s+of\s+(\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }

  private extractTarget(message: string): string | undefined {
    const patterns = [
      /to\s+(\w+)/i,
      /target\s+(\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return undefined;
  }
}

// Chat Plugin Hooks
export class ChatPluginHooks implements PluginHooks {
  private chatInterface: ChatInterface;

  constructor(chatInterface: ChatInterface) {
    this.chatInterface = chatInterface;
  }

  async beforeBuild(project: Project): Promise<void> {
    // Notify chat about build start
    this.broadcastMessage(`🔨 Starting build for project '${project.name}'`);
  }

  async afterBuild(result: any): Promise<void> {
    // Notify chat about build completion
    const status = result.success ? '✅' : '❌';
    this.broadcastMessage(`${status} Build completed${result.success ? ' successfully' : ' with errors'}`);
  }

  async beforeDeploy(deployment: Deployment): Promise<void> {
    // Notify chat about deployment start
    this.broadcastMessage(`🚀 Starting deployment of '${deployment.projectId}' to '${deployment.target.name}'`);
  }

  async afterDeploy(result: any): Promise<void> {
    // Notify chat about deployment completion
    const status = result.success ? '✅' : '❌';
    this.broadcastMessage(`${status} Deployment completed${result.success ? ' successfully' : ' with errors'}`);
  }

  async beforeRollback(deployment: Deployment): Promise<void> {
    // Notify chat about rollback start
    this.broadcastMessage(`🔄 Starting rollback of deployment '${deployment.id}'`);
  }

  async afterRollback(deployment: Deployment): Promise<void> {
    // Notify chat about rollback completion
    this.broadcastMessage(`✅ Rollback completed for deployment '${deployment.id}'`);
  }

  private broadcastMessage(message: string): void {
    // This would broadcast to all connected chat clients
    console.log(`[Chat Broadcast] ${message}`);
  }
}
