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
exports.ConfigManagerImpl = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
class ConfigManagerImpl {
    constructor(logger, configDir) {
        this.logger = logger;
        this.configDir = configDir || path.join(os.homedir(), '.ai-builder');
        this.globalConfigPath = path.join(this.configDir, 'config.json');
        this.encryptionKey = this.getOrCreateEncryptionKey();
        this.ensureConfigDirectory();
    }
    async ensureConfigDirectory() {
        await fs.ensureDir(this.configDir);
    }
    getOrCreateEncryptionKey() {
        const keyPath = path.join(this.configDir, '.key');
        try {
            if (fs.existsSync(keyPath)) {
                return fs.readFileSync(keyPath, 'utf-8');
            }
        }
        catch (error) {
            this.logger.warn('Failed to read encryption key, generating new one');
        }
        const key = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(keyPath, key, 'utf-8');
        fs.chmodSync(keyPath, 0o600); // Restrict permissions
        return key;
    }
    encrypt(value) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(12); // recommended 12 bytes for GCM
        const key = Buffer.from(this.encryptionKey, 'hex');
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    }
    decrypt(encryptedValue) {
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
    async set(key, value, scope = 'global') {
        var _a;
        this.logger.debug(`Setting config: ${key} (${scope})`);
        const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath;
        if (scope === 'project' && !this.projectConfigPath) {
            throw new Error('Project config path not set. Call setProjectPath() first.');
        }
        let config = {};
        // Load existing config
        if (await fs.pathExists(configPath)) {
            try {
                const configData = await fs.readJson(configPath);
                config = configData;
            }
            catch (error) {
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
            createdAt: ((_a = config[key]) === null || _a === void 0 ? void 0 : _a.createdAt) || new Date(),
            updatedAt: new Date()
        };
        // Save config
        await fs.writeJson(configPath, config, { spaces: 2 });
        this.logger.debug(`Config saved: ${key} (${scope})`);
    }
    async get(key, scope = 'global') {
        this.logger.debug(`Getting config: ${key} (${scope})`);
        const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath;
        if (scope === 'project' && !this.projectConfigPath) {
            throw new Error('Project config path not set. Call setProjectPath() first.');
        }
        if (!await fs.pathExists(configPath)) {
            return undefined;
        }
        try {
            const config = await fs.readJson(configPath);
            const entry = config[key];
            if (!entry) {
                return undefined;
            }
            // Decrypt if necessary
            if (entry.encrypted) {
                try {
                    const decrypted = this.decrypt(entry.value);
                    return JSON.parse(decrypted);
                }
                catch (error) {
                    this.logger.error(`Failed to decrypt config value for key: ${key}`);
                    throw new Error(`Failed to decrypt config value for key: ${key}`);
                }
            }
            return entry.value;
        }
        catch (error) {
            this.logger.error(`Failed to get config ${key}: ${error}`);
            return undefined;
        }
    }
    async list(scope = 'global') {
        this.logger.debug(`Listing config entries (${scope})`);
        const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath;
        if (scope === 'project' && !this.projectConfigPath) {
            throw new Error('Project config path not set. Call setProjectPath() first.');
        }
        if (!await fs.pathExists(configPath)) {
            return [];
        }
        try {
            const config = await fs.readJson(configPath);
            return Object.values(config);
        }
        catch (error) {
            this.logger.error(`Failed to list config entries: ${error}`);
            return [];
        }
    }
    async delete(key, scope = 'global') {
        this.logger.debug(`Deleting config: ${key} (${scope})`);
        const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath;
        if (scope === 'project' && !this.projectConfigPath) {
            throw new Error('Project config path not set. Call setProjectPath() first.');
        }
        if (!await fs.pathExists(configPath)) {
            return;
        }
        try {
            const config = await fs.readJson(configPath);
            if (config[key]) {
                delete config[key];
                await fs.writeJson(configPath, config, { spaces: 2 });
                this.logger.debug(`Config deleted: ${key} (${scope})`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to delete config ${key}: ${error}`);
            throw error;
        }
    }
    setProjectPath(projectPath) {
        this.projectConfigPath = path.join(projectPath, '.ai-builder', 'config.json');
    }
    shouldEncryptValue(key, value) {
        const sensitiveKeys = [
            'password', 'token', 'secret', 'key', 'credential',
            'api_key', 'api_secret', 'private_key', 'auth_token'
        ];
        const keyLower = key.toLowerCase();
        return sensitiveKeys.some(sensitive => keyLower.includes(sensitive));
    }
    // Utility methods for common config operations
    async setDefaultConfig() {
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
    async exportConfig(scope = 'global', includeEncrypted = false) {
        const entries = await this.list(scope);
        const exported = {};
        for (const entry of entries) {
            if (entry.encrypted && !includeEncrypted) {
                exported[entry.key] = '[ENCRYPTED]';
            }
            else {
                exported[entry.key] = entry.value;
            }
        }
        return exported;
    }
    async importConfig(configData, scope = 'global') {
        for (const [key, value] of Object.entries(configData)) {
            if (value !== '[ENCRYPTED]') {
                await this.set(key, value, scope);
            }
        }
        this.logger.info(`Configuration imported for scope: ${scope}`);
    }
    async resetConfig(scope = 'global') {
        const configPath = scope === 'global' ? this.globalConfigPath : this.projectConfigPath;
        if (scope === 'project' && !this.projectConfigPath) {
            throw new Error('Project config path not set. Call setProjectPath() first.');
        }
        if (await fs.pathExists(configPath)) {
            await fs.remove(configPath);
            this.logger.info(`Configuration reset for scope: ${scope}`);
        }
    }
    async validateConfig() {
        const errors = [];
        const warnings = [];
        try {
            // Check if config directory exists and is accessible
            if (!await fs.pathExists(this.configDir)) {
                errors.push('Configuration directory does not exist');
            }
            else {
                // Check permissions
                try {
                    await fs.access(this.configDir, fs.constants.R_OK | fs.constants.W_OK);
                }
                catch {
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
                }
                catch (error) {
                    errors.push('Global config contains invalid JSON');
                }
            }
        }
        catch (error) {
            errors.push(`Configuration validation failed: ${error}`);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}
exports.ConfigManagerImpl = ConfigManagerImpl;
