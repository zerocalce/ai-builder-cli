import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { ConfigManager, ConfigEntry, Logger } from '../types';

export class ConfigManagerImpl implements ConfigManager {
  private configDir: string;
  private globalConfigPath: string;
  private projectConfigPath?: string;
  private logger: Logger;
  private encryptionKey: string;

  constructor(logger: Logger, configDir?: string) {
    this.logger = logger;
    this.configDir = configDir || path.join(os.homedir(), '.ai-builder');
    this.globalConfigPath = path.join(this.configDir, 'config.json');
    this.encryptionKey = this.getOrCreateEncryptionKey();
    
    this.ensureConfigDirectory();
  }

  private async ensureConfigDirectory(): Promise<void> {
    await fs.ensureDir(this.configDir);
  }

  private getOrCreateEncryptionKey(): string {
    const keyPath = path.join(this.configDir, '.key');
    
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf-8');
      }
    } catch (error) {
      this.logger.warn('Failed to read encryption key, generating new one');
    }

    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, key, 'utf-8');
    fs.chmodSync(keyPath, 0o600); // Restrict permissions
    
    return key;
  }

  private encrypt(value: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(12); // recommended 12 bytes for GCM
    const key = Buffer.from(this.encryptionKey, 'hex');

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedValue: string): string {
    const algorithm = 'aes-256-gcm';
    const parts = encryptedValue.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = Buffer.from(this.encryptionKey, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async set(key: string, value: any, scope: 'global' | 'project' = 'global'): Promise<void> {
    this.logger.debug(`Setting config: ${key} (${scope})`);
    
    const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath!;
    
    if (scope === 'project' && !this.projectConfigPath) {
      throw new Error('Project config path not set. Call setProjectPath() first.');
    }

    let config: Record<string, ConfigEntry> = {};
    
    // Load existing config
    if (await fs.pathExists(configPath)) {
      try {
        const configData = await fs.readJson(configPath);
        config = configData;
      } catch (error) {
        this.logger.warn(`Failed to load config from ${configPath}: ${error}`);
      }
    }

    // Determine if value should be encrypted
    const shouldEncrypt = this.shouldEncryptValue(key, value);
    const processedValue = shouldEncrypt ? this.encrypt(JSON.stringify(value)) : value;

    // Add or update config entry
    config[key] = {
      key,
      value: processedValue,
      scope,
      encrypted: shouldEncrypt,
      createdAt: config[key]?.createdAt || new Date(),
      updatedAt: new Date()
    };

    // Save config
    await fs.writeJson(configPath, config, { spaces: 2 });
    this.logger.debug(`Config saved: ${key} (${scope})`);
  }

  async get(key: string, scope: 'global' | 'project' = 'global'): Promise<any> {
    this.logger.debug(`Getting config: ${key} (${scope})`);
    
    const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath!;
    
    if (scope === 'project' && !this.projectConfigPath) {
      throw new Error('Project config path not set. Call setProjectPath() first.');
    }

    if (!await fs.pathExists(configPath)) {
      return undefined;
    }

    try {
      const config: Record<string, ConfigEntry> = await fs.readJson(configPath);
      const entry = config[key];
      
      if (!entry) {
        return undefined;
      }

      // Decrypt if necessary
      if (entry.encrypted) {
        try {
          const decrypted = this.decrypt(entry.value);
          return JSON.parse(decrypted);
        } catch (error) {
          this.logger.error(`Failed to decrypt config value for key: ${key}`);
          throw new Error(`Failed to decrypt config value for key: ${key}`);
        }
      }

      return entry.value;
    } catch (error) {
      this.logger.error(`Failed to get config ${key}: ${error}`);
      return undefined;
    }
  }

  async list(scope: 'global' | 'project' = 'global'): Promise<ConfigEntry[]> {
    this.logger.debug(`Listing config entries (${scope})`);
    
    const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath!;
    
    if (scope === 'project' && !this.projectConfigPath) {
      throw new Error('Project config path not set. Call setProjectPath() first.');
    }

    if (!await fs.pathExists(configPath)) {
      return [];
    }

    try {
      const config: Record<string, ConfigEntry> = await fs.readJson(configPath);
      return Object.values(config);
    } catch (error) {
      this.logger.error(`Failed to list config entries: ${error}`);
      return [];
    }
  }

  async delete(key: string, scope: 'global' | 'project' = 'global'): Promise<void> {
    this.logger.debug(`Deleting config: ${key} (${scope})`);
    
    const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath!;
    
    if (scope === 'project' && !this.projectConfigPath) {
      throw new Error('Project config path not set. Call setProjectPath() first.');
    }

    if (!await fs.pathExists(configPath)) {
      return;
    }

    try {
      const config: Record<string, ConfigEntry> = await fs.readJson(configPath);
      
      if (config[key]) {
        delete config[key];
        await fs.writeJson(configPath, config, { spaces: 2 });
        this.logger.debug(`Config deleted: ${key} (${scope})`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete config ${key}: ${error}`);
      throw error;
    }
  }

  setProjectPath(projectPath: string): void {
    this.projectConfigPath = path.join(projectPath, '.ai-builder', 'config.json');
  }

  private shouldEncryptValue(key: string, value: any): boolean {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'credential',
      'api_key', 'api_secret', 'private_key', 'auth_token'
    ];

    const keyLower = key.toLowerCase();
    return sensitiveKeys.some(sensitive => keyLower.includes(sensitive));
  }

  // Utility methods for common config operations
  async setDefaultConfig(): Promise<void> {
    const defaultConfig = {
      'cli.default_region': 'us-east-1',
      'cli.auto_confirm': false,
      'cli.verbose': false,
      'build.parallel': true,
      'build.timeout': 300000, // 5 minutes
      'deploy.health_check_enabled': true,
      'deploy.auto_rollback': false,
      'deploy.max_retries': 3,
      'logs.level': 'info',
      'logs.format': 'pretty',
      'templates.auto_update': true,
      'welcome.shown': false
    };

    for (const [key, value] of Object.entries(defaultConfig)) {
      const existing = await this.get(key);
      if (existing === undefined) {
        await this.set(key, value);
      }
    }

    this.logger.info('Default configuration initialized');
  }

  async exportConfig(scope: 'global' | 'project' = 'global', includeEncrypted: boolean = false): Promise<Record<string, any>> {
    const entries = await this.list(scope);
    const exported: Record<string, any> = {};

    for (const entry of entries) {
      if (entry.encrypted && !includeEncrypted) {
        exported[entry.key] = '[ENCRYPTED]';
      } else {
        exported[entry.key] = entry.value;
      }
    }

    return exported;
  }

  async importConfig(configData: Record<string, any>, scope: 'global' | 'project' = 'global'): Promise<void> {
    for (const [key, value] of Object.entries(configData)) {
      if (value !== '[ENCRYPTED]') {
        await this.set(key, value, scope);
      }
    }

    this.logger.info(`Configuration imported for scope: ${scope}`);
  }

  async resetConfig(scope: 'global' | 'project' = 'global'): Promise<void> {
    const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath!;
    
    if (scope === 'project' && !this.projectConfigPath) {
      throw new Error('Project config path not set. Call setProjectPath() first.');
    }

    if (await fs.pathExists(configPath)) {
      await fs.remove(configPath);
      this.logger.info(`Configuration reset for scope: ${scope}`);
    }
  }

  async validateConfig(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if config directory exists and is accessible
      if (!await fs.pathExists(this.configDir)) {
        errors.push('Configuration directory does not exist');
      } else {
        // Check permissions
        try {
          await fs.access(this.configDir, fs.constants.R_OK | fs.constants.W_OK);
        } catch {
          errors.push('Configuration directory is not accessible');
        }
      }

      // Check encryption key
      const keyPath = path.join(this.configDir, '.key');
      if (!await fs.pathExists(keyPath)) {
        warnings.push('Encryption key not found, will be created automatically');
      }

      // Validate global config format
      if (await fs.pathExists(this.globalConfigPath)) {
        try {
          const config = await fs.readJson(this.globalConfigPath);
          if (typeof config !== 'object') {
            errors.push('Global config is not a valid JSON object');
          }
        } catch (error) {
          errors.push('Global config contains invalid JSON');
        }
      }

    } catch (error) {
      errors.push(`Configuration validation failed: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
