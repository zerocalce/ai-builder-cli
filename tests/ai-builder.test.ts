import { ProjectManagerImpl } from '../src/core/project-manager';
import { DeploymentEngineImpl } from '../src/core/deployment-engine';
import { ConfigManagerImpl } from '../src/core/config-manager';
import { Logger } from '../src/utils/logger';
import { CLIInterface } from '../src/cli/interface';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('AI Builder Core Components', () => {
  let logger: Logger;
  let configManager: ConfigManagerImpl;
  let projectManager: ProjectManagerImpl;
  let deploymentEngine: DeploymentEngineImpl;
  let cli: CLIInterface;
  let testDir: string;

  beforeEach(async () => {
    // Setup test environment
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-builder-test-'));
    logger = new Logger({ level: 'debug', format: 'pretty' });
    configManager = new ConfigManagerImpl(logger, testDir);
    projectManager = new ProjectManagerImpl(logger, testDir);
    deploymentEngine = new DeploymentEngineImpl(logger);
    cli = new CLIInterface(logger);
  });

  afterEach(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('ProjectManager', () => {
    describe('createProject', () => {
      it('should create a new project from template', async () => {
        const projectName = 'test-project';
        const template = 'express-api';
        
        // Create a mock template
        await createMockTemplate(template, testDir);
        
        const project = await projectManager.createProject(template, projectName, testDir);
        
        expect(project).toBeDefined();
        expect(project.name).toBe(projectName);
        expect(project.template).toBe(template);
        expect(project.version).toBe('1.0.0');
        expect(project.id).toBeDefined();
        expect(project.path).toBe(path.join(testDir, projectName));
        
        // Check if project directory was created
        const projectPath = path.join(testDir, projectName);
        expect(fs.existsSync(projectPath)).toBe(true);
        
        // Check if project metadata was saved
        const metadataPath = path.join(projectPath, '.ai-builder', 'project.json');
        expect(fs.existsSync(metadataPath)).toBe(true);
      });

      it('should throw error for invalid project name', async () => {
        await expect(
          projectManager.createProject('express-api', 'invalid name!', testDir)
        ).rejects.toThrow('Invalid project name');
      });

      it('should throw error if directory already exists', async () => {
        const projectName = 'existing-project';
        const projectPath = path.join(testDir, projectName);
        
        await fs.promises.mkdir(projectPath, { recursive: true });
        
        await expect(
          projectManager.createProject('express-api', projectName, testDir)
        ).rejects.toThrow('Directory already exists');
      });
    });

    describe('buildProject', () => {
      it('should build a project successfully', async () => {
        const project = await createMockProject('test-build-project', testDir, projectManager);
        
        const buildResult = await projectManager.buildProject(project);
        
        expect(buildResult.success).toBe(true);
        expect(buildResult.duration).toBeGreaterThan(0);
        expect(buildResult.artifacts).toBeDefined();
      });
    });

    describe('validateProject', () => {
      it('should validate a valid project', async () => {
        const project = await createMockProject('valid-project', testDir, projectManager);
        
        const result = await projectManager.validateProject(project);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing build configuration', async () => {
        const project = await createMockProject('invalid-project', testDir, projectManager);
        delete project.config.build;
        
        const result = await projectManager.validateProject(project);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.code === 'MISSING_BUILD_CONFIG')).toBe(true);
      });
    });

    describe('listProjects', () => {
      it('should list all projects', async () => {
        await createMockProject('project-1', testDir, projectManager);
        await createMockProject('project-2', testDir, projectManager);
        
        const projects = await projectManager.listProjects();
        
        expect(projects).toHaveLength(2);
        expect(projects.map(p => p.name)).toContain('project-1');
        expect(projects.map(p => p.name)).toContain('project-2');
      });

      it('should return empty list when no projects exist', async () => {
        const projects = await projectManager.listProjects();
        
        expect(projects).toHaveLength(0);
      });
    });
  });

  describe('DeploymentEngine', () => {
    describe('deploy', () => {
      it('should deploy a project successfully', async () => {
        const project = await createMockProject('deploy-test', testDir, projectManager);
        const target = createMockDeploymentTarget('local');
        
        const deployment = await deploymentEngine.deploy(project, target);
        
        expect(deployment).toBeDefined();
        expect(deployment.projectId).toBe(project.id);
        expect(deployment.target.name).toBe('local');
        expect(deployment.status).toBe('success');
        expect(deployment.buildResult).toBeDefined();
      });

      it('should handle deployment failures', async () => {
        const project = await createMockProject('fail-deploy', testDir, projectManager);
        const target = createMockDeploymentTarget('aws');
        
        // Mock a failed deployment
        jest.spyOn(deploymentEngine as any, 'buildProject').mockRejectedValueOnce(new Error('Build failed'));
        
        await expect(deploymentEngine.deploy(project, target)).rejects.toThrow('Build failed');
      });
    });

    describe('rollback', () => {
      it('should rollback a deployment', async () => {
        const project = await createMockProject('rollback-test', testDir, projectManager);
        const target = createMockDeploymentTarget('local');
        const deployment = await deploymentEngine.deploy(project, target);
        
        await deploymentEngine.rollback(deployment, '1.0.0');
        
        // Verify rollback was initiated
        expect(deployment.status).toBe('rolled_back');
      });
    });
  });

  describe('ConfigManager', () => {
    describe('set and get', () => {
      it('should store and retrieve configuration values', async () => {
        await configManager.set('test.key', 'test-value');
        
        const value = await configManager.get('test.key');
        
        expect(value).toBe('test-value');
      });

      it('should handle encrypted values', async () => {
        await configManager.set('secret.password', 'super-secret');
        
        const value = await configManager.get('secret.password');
        
        expect(value).toBe('super-secret');
      });

      it('should return undefined for non-existent keys', async () => {
        const value = await configManager.get('non.existent.key');
        
        expect(value).toBeUndefined();
      });
    });

    describe('list', () => {
      it('should list all configuration entries', async () => {
        await configManager.set('key1', 'value1');
        await configManager.set('key2', 'value2');
        
        const entries = await configManager.list();
        
        expect(entries).toHaveLength(2);
        expect(entries.map(e => e.key)).toContain('key1');
        expect(entries.map(e => e.key)).toContain('key2');
      });
    });

    describe('delete', () => {
      it('should delete configuration entries', async () => {
        await configManager.set('delete.me', 'value');
        await configManager.delete('delete.me');
        
        const value = await configManager.get('delete.me');
        
        expect(value).toBeUndefined();
      });
    });
  });

  describe('CLI Integration', () => {
    describe('command registration', () => {
      it('should register and execute commands', async () => {
        const mockCommand = {
          name: 'test',
          description: 'Test command',
          options: [],
          handler: jest.fn().mockResolvedValue(undefined)
        };
        
        cli.registerCommand(mockCommand);
        
        // Verify command was registered
        expect(cli['commands'].has('test')).toBe(true);
      });
    });
  });
});

describe('AI Builder Integration Tests', () => {
  let logger: Logger;
  let configManager: ConfigManagerImpl;
  let projectManager: ProjectManagerImpl;
  let deploymentEngine: DeploymentEngineImpl;
  let testDir: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-builder-integration-test-'));
    logger = new Logger({ level: 'debug', format: 'pretty' });
    configManager = new ConfigManagerImpl(logger, testDir);
    projectManager = new ProjectManagerImpl(logger, testDir);
    deploymentEngine = new DeploymentEngineImpl(logger);
  });

  afterEach(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full project lifecycle', async () => {
      // 1. Create project
      await createMockTemplate('express-api', testDir);
      const project = await projectManager.createProject('express-api', 'my-app', testDir);
      
      expect(project.name).toBe('my-app');
      
      // 2. Build project
      const buildResult = await projectManager.buildProject(project);
      expect(buildResult.success).toBe(true);
      
      // 3. Deploy project
      const target = createMockDeploymentTarget('local');
      const deployment = await deploymentEngine.deploy(project, target);
      expect(deployment.status).toBe('success');
      
      // 4. Check deployment status
      const status = await deploymentEngine.getStatus(deployment);
      expect(status).toBe('success');
      
      // 5. Rollback deployment
      await deploymentEngine.rollback(deployment, '1.0.0');
      expect(deployment.status).toBe('rolled_back');
    });
  });

  describe('Error Handling', () => {
    it('should handle build failures gracefully', async () => {
      const project = await createMockProject('error-test', testDir, projectManager);
      
      // Mock build failure
      jest.spyOn(projectManager as any, 'executeCommand').mockRejectedValueOnce(new Error('Build command failed'));
      
      const buildResult = await projectManager.buildProject(project);
      
      expect(buildResult.success).toBe(false);
      expect(buildResult.error).toBe('Build command failed');
    });

    it('should handle deployment failures gracefully', async () => {
      const project = await createMockProject('deploy-error', testDir, projectManager);
      const target = createMockDeploymentTarget('aws');
      
      // Mock deployment failure
      const mockProvider = {
        name: 'mock-aws',
        type: 'aws' as const,
        deploy: jest.fn().mockRejectedValue(new Error('Deployment failed')),
        getStatus: jest.fn(),
        rollback: jest.fn(),
        listDeployments: jest.fn()
      };
      
      deploymentEngine['cloudProviders'].set('aws', mockProvider);
      
      await expect(deploymentEngine.deploy(project, target)).rejects.toThrow('Deployment failed');
    });
  });
});

// Helper functions
async function createMockTemplate(name: string, testDir: string): Promise<void> {
  const templateDir = path.join(testDir, 'templates', name);
  await fs.promises.mkdir(templateDir, { recursive: true });
  
  const templateConfig = {
    name,
    version: '1.0.0',
    description: `Mock ${name} template`,
    category: 'test',
    tags: ['test'],
    config: {
      build: {
        command: 'npm run build',
        outputDir: 'dist',
        environment: {},
        dependencies: [],
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
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name: '{{name}}',
          version: '1.0.0',
          scripts: {
            build: 'echo "Building..."'
          }
        }),
        template: true
      },
      {
        path: 'src/index.js',
        content: 'console.log("Hello World");',
        template: false
      }
    ]
  };
  
  await fs.promises.writeFile(path.join(templateDir, 'template.json'), JSON.stringify(templateConfig));
  
  const filesDir = path.join(templateDir, 'files');
  await fs.promises.mkdir(filesDir, { recursive: true });
  
  for (const file of templateConfig.files) {
    await fs.promises.writeFile(path.join(filesDir, file.path), file.content);
  }
}

async function createMockProject(name: string, testDir: string, pm: ProjectManagerImpl): Promise<any> {
  await createMockTemplate('express-api', testDir);
  
  const project = await pm.createProject('express-api', name, testDir);
  
  // Add deployment target
  project.config.deploy = {
    targets: [createMockDeploymentTarget('local')],
    healthCheck: {
      endpoint: '/health',
      interval: 30000,
      timeout: 5000,
      retries: 3
    }
  };
  
  return project;
}

function createMockDeploymentTarget(type: string): any {
  return {
    name: type,
    type,
    config: {
      host: 'localhost',
      port: type === 'docker' ? 8080 : 3000
    },
    environment: 'development'
  };
}
