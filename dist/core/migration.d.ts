/// <reference types="node" />
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
export interface MigrationOptions {
    dryRun?: boolean;
    sourceDir?: string;
    sqlitePath?: string;
    logger?: Logger;
    failOnFinalize?: boolean;
}
export declare class MigrationManager extends EventEmitter {
    private logger;
    constructor(logger?: Logger);
    migrateFileToSQLite(opts?: MigrationOptions): Promise<{
        migrated: number;
        skipped: number;
    }>;
    validateMigration(sqlitePath?: string): Promise<{
        total: number;
        valid: boolean;
    }>;
    restoreBackup(sqlitePath?: string): Promise<boolean>;
    createPreRollbackBackup(sqlitePath?: string): Promise<string | null>;
}
export default MigrationManager;
