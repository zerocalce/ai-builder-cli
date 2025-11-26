#!/usr/bin/env node

import { CLIInterface } from './cli/interface';
import { Logger } from './utils/logger';
import { ConfigManagerImpl } from './core/config-manager';
import { ProjectManagerImpl } from './core/project-manager';
import { DeploymentEngineImpl } from './core/deployment-engine';
import { DeploymentPipeline } from './core/deployment-engine';
import * as fs from 'fs';
import * as path from 'path';

// Import commands
import { InitCommand } from './commands/core';
import { BuildCommand } from './commands/core';
import { DeployCommand } from './commands/core';
import { StatusCommand } from './commands/core';
import { ConfigCommand } from './commands/core';
import { TemplatesCommand } from './commands/core';
import { LogsCommand } from './commands/core';
import { RollbackCommand } from './commands/core';

class AutoBootstrap {
  private projectRoot: string;
  private requiredFiles: string[];

  constructor() {
    this.projectRoot = path.join(__dirname, '..');
    this.requiredFiles = [
      'package.json',
      'tsconfig.json',
      'node_modules'
    ];
  }

  // Check if setup is needed
  needsSetup(): boolean {
    return !this.requiredFiles.every(file => 
      fs.existsSync(path.join(this.projectRoot, file))
    );
  }

  // Run setup if needed
  async ensureSetup(): Promise<void> {
    if (this.needsSetup()) {
      console.log('🔧 Running initial setup...');
      
      try {
        // Run the setup script
        const { spawn } = require('child_process');
        
        const setup = spawn('node', [path.join(this.projectRoot, 'setup.js')], {
          stdio: 'inherit',
          cwd: this.projectRoot
        });

        return new Promise((resolve, reject) => {
          setup.on('close', (code: number) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Setup failed with code ${code}`));
            }
          });

          setup.on('error', reject);
        });
      } catch (error) {
        console.log('❌ Setup failed:', (error as Error).message);
        process.exit(1);
      }
    }
  }

  // Check Node.js and npm availability
  async checkPrerequisites(): Promise<void> {
    try {
      const { exec } = require('child_process');
      
      // Check Node.js
      await new Promise((resolve, reject) => {
        exec('node --version', (error: any, stdout: string) => {
          if (error) {
            console.log('❌ Node.js not found. Please install Node.js from https://nodejs.org');
            reject(error);
          } else {
            console.log(`✅ Node.js: ${stdout.trim()}`);
            resolve(stdout);
          }
        });
      });

      // Check npm
      await new Promise((resolve, reject) => {
        exec('npm --version', (error: any, stdout: string) => {
          if (error) {
            console.log('❌ npm not found. Please install npm');
            reject(error);
          } else {
            console.log(`✅ npm: ${stdout.trim()}`);
            resolve(stdout);
          }
        });
      });

    } catch (error) {
      console.log('❌ Prerequisites check failed');
      process.exit(1);
    }
  }
}

async function main() {
  // Auto-bootstrap first
  const bootstrap = new AutoBootstrap();
  
  // Check prerequisites
  await bootstrap.checkPrerequisites();
  
  // Ensure setup is complete
  await bootstrap.ensureSetup();

  // Initialize logger
  const logger = new Logger({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'development' ? 'pretty' : 'json'
  });

  try {
    // Initialize core components
    const configManager = new ConfigManagerImpl(logger);
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
    // Register newly implemented commands
    cli.registerCommand(new ConfigCommand(cli, configManager, logger));
    cli.registerCommand(new TemplatesCommand(cli, projectManager, logger));
    cli.registerCommand(new LogsCommand(cli, deploymentEngine, projectManager, logger));
    cli.registerCommand(new RollbackCommand(cli, deploymentEngine, projectManager, logger));

    // Show welcome message for first-time users
    await showWelcomeIfNeeded(configManager, cli);

    // Execute CLI
    await cli.execute(process.argv);

  } catch (error) {
    logger.error('CLI execution failed', error as Error);
    process.exit(1);
  }
}

async function showWelcomeIfNeeded(configManager: ConfigManagerImpl, cli: CLIInterface): Promise<void> {
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
