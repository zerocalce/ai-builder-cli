import { CLICommand, CommandArgs, Project, Template, Logger } from '../types';
import MigrationManager from '../core/migration';
import { CLIInterface } from '../cli/interface';
import { ProjectManagerImpl } from '../core/project-manager';

export class InitCommand implements CLICommand {
  name = 'init';
  description = 'Initialize a new AI project from a template';
  
  constructor(
    private cli: CLIInterface,
    private projectManager: ProjectManagerImpl,
    private logger: Logger
  ) {}

  options = [
    {
      name: 'template',
      alias: 't',
      description: 'Template to use for the project',
      type: 'string' as const,
      required: true
    },
    {
      name: 'name',
      alias: 'n',
      description: 'Project name',
      type: 'string' as const,
      required: true
    },
    {
      name: 'path',
      alias: 'p',
      description: 'Directory to create the project in',
      type: 'string' as const,
      default: '.'
    }
  ];

  async handler(args: CommandArgs): Promise<void> {
    this.cli.title('🚀 AI Builder - Project Initialization');
    this.cli.newline();

    try {
      // Validate template
      const templates = await this.getAvailableTemplates();
      const template = templates.find(t => t.name === args.template);
      
      if (!template) {
        this.cli.error(`Template '${args.template}' not found`);
        this.cli.info('Available templates:');
        templates.forEach(t => this.cli.list([`  • ${t.name}: ${t.description}`]));
        return;
      }

      // Create project
      const progress = this.cli.createProgressIndicator();
      progress.start(`Creating project '${args.name}'...`);

      const project = await this.projectManager.createProject(
        args.template,
        args.name,
        args.path
      );

      progress.success(`Project '${args.name}' created successfully!`);
      this.cli.newline();

      // Display project information
      this.cli.subtitle('📁 Project Details:');
      this.cli.table([{
        'Name': project.name,
        'Template': project.template,
        'Version': project.version,
        'Path': project.path,
        'Created': project.createdAt.toLocaleString()
      }]);

      this.cli.newline();
      this.cli.subtitle('🎯 Next Steps:');
      this.cli.list([
        `cd ${project.name}`,
        'ai-builder build',
        'ai-builder deploy <target>'
      ]);

      this.cli.newline();
      this.cli.info(`Project configuration saved to: ${path.join(project.path, '.ai-builder/project.json')}`);

    } catch (error) {
      this.cli.error(`Failed to create project: ${(error as Error).message}`);
      throw error;
    }
  }

  private async getAvailableTemplates(): Promise<Template[]> {
    // This would load from templates directory
    // For now, return mock templates
    return [
      {
        name: 'express-api',
        version: '1.0.0',
        description: 'Express.js API with TypeScript',
        category: 'backend',
        tags: ['api', 'express', 'typescript'],
        config: {
          build: {
            command: 'npm run build',
            outputDir: 'dist',
            environment: {},
            dependencies: ['express', 'typescript'],
            scripts: {}
          },
          deploy: {
            targets: [],
            healthCheck: {
              endpoint: '/health',
              interval: 30000,
              timeout: 5000,
              retries: 3
            }
          }
        },
        files: []
      },
      {
        name: 'react-app',
        version: '1.0.0',
        description: 'React application with Vite',
        category: 'frontend',
        tags: ['react', 'vite', 'typescript'],
        config: {
          build: {
            command: 'npm run build',
            outputDir: 'dist',
            environment: {},
            dependencies: ['react', 'vite'],
            scripts: {}
          },
          deploy: {
            targets: [],
            healthCheck: {
              endpoint: '/',
              interval: 30000,
              timeout: 5000,
              retries: 3
            }
          }
        },
        files: []
      },
      {
        name: 'fullstack-ai',
        version: '1.0.0',
        description: 'Full-stack AI application with database',
        category: 'fullstack',
        tags: ['ai', 'database', 'fullstack'],
        config: {
          build: {
            command: 'npm run build',
            outputDir: 'dist',
            environment: {},
            dependencies: ['express', 'react', 'prisma'],
            scripts: {}
          },
          deploy: {
            targets: [],
            healthCheck: {
              endpoint: '/health',
              interval: 30000,
              timeout: 5000,
              retries: 3
            }
          }
        },
        files: []
      }
    ];
  }
}

export class BuildCommand implements CLICommand {
  name = 'build';
  description = 'Build the current project';
  
  constructor(
    private cli: CLIInterface,
    private projectManager: ProjectManagerImpl,
    private logger: Logger
  ) {}

  options = [
    {
      name: 'path',
      alias: 'p',
      description: 'Path to the project directory',
      type: 'string' as const,
      default: '.'
    },
    {
      name: 'watch',
      alias: 'w',
      description: 'Watch for changes and rebuild automatically',
      type: 'boolean' as const,
      default: false
    },
    {
      name: 'verbose',
      alias: 'v',
      description: 'Show detailed build output',
      type: 'boolean' as const,
      default: false
    }
  ];

  async handler(args: CommandArgs): Promise<void> {
    this.cli.title('🔨 AI Builder - Project Build');
    this.cli.newline();

    try {
      // Load project
      const project = await this.projectManager.loadProject(args.path);
      
      this.cli.info(`Building project: ${project.name}`);
      this.cli.info(`Template: ${project.template}`);
      this.cli.info(`Build command: ${project.config.build.command}`);
      this.cli.newline();

      // Validate project
      const validation = await this.projectManager.validateProject(project);
      if (!validation.valid) {
        this.cli.error('Project validation failed:');
        validation.errors.forEach(error => {
          this.cli.list([`  ✗ ${error.message}`]);
        });
        return;
      }

      if (validation.warnings.length > 0) {
        this.cli.warning('Build warnings:');
        validation.warnings.forEach(warning => {
          this.cli.list([`  ⚠ ${warning.message}`]);
        });
        this.cli.newline();
      }

      // Build project
      const progress = this.cli.createProgressIndicator();
      progress.start('Building project...');

      const buildResult = await this.projectManager.buildProject(project);

      if (buildResult.success) {
        progress.success('Build completed successfully!');
        this.cli.newline();

        this.cli.subtitle('📊 Build Results:');
        this.cli.table([{
          'Status': '✅ Success',
          'Duration': `${buildResult.duration}ms`,
          'Artifacts': buildResult.artifacts.length,
          'Output Size': this.formatFileSize(buildResult.artifacts.reduce((total, artifact) => total + artifact.size, 0))
        }]);

        if (args.verbose && buildResult.output) {
          this.cli.newline();
          this.cli.subtitle('📝 Build Output:');
          console.log(buildResult.output);
        }

        if (buildResult.artifacts.length > 0) {
          this.cli.newline();
          this.cli.subtitle('📦 Build Artifacts:');
          buildResult.artifacts.forEach(artifact => {
            this.cli.list([`  • ${artifact.path} (${this.formatFileSize(artifact.size)})`]);
          });
        }

      } else {
        progress.error('Build failed!');
        this.cli.newline();

        this.cli.subtitle('❌ Build Errors:');
        this.cli.error(buildResult.error || 'Unknown error occurred');

        if (args.verbose && buildResult.output) {
          this.cli.newline();
          this.cli.subtitle('📝 Build Output:');
          console.log(buildResult.output);
        }

        process.exit(1);
      }

    } catch (error) {
      this.cli.error(`Build failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export class DeployCommand implements CLICommand {
  name = 'deploy';
  description = 'Deploy the project to a target environment';
  
  constructor(
    private cli: CLIInterface,
    private projectManager: ProjectManagerImpl,
    private logger: Logger
  ) {}

  options = [
    {
      name: 'target',
      alias: 't',
      description: 'Deployment target',
      type: 'string' as const,
      required: true
    },
    {
      name: 'path',
      alias: 'p',
      description: 'Path to the project directory',
      type: 'string' as const,
      default: '.'
    },
    {
      name: 'force',
      alias: 'f',
      description: 'Force deployment without confirmation',
      type: 'boolean' as const,
      default: false
    },
    {
      name: 'dry-run',
      description: 'Show what would be deployed without actually deploying',
      type: 'boolean' as const,
      default: false
    }
  ];

  async handler(args: CommandArgs): Promise<void> {
    this.cli.title('🚀 AI Builder - Project Deployment');
    this.cli.newline();

    try {
      // Load project
      const project = await this.projectManager.loadProject(args.path);
      
      this.cli.info(`Deploying project: ${project.name}`);
      this.cli.info(`Target: ${args.target}`);
      this.cli.newline();

      // Find deployment target
      const target = project.config.deploy?.targets?.find(t => t.name === args.target);
      if (!target) {
        this.cli.error(`Deployment target '${args.target}' not found`);
        this.cli.info('Available targets:');
        project.config.deploy?.targets?.forEach(t => {
          this.cli.list([`  • ${t.name} (${t.type})`]);
        });
        return;
      }

      // Show deployment plan
      this.cli.subtitle('📋 Deployment Plan:');
      this.cli.table([{
        'Project': project.name,
        'Target': target.name,
        'Type': target.type,
        'Environment': target.environment,
        'Version': project.version
      }]);

      this.cli.newline();

      // Confirmation
      if (!args.force && !args.dryRun) {
        const confirmed = await this.cli.confirm(
          `Are you sure you want to deploy '${project.name}' to '${args.target}' (${target.environment})?`
        );
        
        if (!confirmed) {
          this.cli.info('Deployment cancelled');
          return;
        }
      }

      if (args.dryRun) {
        this.cli.info('🔍 Dry run mode - no actual deployment will be performed');
        this.cli.newline();
        this.cli.subtitle('📋 Deployment Summary:');
        this.cli.list([
          `• Project: ${project.name}`,
          `• Target: ${target.name} (${target.type})`,
          `• Environment: ${target.environment}`,
          `• Version: ${project.version}`,
          `• Build command: ${project.config.build.command}`,
          `• Output directory: ${project.config.build.outputDir}`
        ]);
        return;
      }

      // Build project first
      this.cli.info('🔨 Building project before deployment...');
      const buildResult = await this.projectManager.buildProject(project);
      
      if (!buildResult.success) {
        this.cli.error('Build failed - deployment aborted');
        return;
      }

      this.cli.success('Build completed successfully');

      // Deploy (placeholder for actual deployment logic)
      const progress = this.cli.createProgressIndicator();
      progress.start(`Deploying to ${target.name}...`);

      // TODO: Implement actual deployment logic
      await this.simulateDeployment(target, project);

      progress.success(`Deployment to '${target.name}' completed successfully!`);
      this.cli.newline();

      this.cli.subtitle('🎉 Deployment Results:');
      this.cli.table([{
        'Status': '✅ Success',
        'Target': target.name,
        'Environment': target.environment,
        'Version': project.version,
        'Deployed At': new Date().toLocaleString()
      }]);

      this.cli.newline();
      this.cli.info('📊 Next steps:');
      this.cli.list([
        'ai-builder status',
        'ai-builder logs',
        'ai-builder rollback <version>'
      ]);

    } catch (error) {
      this.cli.error(`Deployment failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private async simulateDeployment(target: any, project: Project): Promise<void> {
    // Simulate deployment delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // This would be replaced with actual deployment logic
    this.logger.info(`Simulating deployment to ${target.name} (${target.type})`);
  }
}

export class StatusCommand implements CLICommand {
  name = 'status';
  description = 'Show the status of projects and deployments';
  
  constructor(
    private cli: CLIInterface,
    private projectManager: ProjectManagerImpl,
    private logger: Logger
  ) {}

  options = [
    {
      name: 'project',
      alias: 'p',
      description: 'Show status for specific project',
      type: 'string' as const
    },
    {
      name: 'deployments',
      alias: 'd',
      description: 'Show deployment history',
      type: 'boolean' as const,
      default: false
    }
  ];

  async handler(args: CommandArgs): Promise<void> {
    this.cli.title('📊 AI Builder - Status Overview');
    this.cli.newline();

    try {
      if (args.project) {
        // Show status for specific project
        const project = await this.projectManager.loadProject(args.project);
        await this.showProjectStatus(project, args.deployments);
      } else {
        // Show status for all projects
        const projects = await this.projectManager.listProjects();
        await this.showAllProjectsStatus(projects, args.deployments);
      }

    } catch (error) {
      this.cli.error(`Failed to get status: ${(error as Error).message}`);
      throw error;
    }
  }

  private async showProjectStatus(project: Project, showDeployments: boolean): Promise<void> {
    this.cli.subtitle(`📁 Project: ${project.name}`);
    this.cli.table([{
      'Name': project.name,
      'Template': project.template,
      'Version': project.version,
      'Path': project.path,
      'Created': project.createdAt.toLocaleString(),
      'Updated': project.updatedAt.toLocaleString()
    }]);

    // Show validation status
    const validation = await this.projectManager.validateProject(project);
    this.cli.newline();
    this.cli.subtitle('✅ Validation Status:');
    this.cli.info(`Status: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (validation.errors.length > 0) {
      this.cli.error('Errors:');
      validation.errors.forEach(error => {
        this.cli.list([`  ✗ ${error.message}`]);
      });
    }

    if (validation.warnings.length > 0) {
      this.cli.warning('Warnings:');
      validation.warnings.forEach(warning => {
        this.cli.list([`  ⚠ ${warning.message}`]);
      });
    }

    // Show deployment targets
    this.cli.newline();
    this.cli.subtitle('🎯 Deployment Targets:');
    if (project.config.deploy?.targets && project.config.deploy.targets.length > 0) {
      project.config.deploy.targets.forEach(target => {
        this.cli.list([`  • ${target.name} (${target.type} - ${target.environment})`]);
      });
    } else {
      this.cli.info('No deployment targets configured');
    }

    // Show deployment history
    if (showDeployments && project.deployments.length > 0) {
      this.cli.newline();
      this.cli.subtitle('📜 Deployment History:');
      const deploymentData = project.deployments.map(deployment => ({
        'ID': deployment.id.substring(0, 8),
        'Target': deployment.target.name,
        'Version': deployment.version,
        'Status': this.formatDeploymentStatus(deployment.status),
        'Created': deployment.createdAt.toLocaleString(),
        'Duration': deployment.completedAt 
          ? `${deployment.completedAt.getTime() - deployment.createdAt.getTime()}ms`
          : 'In progress'
      }));
      this.cli.table(deploymentData);
    }
  }

  private async showAllProjectsStatus(projects: Project[], showDeployments: boolean): Promise<void> {
    if (projects.length === 0) {
      this.cli.info('No projects found');
      return;
    }

    this.cli.subtitle(`📁 All Projects (${projects.length})`);
    
    const projectData = await Promise.all(projects.map(async project => {
      const validation = await this.projectManager.validateProject(project);
      return {
        'Name': project.name,
        'Template': project.template,
        'Version': project.version,
        'Status': validation.valid ? '✅ Valid' : '❌ Invalid',
        'Deployments': project.deployments.length,
        'Updated': project.updatedAt.toLocaleDateString()
      };
    }));

    this.cli.table(projectData);

    if (showDeployments) {
      this.cli.newline();
      this.cli.subtitle('📜 Recent Deployments:');
      
      const allDeployments = projects
        .flatMap(p => p.deployments)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

      if (allDeployments.length > 0) {
        const deploymentData = allDeployments.map(deployment => ({
          'Project': deployment.projectId.substring(0, 8),
          'Target': deployment.target.name,
          'Status': this.formatDeploymentStatus(deployment.status),
          'Created': deployment.createdAt.toLocaleString()
        }));
        this.cli.table(deploymentData);
      } else {
        this.cli.info('No deployments found');
      }
    }
  }

  private formatDeploymentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '⏳ Pending',
      'building': '🔨 Building',
      'deploying': '🚀 Deploying',
      'success': '✅ Success',
      'failed': '❌ Failed',
      'rolling_back': '🔄 Rolling Back',
      'rolled_back': '↩️ Rolled Back'
    };
    return statusMap[status] || status;
  }
}

// Additional commands: logs, rollback, config, templates (basic/stub implementations)
export class LogsCommand implements CLICommand {
  name = 'logs';
  description = 'View deployment logs for a deployment or project';

  constructor(
    private cli: CLIInterface,
    private deploymentEngine: any,
    private projectManager: ProjectManagerImpl,
    private logger: any
  ) {}

  options = [
    {
      name: 'deployment',
      alias: 'd',
      description: 'Deployment ID to show logs for',
      type: 'string' as const
    },
    {
      name: 'project',
      alias: 'p',
      description: 'Project path to show deployment history logs for',
      type: 'string' as const
    }
  ];

  async handler(args: any): Promise<void> {
    try {
      if (args.deployment) {
        const active = this.deploymentEngine.getActiveDeployments();
        let dep = active.find((d: any) => d.id === args.deployment);
        if (!dep) {
          // try persisted store
          dep = await this.deploymentEngine.getPersistedDeployment(args.deployment) as any;
        }

        if (!dep) {
          this.cli.error(`Deployment '${args.deployment}' not found`);
          return;
        }

        const logs = await this.deploymentEngine.getLogs(dep as any);
        this.cli.title(`📜 Logs for deployment ${dep.id}`);
        logs.forEach((l: any) => {
          console.log(`[${l.timestamp.toISOString()}] ${l.level.toUpperCase()} ${l.source}: ${l.message}`);
        });
        return;
      }

      if (args.project) {
        const project = await this.projectManager.loadProject(args.project);
        if (!project.deployments || project.deployments.length === 0) {
          this.cli.info('No deployments found for project');
          return;
        }

        for (const dep of project.deployments) {
          this.cli.title(`📜 Logs for deployment ${dep.id}`);
          const logs = dep.logs || [];
          logs.forEach((l: any) => {
            console.log(`[${new Date(l.timestamp).toISOString()}] ${l.level.toUpperCase()} ${l.source}: ${l.message}`);
          });
          this.cli.divider();
        }
        return;
      }

      this.cli.info('Please specify --deployment <id> or --project <path>');

    } catch (error) {
      this.cli.error(`Failed to retrieve logs: ${(error as Error).message}`);
      throw error;
    }
  }
}

export class RollbackCommand implements CLICommand {
  name = 'rollback';
  description = 'Rollback a deployment to a previous version';

  constructor(
    private cli: CLIInterface,
    private deploymentEngine: any,
    private projectManager: ProjectManagerImpl,
    private logger: any
  ) {}

  options = [
    {
      name: 'deployment',
      alias: 'd',
      description: 'Deployment ID to rollback',
      type: 'string' as const,
      required: true
    },
    {
      name: 'version',
      alias: 'v',
      description: 'Target version to rollback to',
      type: 'string' as const,
      required: true
    }
  ];

  async handler(args: any): Promise<void> {
    try {
      const active = this.deploymentEngine.getActiveDeployments();
      let dep = active.find((d: any) => d.id === args.deployment);
      if (!dep) {
        // try persisted store
        dep = await this.deploymentEngine.getPersistedDeployment(args.deployment) as any;
      }

      if (!dep) {
        this.cli.error(`Deployment '${args.deployment}' not found`);
        return;
      }

      this.cli.info(`Rolling back deployment ${dep.id} to version ${args.version}...`);
      await this.deploymentEngine.rollback(dep as any, args.version);
      this.cli.success(`Rollback completed for deployment ${dep.id}`);

    } catch (error) {
      this.cli.error(`Rollback failed: ${(error as Error).message}`);
      throw error;
    }
  }
}

export class ConfigCommand implements CLICommand {
  name = 'config';
  description = 'Manage configuration values (get|set|list|delete)';

  constructor(
    private cli: CLIInterface,
    private configManager: any,
    private logger: any
  ) {}

  options = [];

  subcommands = [
    {
      name: 'set',
      description: 'Set a configuration value',
      options: [
        { name: 'key', description: 'Config key', type: 'string', required: true },
        { name: 'value', description: 'Config value', type: 'string', required: true },
        { name: 'scope', description: 'Scope (global|project)', type: 'string', default: 'global' }
      ],
      handler: async (args: any) => {
        await this.configManager.set(args.key, args.value, args.scope);
        this.cli.success(`Config '${args.key}' set (${args.scope})`);
      }
    },
    {
      name: 'get',
      description: 'Get a configuration value',
      options: [
        { name: 'key', description: 'Config key', type: 'string', required: true },
        { name: 'scope', description: 'Scope (global|project)', type: 'string', default: 'global' }
      ],
      handler: async (args: any) => {
        const value = await this.configManager.get(args.key, args.scope);
        if (value === undefined) {
          this.cli.info('Key not found');
        } else {
          this.cli.json({ [args.key]: value });
        }
      }
    },
    {
      name: 'list',
      description: 'List configuration entries',
      options: [
        { name: 'scope', description: 'Scope (global|project)', type: 'string', default: 'global' }
      ],
      handler: async (args: any) => {
        const entries = await this.configManager.list(args.scope);
        this.cli.json(entries);
      }
    },
    {
      name: 'delete',
      description: 'Delete a config entry',
      options: [
        { name: 'key', description: 'Config key', type: 'string', required: true },
        { name: 'scope', description: 'Scope (global|project)', type: 'string', default: 'global' }
      ],
      handler: async (args: any) => {
        await this.configManager.delete(args.key, args.scope);
        this.cli.success(`Config '${args.key}' deleted (${args.scope})`);
      }
    }
  ];

  async handler(_: any): Promise<void> {
    this.cli.info('Use subcommands: set|get|list|delete');
  }
}

export class TemplatesCommand implements CLICommand {
  name = 'templates';
  description = 'List and manage templates';

  constructor(
    private cli: CLIInterface,
    private projectManager: ProjectManagerImpl,
    private logger: any
  ) {}

  options = [];

  subcommands = [
    {
      name: 'list',
      description: 'List available templates',
      options: [],
      handler: async (_args: any) => {
        // Return mock templates similar to InitCommand
        const templates = [
          { name: 'express-api', description: 'Express.js API with TypeScript' },
          { name: 'react-app', description: 'React application with Vite' },
          { name: 'fullstack-ai', description: 'Full-stack AI application' }
        ];
        this.cli.table(templates.map(t => ({ Name: t.name, Description: t.description })));
      }
    },
    {
      name: 'install',
      description: 'Install a template by name',
      options: [
        { name: 'name', description: 'Template name', type: 'string', required: true }
      ],
      handler: async (args: any) => {
        // Stub: pretend to install
        this.cli.info(`Installing template '${args.name}'...`);
        await new Promise(resolve => setTimeout(resolve, 500));
        this.cli.success(`Template '${args.name}' installed`);
      }
    }
  ];

  async handler(_: any): Promise<void> {
    this.cli.info('Use subcommands: list|install');
  }
}

export class DeploymentsCommand implements CLICommand {
  name = 'deployments';
  description = 'List persisted deployments';

  constructor(
    private cli: CLIInterface,
    private deploymentEngine: any,
    private logger: any
  ) {}

  options = [
    {
      name: 'project',
      alias: 'p',
      description: 'Filter deployments by projectId',
      type: 'string' as const
    }
  ];

  async handler(args: any): Promise<void> {
    try {
      const deployments = await this.deploymentEngine.listPersistedDeployments(args.project);
      if (!deployments || deployments.length === 0) {
        this.cli.info('No persisted deployments found');
        return;
      }

      const rows = deployments.map((d: any) => ({
        ID: d.id.substring(0, 12),
        Project: (d.projectId || '').substring(0, 12),
        Target: d.target?.name || d.target?.type || 'n/a',
        Version: d.version,
        Status: d.status,
        Created: d.createdAt ? new Date(d.createdAt).toLocaleString() : 'n/a'
      }));

      this.cli.table(rows);
    } catch (error) {
      this.cli.error(`Failed to list deployments: ${(error as Error).message}`);
      throw error;
    }
  }
}

export class MigrateCommand implements CLICommand {
  name = 'migrate';
  description = 'Migrate file-backed deployments into SQLite';

  constructor(
    private cli: CLIInterface,
    private logger: any
  ) {}

  options = [
    { name: 'apply', alias: 'a', description: 'Apply migration (default is dry-run)', type: 'boolean' as const, default: false },
    { name: 'source', description: 'Source directory for file deployments', type: 'string' as const },
    { name: 'target', description: 'Target sqlite file path', type: 'string' as const },
    { name: 'validate', description: 'Validate target sqlite after migration', type: 'boolean' as const, default: false },
    { name: 'rollback', description: 'Restore from .bak backup', type: 'boolean' as const, default: false }
  ];

  async handler(args: any): Promise<void> {
    try {
      const apply = !!args.apply;
      const source = args.source;
      const target = args.target;
      const validate = !!args.validate;

      const mgr = new MigrationManager(this.logger);
      mgr.on('progress', (s: any) => {
        this.cli.info(`Migrating ${s.file} (${s.id})`);
      });
      mgr.on('error', (e: any) => {
        this.cli.error(`Error migrating ${e.file}: ${e.error?.message || e.error}`);
      });

      if (validate) {
        const v = await mgr.validateMigration(target);
        if (v.valid) {
          this.cli.success(`Validation OK - ${v.total} deployments present`);
        } else {
          this.cli.error('Validation failed');
        }
        return;
      }

      if (args.rollback) {
        // create a timestamped pre-rollback backup for safety
        const pre = await mgr.createPreRollbackBackup(target);
        if (pre) this.cli.info(`Created pre-rollback backup: ${pre}`);

        const ok = await mgr.restoreBackup(target);
        if (ok) this.cli.success('Backup restored successfully');
        else this.cli.error('No backup restored');
        return;
      }

      const dryRun = !apply;
      const res = await mgr.migrateFileToSQLite({ dryRun, sourceDir: source, sqlitePath: target });
      this.cli.success(`Migration finished: ${res.migrated} migrated, ${res.skipped} skipped`);
    } catch (err) {
      this.cli.error(`Migration failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
