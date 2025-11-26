import * as path from 'path';
import * as fs from 'fs-extra';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { Deployment } from '../types';
import { FileDeploymentStore, SQLiteDeploymentStore } from './deployment-store';

export interface MigrationOptions {
  dryRun?: boolean;
  sourceDir?: string; // path to file-backed deployments
  sqlitePath?: string; // target sqlite db
  logger?: Logger;
  // test-only: simulate a failure right before finalizing/swap
  failOnFinalize?: boolean;
}

export class MigrationManager extends EventEmitter {
  private logger: Logger;

  constructor(logger?: Logger) {
    super();
    this.logger = logger || new Logger({ level: 'info', format: 'pretty' });
  }

  async migrateFileToSQLite(opts: MigrationOptions = {}): Promise<{ migrated: number; skipped: number }>
  {
    const source = opts.sourceDir || path.join(process.cwd(), '.ai-builder', 'deployments');
    const sqlitePath = opts.sqlitePath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
    const dryRun = !!opts.dryRun;
    this.logger.info(`Migration started (dryRun=${dryRun}) from ${source} -> ${sqlitePath}`);

    // Prepare file store
    const fileStore = new FileDeploymentStore(source, this.logger);

    // Prepare temporary sqlite store to avoid partial writes on failure
    const tmpSqlite = sqlitePath + '.tmp';
    let sqliteStore: any = null;
    try {
      sqliteStore = new SQLiteDeploymentStore(tmpSqlite, this.logger);
    } catch (err) {
      this.logger.error('Failed to initialize SQLiteDeploymentStore', err as Error);
      throw err;
    }

    // Read all files from file store dir
    const files = await fs.readdir(source).catch(() => []);
    let migrated = 0;
    let skipped = 0;

    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const p = path.join(source, f);
        const obj = await fs.readJson(p);
        const dep: Deployment = (fileStore as any).deserialize ? (fileStore as any).deserialize(obj) : obj as any;

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
            await sqliteStore.appendLog(dep.id, l as any);
          }
        }
        migrated++;
      } catch (err) {
        this.logger.error(`Failed to migrate file ${f}`, err as Error);
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
        await fs.remove(sqlitePath).catch(() => {});
        await fs.move(tmpSqlite, sqlitePath, { overwrite: true });
        // remove backup on success
        if (await fs.pathExists(bak)) {
          await fs.remove(bak).catch(() => {});
        }
        this.logger.info(`Migration completed: ${migrated} migrated, ${skipped} skipped`);
      } catch (err) {
        this.logger.error('Finalization failed, attempting to restore backup', err as Error);
        // attempt restore from backup
        if (await fs.pathExists(bak)) {
          try {
            await fs.remove(sqlitePath).catch(() => {});
            await fs.move(bak, sqlitePath, { overwrite: true });
            this.logger.info('Restored backup after failure');
          } catch (restoreErr) {
            this.logger.error('Failed to restore backup', restoreErr as Error);
          }
        }
        throw err;
      }
    } else {
      // cleanup tmp
      await fs.remove(tmpSqlite).catch(() => {});
      this.logger.info(`Dry-run complete: ${migrated} would be migrated`);
    }

    this.emit('done', { migrated, skipped });
    return { migrated, skipped };
  }

  async validateMigration(sqlitePath?: string): Promise<{ total: number; valid: boolean }>
  {
    const dbPath = sqlitePath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
    try {
      const store = new SQLiteDeploymentStore(dbPath, this.logger);
      const list = await store.listDeployments();
      return { total: list.length, valid: true };
    } catch (err) {
      this.logger.error('Validation failed', err as Error);
      return { total: 0, valid: false };
    }
  }

  async restoreBackup(sqlitePath?: string): Promise<boolean> {
    const dbPath = sqlitePath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
    const bak = dbPath + '.bak';
    if (!(await fs.pathExists(bak))) {
      this.logger.warn('No backup file to restore');
      return false;
    }
    try {
      await fs.remove(dbPath).catch(() => {});
      await fs.move(bak, dbPath, { overwrite: true });
      this.logger.info(`Restored backup to ${dbPath}`);
      return true;
    } catch (err) {
      this.logger.error('Restore failed', err as Error);
      return false;
    }
  }

  async createPreRollbackBackup(sqlitePath?: string): Promise<string | null> {
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
    } catch (err) {
      this.logger.error('Failed to create pre-rollback backup', err as Error);
      return null;
    }
  }
}

export default MigrationManager;
