// Core CLI Auto-Deployment System Types

export interface CLICommand {
  name: string;
  description: string;
  options: CLIOption[];
  handler: (args: CommandArgs) => Promise<void>;
  subcommands?: CLICommand[];
}

export interface CLIOption {
  name: string;
  alias?: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  default?: any;
  choices?: string[];
}

export interface CommandArgs {
  [key: string]: any;
}

// Project Management Types
export interface Project {
  id: string;
  name: string;
  template: string;
  version: string;
  config: ProjectConfig;
  deployments: Deployment[];
  createdAt: Date;
  updatedAt: Date;
  path: string;
}

export interface ProjectConfig {
  build: BuildConfig;
  deploy: DeployConfig;
  environment: EnvironmentConfig;
  database?: DatabaseConfig;
  plugins?: PluginConfig[];
}

export interface BuildConfig {
  command: string;
  outputDir: string;
  environment: Record<string, string>;
  dependencies: string[];
  scripts: Record<string, string>;
}

export interface DeployConfig {
  targets: DeploymentTarget[];
  healthCheck?: HealthCheckConfig;
  rollback?: RollbackConfig;
  notifications?: NotificationConfig;
}

export interface DeploymentTarget {
  name: string;
  type: 'local' | 'docker' | 'aws' | 'azure' | 'gcp' | 'ssh' | 'vercel' | 'netlify';
  config: TargetConfig;
  environment: 'development' | 'staging' | 'production';
}

export interface TargetConfig {
  // Common fields
  region?: string;
  credentials?: string;
  
  // Docker specific
  image?: string;
  port?: number;
  
  // Cloud specific
  service?: string;
  bucket?: string;
  domain?: string;
  
  // SSH specific
  host: string;
  user?: string;
  keyPath?: string;
  
  // Custom fields
  [key: string]: any;
}

export interface EnvironmentConfig {
  variables: Record<string, string>;
  secrets: Record<string, string>;
  ssl?: boolean;
  domain?: string;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql' | 'mongodb';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  migrations?: string;
  seeds?: string;
}

// Deployment Types
export interface Deployment {
  id: string;
  projectId: string;
  target: DeploymentTarget;
  version: string;
  status: DeploymentStatus;
  logs: DeploymentLog[];
  buildResult?: BuildResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  rollbackFrom?: string;
}

export enum DeploymentStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back'
}

export interface DeploymentLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source: string;
}

export interface BuildResult {
  success: boolean;
  output: string;
  artifacts: Artifact[];
  duration: number;
  error?: string;
}

export interface Artifact {
  path: string;
  size: number;
  hash: string;
  type: 'file' | 'directory';
}

// Health and Monitoring
export interface HealthCheckConfig {
  endpoint: string;
  interval: number;
  timeout: number;
  retries: number;
  expectedStatus?: number;
}

export interface RollbackConfig {
  enabled: boolean;
  triggers: RollbackTrigger[];
  backupStrategy: BackupStrategy;
}

export interface RollbackTrigger {
  type: 'health_check' | 'error_rate' | 'manual';
  threshold?: number;
  timeWindow?: number;
}

export interface BackupStrategy {
  type: 'full' | 'incremental';
  retention: number;
  schedule?: string;
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  events: NotificationEvent[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'discord';
  config: Record<string, any>;
}

export interface NotificationEvent {
  type: 'deployment_started' | 'deployment_success' | 'deployment_failed' | 'rollback';
  enabled: boolean;
}

// Service Interfaces
export interface ProjectManager {
  createProject(template: string, name: string, path: string): Promise<Project>;
  buildProject(project: Project): Promise<BuildResult>;
  validateProject(project: Project): Promise<ValidationResult>;
  deleteProject(projectId: string): Promise<void>;
  listProjects(): Promise<Project[]>;
}

export interface DeploymentEngine {
  deploy(project: Project, target: DeploymentTarget): Promise<Deployment>;
  rollback(deployment: Deployment, version: string): Promise<void>;
  getStatus(deployment: Deployment): Promise<DeploymentStatus>;
  getLogs(deployment: Deployment): Promise<DeploymentLog[]>;
  cancelDeployment(deployment: Deployment): Promise<void>;
}

export interface ConfigManager {
  set(key: string, value: any, scope?: 'global' | 'project'): Promise<void>;
  get(key: string, scope?: 'global' | 'project'): Promise<any>;
  list(scope?: 'global' | 'project'): Promise<ConfigEntry[]>;
  delete(key: string, scope?: 'global' | 'project'): Promise<void>;
}

export interface ConfigEntry {
  key: string;
  value: any;
  scope: 'global' | 'project';
  encrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Template System
export interface Template {
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  config: TemplateConfig;
  files: TemplateFile[];
  dependencies?: TemplateDependency[];
}

export interface TemplateConfig {
  build: BuildConfig;
  deploy: DeployConfig;
  variables?: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'choice';
  description: string;
  required: boolean;
  default?: any;
  choices?: string[];
}

export interface TemplateFile {
  path: string;
  content: string;
  template: boolean;
}

export interface TemplateDependency {
  name: string;
  version: string;
  type: 'npm' | 'docker' | 'system';
}

// Plugin System
export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  hooks: PluginHooks;
  commands?: CLICommand[];
  config?: PluginConfig;
}

export interface PluginHooks {
  beforeBuild?: (project: Project) => Promise<void>;
  afterBuild?: (result: BuildResult) => Promise<void>;
  beforeDeploy?: (deployment: Deployment) => Promise<void>;
  afterDeploy?: (result: DeploymentResult) => Promise<void>;
  beforeRollback?: (deployment: Deployment) => Promise<void>;
  afterRollback?: (deployment: Deployment) => Promise<void>;
}

export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, any>;
}

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

// Cloud Provider Interfaces
export interface CloudProvider {
  name: string;
  type: 'aws' | 'azure' | 'gcp' | 'custom';
  deploy(config: DeploymentConfig): Promise<DeploymentResult>;
  getStatus(deploymentId: string): Promise<DeploymentStatus>;
  rollback(deploymentId: string, targetVersion: string): Promise<void>;
  listDeployments(): Promise<Deployment[]>;
}

export interface DeploymentConfig {
  project: Project;
  target: DeploymentTarget;
  buildResult: BuildResult;
  environment: Record<string, string>;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  url?: string;
  endpoint?: string;
  metadata: Record<string, any>;
  error?: string;
}

// Database Integration
export interface DatabaseIntegration {
  migrate(migrations: Migration[]): Promise<void>;
  seed(data: SeedData): Promise<void>;
  backup(): Promise<BackupResult>;
  restore(backup: BackupResult): Promise<void>;
  getStatus(): Promise<DatabaseStatus>;
}

export interface Migration {
  id: string;
  version: string;
  description: string;
  up: string;
  down: string;
}

export interface SeedData {
  version: string;
  data: Record<string, any>;
}

export interface BackupResult {
  id: string;
  timestamp: Date;
  size: number;
  location: string;
  checksum: string;
}

export interface DatabaseStatus {
  connected: boolean;
  version: string;
  size: number;
  lastBackup?: Date;
}

// Chat Integration
export interface ChatCommands {
  deployProject(projectName: string, target: string): Promise<string>;
  getDeploymentStatus(projectName: string): Promise<string>;
  listProjects(): Promise<string>;
  rollbackProject(projectName: string, version: string): Promise<string>;
  createProject(template: string, name: string): Promise<string>;
}

// Utility Types
export interface ProgressIndicator {
  start(message: string): void;
  update(message: string, progress?: number): void;
  success(message: string): void;
  error(message: string): void;
  stop(): void;
}

export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
}

export interface EventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
}
