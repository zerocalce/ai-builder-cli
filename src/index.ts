#!/usr/bin/env node

import { CLIInterface } from './cli/interface';
import { Logger } from './utils/logger';
import { ConfigManager } from './core/config-manager';
import { ProjectManagerImpl } from './core/project-manager';
import { DeploymentEngineImpl } from './core/deployment-engine';
import { DeploymentPipeline } from './core/deployment-engine';

// Import commands
import { InitCommand } from './commands/core';
import { BuildCommand } from './commands/core';
import { DeployCommand } from './commands/core';
import { StatusCommand } from './commands/core';

async function main() {
  // Initialize logger
  const logger = new Logger({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'development' ? 'pretty' : 'json'
  });

  try {
    // Initialize core components
    const configManager = new ConfigManager(logger);
    const projectManager = new ProjectManagerImpl(logger);
    const deploymentEngine = new DeploymentEngineImpl(logger);
    const deploymentPipeline = new DeploymentPipeline(deploymentEngine, logger);
    const cli = new CLIInterface(logger);

    // Register commands
    cli.registerCommand(new InitCommand(cli, projectManager, logger));
    cli.registerCommand(new BuildCommand(cli, projectManager, logger));
    cli.registerCommand(new DeployCommand(cli, projectManager, logger));
    cli.registerCommand(new StatusCommand(cli, projectManager, logger));

    // Additional commands would be registered here
    // cli.registerCommand(new ConfigCommand(cli, configManager, logger));
    // cli.registerCommand(new TemplatesCommand(cli, projectManager, logger));
    // cli.registerCommand(new LogsCommand(cli, deploymentEngine, logger));
    // cli.registerCommand(new RollbackCommand(cli, deploymentEngine, logger));

    // Show welcome message for first-time users
    await showWelcomeIfNeeded(configManager, cli);

    // Execute CLI
    await cli.execute(process.argv);

  } catch (error) {
    logger.error('CLI execution failed', error as Error);
    process.exit(1);
  }
}

async function showWelcomeIfNeeded(configManager: ConfigManager, cli: CLIInterface): Promise<void> {
  const hasSeenWelcome = await configManager.get('welcome.shown');
  
  if (!hasSeenWelcome) {
    cli.title('🚀 Welcome to AI Builder!');
    cli.newline();
    
    cli.info('AI Builder is a comprehensive development platform that helps you:');
    cli.list([
      '📁 Create projects from templates',
      '🔨 Build applications automatically',
      '🚀 Deploy to multiple environments',
      '📊 Monitor deployment status',
      '🔄 Rollback failed deployments',
      '💾 Manage built-in databases',
      '💬 Get AI assistance via chat'
    ]);
    
    cli.newline();
    cli.subtitle('Quick Start:');
    cli.list([
      'ai-builder init express-api my-api',
      'cd my-api',
      'ai-builder build',
      'ai-builder deploy local'
    ]);
    
    cli.newline();
    cli.info('Run "ai-builder --help" to see all available commands');
    cli.newline();
    
    await configManager.set('welcome.shown', true);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
