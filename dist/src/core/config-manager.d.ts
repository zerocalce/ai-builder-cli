import { ConfigManager, ConfigEntry, Logger } from '../types';
export declare class ConfigManagerImpl implements ConfigManager {
    private configDir;
    private globalConfigPath;
    private projectConfigPath?;
    private logger;
    private encryptionKey;
    constructor(logger: Logger, configDir?: string);
    private ensureConfigDirectory;
    private getOrCreateEncryptionKey;
    private encrypt;
    private decrypt;
    set(key: string, value: any, scope?: 'global' | 'project'): Promise<void>;
    get(key: string, scope?: 'global' | 'project'): Promise<any>;
    list(scope?: 'global' | 'project'): Promise<ConfigEntry[]>;
    delete(key: string, scope?: 'global' | 'project'): Promise<void>;
    setProjectPath(projectPath: string): void;
    private shouldEncryptValue;
    setDefaultConfig(): Promise<void>;
    exportConfig(scope?: 'global' | 'project', includeEncrypted?: boolean): Promise<Record<string, any>>;
    importConfig(configData: Record<string, any>, scope?: 'global' | 'project'): Promise<void>;
    resetConfig(scope?: 'global' | 'project'): Promise<void>;
    validateConfig(): Promise<ValidationResult>;
}
interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export {};
