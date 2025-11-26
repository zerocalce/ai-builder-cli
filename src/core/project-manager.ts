import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import Handlebars from 'handlebars';
import { Project, ProjectManager, BuildResult, ValidationResult, Template, Logger, ValidationError, ValidationWarning } from '../types';

export class ProjectManagerImpl implements ProjectManager {
  private projectsDir: string;
  private templatesDir: string;
  private logger: Logger;

  constructor(logger: Logger, dataDir?: string) {
    this.logger = logger;
    this.projectsDir = path.join(dataDir || path.join(os.homedir(), '.ai-builder'), 'projects');
    // If a dataDir is provided (e.g. during tests), load templates from there
    this.templatesDir = dataDir ? path.join(dataDir, 'templates') : path.join(__dirname, '../../templates');
    
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.projectsDir);
    await fs.ensureDir(this.templatesDir);
  }

  async createProject(templateName: string, name: string, projectPath: string): Promise<Project> {
    this.logger.info(`Creating project '${name}' from template '${templateName}' at '${projectPath}'`);
    
    // Validate project name
    if (!this.isValidProjectName(name)) {
      throw new Error(`Invalid project name: '${name}'. Project names must contain only letters, numbers, hyphens, and underscores.`);
    }

    // Check if project already exists
    const targetPath = path.resolve(projectPath, name);
    if (await fs.pathExists(targetPath)) {
      throw new Error(`Directory already exists: '${targetPath}'`);
    }

    // Load template
    const template = await this.loadTemplate(templateName);
    
    // Create project structure
    await fs.ensureDir(targetPath);
    
    const project: Project = {
      id: uuidv4(),
      name,
      template: templateName,
      version: '1.0.0',
      config: {
        build: template.config.build,
        deploy: template.config.deploy,
        environment: { variables: {}, secrets: {} }
      } as any,
      deployments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      path: targetPath
    };

    // Process template variables
    const variables = await this.promptTemplateVariables(template);
    
    // Create project files
    await this.createProjectFiles(template, targetPath, variables);
    
    // Save project metadata
    await this.saveProjectMetadata(project);
    
    this.logger.info(`Project '${name}' created successfully at '${targetPath}'`);
    return project;
  }

  private isValidProjectName(name: string): boolean {
    return /^[a-zA-Z0-9-_]+$/.test(name) && name.length > 0 && name.length <= 50;
  }

  private async loadTemplate(name: string): Promise<Template> {
    const templatePath = path.join(this.templatesDir, name);
    const configPath = path.join(templatePath, 'template.json');
    
    if (!await fs.pathExists(templatePath)) {
      throw new Error(`Template '${name}' not found at '${templatePath}'`);
    }

    if (!await fs.pathExists(configPath)) {
      throw new Error(`Template configuration not found at '${configPath}'`);
    }

    const config = await fs.readJson(configPath);
    const filesPath = path.join(templatePath, 'files');
    
    // Load template files
    const files: any[] = [];
    if (await fs.pathExists(filesPath)) {
      await this.collectTemplateFiles(filesPath, '', files);
    }

    return {
      ...config,
      files
    };
  }

  private async collectTemplateFiles(basePath: string, relativePath: string, files: any[]): Promise<void> {
    const currentPath = path.join(basePath, relativePath);
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await this.collectTemplateFiles(basePath, entryRelativePath, files);
      } else {
        const content = await fs.readFile(entryPath, 'utf-8');
        const isTemplate = entry.name.endsWith('.hbs') || entry.name.endsWith('.handlebars');
        
        files.push({
          path: entryRelativePath,
          content,
          template: isTemplate
        });
      }
    }
  }

  private async promptTemplateVariables(template: Template): Promise<Record<string, any>> {
    const inquirer = require('inquirer');
    const variables: Record<string, any> = {};

    if (!template.config.variables) {
      return variables;
    }

    for (const variable of template.config.variables) {
      const question: any = {
        name: variable.name,
        message: variable.description,
        default: variable.default
      };

      switch (variable.type) {
        case 'string':
          question.type = 'input';
          break;
        case 'number':
          question.type = 'number';
          break;
        case 'boolean':
          question.type = 'confirm';
          break;
        case 'choice':
          question.type = 'list';
          question.choices = variable.choices;
          break;
      }

      if (variable.required && !variable.default) {
        question.validate = (input: any) => {
          if (!input) {
            return `${variable.description} is required`;
          }
          return true;
        };
      }

      const answer = await inquirer.prompt([question]);
      variables[variable.name] = answer[variable.name];
    }

    return variables;
  }

  private async createProjectFiles(template: Template, targetPath: string, variables: Record<string, any>): Promise<void> {
    for (const file of template.files) {
      let filePath = path.join(targetPath, file.path);
      const dirPath = path.dirname(filePath);
      
      await fs.ensureDir(dirPath);

      let content = file.content;
      
      // Process template files
      if (file.template) {
        const compiledTemplate = Handlebars.compile(content);
        content = compiledTemplate(variables);

        // Remove .hbs or .handlebars extension
        if (file.path.endsWith('.hbs')) {
          filePath = filePath.slice(0, -4);
        } else if (file.path.endsWith('.handlebars')) {
          filePath = filePath.slice(0, -11);
        }
      }

      await fs.writeFile(filePath, content, 'utf-8');
    }
  }

  private async saveProjectMetadata(project: Project): Promise<void> {
    const metadataPath = path.join(project.path, '.ai-builder', 'project.json');
    await fs.ensureDir(path.dirname(metadataPath));
    await fs.writeJson(metadataPath, project, { spaces: 2 });
  }

  async buildProject(project: Project): Promise<BuildResult> {
    this.logger.info(`Building project '${project.name}'`);
    
    const startTime = Date.now();
    const buildConfig = project.config.build;
    
    let originalCwd = process.cwd();
    try {
      // Change to project directory
      originalCwd = process.cwd();
      process.chdir(project.path);

      // Install dependencies
      if (buildConfig.dependencies && buildConfig.dependencies.length > 0) {
        this.logger.info('Installing dependencies');
        await this.installDependencies(buildConfig.dependencies);
      }

      // Run build command
      this.logger.info(`Running build command: ${buildConfig.command}`);
      const result = await this.executeCommand(buildConfig.command, buildConfig.environment);

      // Collect artifacts
      const artifacts = await this.collectArtifacts(buildConfig.outputDir);

      const buildResult: BuildResult = {
        success: true,
        output: result.stdout,
        artifacts,
        duration: Date.now() - startTime
      };

      // Restore original directory
      process.chdir(originalCwd);

      this.logger.info(`Build completed successfully in ${buildResult.duration}ms`);
      return buildResult;

    } catch (error) {
      const buildResult: BuildResult = {
        success: false,
        output: (error as any).stdout || '',
        artifacts: [],
        duration: Date.now() - startTime,
        error: (error as Error).message
      };

      // Restore original directory
      try { process.chdir(originalCwd); } catch {}

      this.logger.error(`Build failed: ${buildResult.error}`);
      return buildResult;
    }
  }

  private async installDependencies(dependencies: string[]): Promise<string> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install', ...dependencies], {
        stdio: 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      npm.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      npm.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      npm.on('close', (code: number) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`npm install failed: ${stderr}`));
        }
      });

      npm.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private async executeCommand(command: string, env?: Record<string, string>): Promise<{ stdout: string; stderr: string }> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      
      const child = spawn(cmd, args, {
        stdio: 'pipe',
        shell: true,
        env: { ...process.env, ...env }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed: ${stderr}`));
        }
      });

      child.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private async collectArtifacts(outputDir: string): Promise<any[]> {
    const artifacts: any[] = [];
    
    if (!await fs.pathExists(outputDir)) {
      return artifacts;
    }

    await this.collectArtifactsRecursive(outputDir, '', artifacts);
    return artifacts;
  }

  private async collectArtifactsRecursive(basePath: string, relativePath: string, artifacts: any[]): Promise<void> {
    const currentPath = path.join(basePath, relativePath);
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await this.collectArtifactsRecursive(basePath, entryRelativePath, artifacts);
      } else {
        const stats = await fs.stat(entryPath);
        const content = await fs.readFile(entryPath);
        
        artifacts.push({
          path: entryRelativePath,
          size: stats.size,
          hash: this.createHash(content),
          type: entry.isDirectory() ? 'directory' : 'file'
        });
      }
    }
  }

  private createHash(content: Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async validateProject(project: Project): Promise<ValidationResult> {
    this.logger.info(`Validating project '${project.name}'`);
    
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if project directory exists
    if (!await fs.pathExists(project.path)) {
      errors.push({
        code: 'PROJECT_NOT_FOUND',
        message: `Project directory '${project.path}' does not exist`,
        severity: 'error'
      });
    }

    // Check build configuration
    if (!project.config.build) {
      errors.push({
        code: 'MISSING_BUILD_CONFIG',
        message: 'Build configuration is missing',
        severity: 'error'
      });
    } else {
      if (!project.config.build.command) {
        errors.push({
          code: 'MISSING_BUILD_COMMAND',
          message: 'Build command is not specified',
          severity: 'error'
        });
      }

      if (!project.config.build.outputDir) {
        warnings.push({
          code: 'MISSING_OUTPUT_DIR',
          message: 'Output directory is not specified',
          field: 'build.outputDir'
        });
      }
    }

    // Check deployment configuration
    if (!project.config.deploy) {
      warnings.push({
        code: 'MISSING_DEPLOY_CONFIG',
        message: 'Deployment configuration is missing'
      });
    } else if (!project.config.deploy.targets || project.config.deploy.targets.length === 0) {
      warnings.push({
        code: 'NO_DEPLOY_TARGETS',
        message: 'No deployment targets configured'
      });
    }

    // Check if required files exist
    const requiredFiles = ['package.json', '.ai-builder/project.json'];
    for (const file of requiredFiles) {
      const filePath = path.join(project.path, file);
      if (!await fs.pathExists(filePath)) {
        errors.push({
          code: 'MISSING_FILE',
          message: `Required file '${file}' is missing`,
          field: file,
          severity: 'error'
        } as ValidationError);
      }
    }

    const isValid = errors.length === 0;
    
    this.logger.info(`Project validation completed: ${isValid ? 'PASSED' : 'FAILED'} (${errors.length} errors, ${warnings.length} warnings)`);
    
    return {
      valid: isValid,
      errors,
      warnings
    };
  }

  async deleteProject(projectId: string): Promise<void> {
    this.logger.info(`Deleting project '${projectId}'`);
    
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project '${projectId}' not found`);
    }

    await fs.remove(project.path);
    
    this.logger.info(`Project '${projectId}' deleted successfully`);
  }

  async listProjects(): Promise<Project[]> {
    this.logger.info('Listing all projects');
    
    const projects: Project[] = [];

    // Search in the configured projects directory and also the parent/data dir
    const searchDirs: string[] = [this.projectsDir];
    const parentDir = path.dirname(this.projectsDir);
    if (parentDir && parentDir !== this.projectsDir) {
      searchDirs.push(parentDir);
    }

    for (const dir of searchDirs) {
      if (!await fs.pathExists(dir)) {
        continue;
      }

      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        const projectPath = path.join(dir, entry);
        const metadataPath = path.join(projectPath, '.ai-builder', 'project.json');

        if (await fs.pathExists(metadataPath)) {
          try {
            const project = await fs.readJson(metadataPath);
            projects.push(project);
          } catch (error) {
            this.logger.warn(`Failed to load project metadata from '${metadataPath}': ${error}`);
          }
        }
      }
    }

    return projects;
  }

  private async getProject(projectId: string): Promise<Project | null> {
    const projects = await this.listProjects();
    return projects.find(p => p.id === projectId) || null;
  }

  async loadProject(projectPath: string): Promise<Project> {
    const metadataPath = path.join(projectPath, '.ai-builder', 'project.json');
    
    if (!await fs.pathExists(metadataPath)) {
      throw new Error(`Project metadata not found at '${metadataPath}'`);
    }

    const project = await fs.readJson(metadataPath);
    project.path = projectPath;
    
    return project;
  }
}
