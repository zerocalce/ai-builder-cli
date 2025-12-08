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
exports.MigrationManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const events_1 = require("events");
const logger_1 = require("../utils/logger");
const deployment_store_1 = require("./deployment-store");
class MigrationManager extends events_1.EventEmitter {
    constructor(logger) {
        super();
        this.logger = logger || new logger_1.Logger({ level: 'info', format: 'pretty' });
    }
    async migrateFileToSQLite(opts = {}) {
        const source = opts.sourceDir || path.join(process.cwd(), '.ai-builder', 'deployments');
        const sqlitePath = opts.sqlitePath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
        const dryRun = !!opts.dryRun;
        this.logger.info(`Migration started (dryRun=${dryRun}) from ${source} -> ${sqlitePath}`);
        // Prepare file store
        const fileStore = new deployment_store_1.FileDeploymentStore(source, this.logger);
        // Prepare temporary sqlite store to avoid partial writes on failure
        const tmpSqlite = sqlitePath + '.tmp';
        let sqliteStore = null;
        try {
            sqliteStore = new deployment_store_1.SQLiteDeploymentStore(tmpSqlite, this.logger);
        }
        catch (err) {
            this.logger.error('Failed to initialize SQLiteDeploymentStore', err);
            throw err;
        }
        // Read all files from file store dir
        const files = await fs.readdir(source).catch(() => []);
        let migrated = 0;
        let skipped = 0;
        for (const f of files) {
            if (!f.endsWith('.json'))
                continue;
            try {
                const p = path.join(source, f);
                const obj = await fs.readJson(p);
                const dep = fileStore.deserialize ? fileStore.deserialize(obj) : obj;
                // emit progress
                this.emit('progress', { file: f, id: dep.id });
                // If dry-run, just validate reading
                if (dryRun) {
                    migrated++;
                    continue;
                }
                // Check conflict in target
                const existing = await sqliteStore.getDeployment(dep.id);
                if (existing) {
                    this.logger.warn(`Skipping ${dep.id} — already exists in target`);
                    skipped++;
                    continue;
                }
                await sqliteStore.saveDeployment(dep);
                if (dep.logs && dep.logs.length) {
                    for (const l of dep.logs) {
                        await sqliteStore.appendLog(dep.id, l);
                    }
                }
                migrated++;
            }
            catch (err) {
                this.logger.error(`Failed to migrate file ${f}`, err);
                // attempt to continue; emit error event
                this.emit('error', { file: f, error: err });
            }
        }
        // If not dry-run, finalize by swapping tmp sqlite into place atomically
        if (!dryRun) {
            await fs.ensureDir(path.dirname(sqlitePath));
            // create backup if target exists
            const bak = sqlitePath + '.bak';
            const targetExists = await fs.pathExists(sqlitePath);
            if (targetExists) {
                await fs.copy(sqlitePath, bak, { overwrite: true });
                this.logger.info(`Created backup: ${bak}`);
            }
            // test-only failure hook
            if (opts.failOnFinalize) {
                // remove tmp to simulate a finalization failure scenario
                // or throw to emulate failure
                throw new Error('simulated finalize failure');
            }
            try {
                await fs.remove(sqlitePath).catch(() => { });
                await fs.move(tmpSqlite, sqlitePath, { overwrite: true });
                // remove backup on success
                if (await fs.pathExists(bak)) {
                    await fs.remove(bak).catch(() => { });
                }
                this.logger.info(`Migration completed: ${migrated} migrated, ${skipped} skipped`);
            }
            catch (err) {
                this.logger.error('Finalization failed, attempting to restore backup', err);
                // attempt restore from backup
                if (await fs.pathExists(bak)) {
                    try {
                        await fs.remove(sqlitePath).catch(() => { });
                        await fs.move(bak, sqlitePath, { overwrite: true });
                        this.logger.info('Restored backup after failure');
                    }
                    catch (restoreErr) {
                        this.logger.error('Failed to restore backup', restoreErr);
                    }
                }
                throw err;
            }
        }
        else {
            // cleanup tmp
            await fs.remove(tmpSqlite).catch(() => { });
            this.logger.info(`Dry-run complete: ${migrated} would be migrated`);
        }
        this.emit('done', { migrated, skipped });
        return { migrated, skipped };
    }
    async validateMigration(sqlitePath) {
        const dbPath = sqlitePath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
        try {
            const store = new deployment_store_1.SQLiteDeploymentStore(dbPath, this.logger);
            const list = await store.listDeployments();
            return { total: list.length, valid: true };
        }
        catch (err) {
            this.logger.error('Validation failed', err);
            return { total: 0, valid: false };
        }
    }
    async restoreBackup(sqlitePath) {
        const dbPath = sqlitePath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
        const bak = dbPath + '.bak';
        if (!(await fs.pathExists(bak))) {
            this.logger.warn('No backup file to restore');
            return false;
        }
        try {
            await fs.remove(dbPath).catch(() => { });
            await fs.move(bak, dbPath, { overwrite: true });
            this.logger.info(`Restored backup to ${dbPath}`);
            return true;
        }
        catch (err) {
            this.logger.error('Restore failed', err);
            return false;
        }
    }
    async createPreRollbackBackup(sqlitePath) {
        const dbPath = sqlitePath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
        if (!(await fs.pathExists(dbPath))) {
            this.logger.warn('No database file to backup');
            return null;
        }
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const preBak = `${dbPath}.pre-rollback.${ts}.bak`;
        try {
            await fs.copy(dbPath, preBak, { overwrite: true });
            this.logger.info(`Created pre-rollback backup: ${preBak}`);
            return preBak;
        }
        catch (err) {
            this.logger.error('Failed to create pre-rollback backup', err);
            return null;
        }
    }
}
exports.MigrationManager = MigrationManager;
exports.default = MigrationManager;
