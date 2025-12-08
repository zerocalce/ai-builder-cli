#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const interface_1 = require("./cli/interface");
const logger_1 = require("./utils/logger");
const config_manager_1 = require("./core/config-manager");
const project_manager_1 = require("./core/project-manager");
const deployment_engine_1 = require("./core/deployment-engine");
const deployment_engine_2 = require("./core/deployment-engine");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Import commands
const core_1 = require("./commands/core");
const core_2 = require("./commands/core");
const core_3 = require("./commands/core");
const core_4 = require("./commands/core");
const core_5 = require("./commands/core");
const core_6 = require("./commands/core");
const core_7 = require("./commands/core");
const core_8 = require("./commands/core");
const core_9 = require("./commands/core");
const core_10 = require("./commands/core");
class AutoBootstrap {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.requiredFiles = [
            'package.json',
            'tsconfig.json',
            'node_modules'
        ];
    }
    // Check if setup is needed
    needsSetup() {
        return !this.requiredFiles.every(file => fs.existsSync(path.join(this.projectRoot, file)));
    }
    // Run setup if needed
    async ensureSetup() {
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
                    setup.on('close', (code) => {
                        if (code === 0) {
                            resolve();
                        }
                        else {
                            reject(new Error(`Setup failed with code ${code}`));
                        }
                    });
                    setup.on('error', reject);
                });
            }
            catch (error) {
                console.log('❌ Setup failed:', error.message);
                process.exit(1);
            }
        }
    }
    // Check Node.js and npm availability
    async checkPrerequisites() {
        try {
            const { exec } = require('child_process');
            // Check Node.js
            await new Promise((resolve, reject) => {
                exec('node --version', (error, stdout) => {
                    if (error) {
                        console.log('❌ Node.js not found. Please install Node.js from https://nodejs.org');
                        reject(error);
                    }
                    else {
                        console.log(`✅ Node.js: ${stdout.trim()}`);
                        resolve(stdout);
                    }
                });
            });
            // Check npm
            await new Promise((resolve, reject) => {
                exec('npm --version', (error, stdout) => {
                    if (error) {
                        console.log('❌ npm not found. Please install npm');
                        reject(error);
                    }
                    else {
                        console.log(`✅ npm: ${stdout.trim()}`);
                        resolve(stdout);
                    }
                });
            });
        }
        catch (error) {
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
    const logger = new logger_1.Logger({
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.NODE_ENV === 'development' ? 'pretty' : 'json'
    });
    try {
        // Initialize core components
        const configManager = new config_manager_1.ConfigManagerImpl(logger);
        const projectManager = new project_manager_1.ProjectManagerImpl(logger);
        const deploymentEngine = new deployment_engine_1.DeploymentEngineImpl(logger);
        const deploymentPipeline = new deployment_engine_2.DeploymentPipeline(deploymentEngine, logger);
        const cli = new interface_1.CLIInterface(logger);
        // Register commands
        cli.registerCommand(new core_1.InitCommand(cli, projectManager, logger));
        cli.registerCommand(new core_2.BuildCommand(cli, projectManager, logger));
        cli.registerCommand(new core_3.DeployCommand(cli, projectManager, logger));
        cli.registerCommand(new core_4.StatusCommand(cli, projectManager, logger));
        // Additional commands would be registered here
        // cli.registerCommand(new ConfigCommand(cli, configManager, logger));
        // cli.registerCommand(new TemplatesCommand(cli, projectManager, logger));
        // cli.registerCommand(new LogsCommand(cli, deploymentEngine, logger));
        // cli.registerCommand(new RollbackCommand(cli, deploymentEngine, logger));
        // Register newly implemented commands
        cli.registerCommand(new core_5.ConfigCommand(cli, configManager, logger));
        cli.registerCommand(new core_6.TemplatesCommand(cli, projectManager, logger));
        cli.registerCommand(new core_7.LogsCommand(cli, deploymentEngine, projectManager, logger));
        cli.registerCommand(new core_8.RollbackCommand(cli, deploymentEngine, projectManager, logger));
        cli.registerCommand(new core_9.DeploymentsCommand(cli, deploymentEngine, logger));
        cli.registerCommand(new core_10.MigrateCommand(cli, logger));
        // Show welcome message for first-time users
        await showWelcomeIfNeeded(configManager, cli);
        // Execute CLI
        await cli.execute(process.argv);
    }
    catch (error) {
        logger.error('CLI execution failed', error);
        process.exit(1);
    }
}
async function showWelcomeIfNeeded(configManager, cli) {
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
