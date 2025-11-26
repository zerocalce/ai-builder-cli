import * as fs from 'fs-extra';
import * as path from 'path';
import { Deployment, DeploymentLog } from '../types';
import { Logger } from '../utils/logger';

export interface DeploymentStore {
  saveDeployment(d: Deployment): Promise<void>;
  getDeployment(id: string): Promise<Deployment | null>;
  listDeployments(projectId?: string): Promise<Deployment[]>;
  appendLog(id: string, log: DeploymentLog): Promise<void>;
  getDeploymentHistory(id: string): Promise<DeploymentLog[]>;

}

export class FileDeploymentStore implements DeploymentStore {
  private dir: string;
  private logger: any;

  constructor(dir?: string, logger?: any) {
    this.dir = dir || path.join(process.cwd(), '.ai-builder', 'deployments');
    this.logger = logger || new (require('../utils/logger').Logger)({ level: 'info', format: 'pretty' });
    fs.ensureDirSync(this.dir);
  }

  private fileFor(id: string) {
    return path.join(this.dir, `${id}.json`);
  }

  async saveDeployment(d: Deployment): Promise<void> {
    await fs.writeJson(this.fileFor(d.id), d, { spaces: 2 });
  }

  async getDeployment(id: string): Promise<Deployment | null> {
    const p = this.fileFor(id);
    if (!(await fs.pathExists(p))) return null;
    const obj = await fs.readJson(p);
    return obj as Deployment;
  }

  async listDeployments(projectId?: string): Promise<Deployment[]> {
    const files = await fs.readdir(this.dir);
    const out: Deployment[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const obj = await fs.readJson(path.join(this.dir, f));
      if (projectId && obj.projectId !== projectId) continue;
      out.push(obj as Deployment);
    }
    return out;
  }

  async appendLog(id: string, log: DeploymentLog): Promise<void> {
    const d = await this.getDeployment(id);
    if (!d) throw new Error('deployment not found');
    d.logs = d.logs || [];
    d.logs.push(log);
    await this.saveDeployment(d);
  }

  async getDeploymentHistory(id: string): Promise<DeploymentLog[]> {
    const d = await this.getDeployment(id);
    if (!d) return [];
    return d.logs || [];
  }
}

export class SQLiteDeploymentStore implements DeploymentStore {
  private db: any;
  private logger: any;
  private dbPath: string;

  constructor(dbPath?: string, logger?: any) {
    this.dbPath = dbPath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
    this.logger = logger || new (require('../utils/logger').Logger)({ level: 'info', format: 'pretty' });
    let Database: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Database = require('better-sqlite3');
    } catch (err) {
      this.logger.warn('SQLite store not available');
      throw err;
    }

    fs.ensureDirSync(path.dirname(this.dbPath));
    this.db = new Database(this.dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY,
        projectId TEXT,
        createdAt INTEGER,
        data TEXT
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deployment_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deploymentId TEXT,
        ts INTEGER,
        level TEXT,
        message TEXT
      );
    `);
  }

  async saveDeployment(d: Deployment): Promise<void> {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO deployments (id, projectId, createdAt, data) VALUES (?, ?, ?, ?)');
    stmt.run(d.id, d.projectId || null, d.createdAt ? d.createdAt.getTime() : Date.now(), JSON.stringify(d));
  }

  async getDeployment(id: string): Promise<Deployment | null> {
    const stmt = this.db.prepare('SELECT data FROM deployments WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return JSON.parse(row.data) as Deployment;
  }

  async listDeployments(projectId?: string): Promise<Deployment[]> {
    let rows: any[] = [];
    if (projectId) {
      rows = this.db.prepare('SELECT data FROM deployments WHERE projectId = ? ORDER BY createdAt ASC').all(projectId);
    } else {
      rows = this.db.prepare('SELECT data FROM deployments ORDER BY createdAt ASC').all();
    }
    return rows.map(r => JSON.parse(r.data) as Deployment);
  }

  async appendLog(id: string, log: DeploymentLog): Promise<void> {
    const stmt = this.db.prepare('INSERT INTO deployment_logs (deploymentId, ts, level, message) VALUES (?, ?, ?, ?)');
    stmt.run(id, log.timestamp ? new Date(log.timestamp).getTime() : Date.now(), log.level || 'info', log.message || '');
  }

  async getDeploymentHistory(id: string): Promise<DeploymentLog[]> {
    const stmt = this.db.prepare('SELECT ts, level, message FROM deployment_logs WHERE deploymentId = ? ORDER BY id ASC');
    const rows = stmt.all(id);
    return rows.map((r: any) => ({ id: '', level: r.level, message: r.message, timestamp: new Date(r.ts), source: '' } as DeploymentLog));
  }
}
 
}
