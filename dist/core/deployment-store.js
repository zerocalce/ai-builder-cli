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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileDeploymentStore = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class FileDeploymentStore {
    constructor(baseDir, logger) {
        this.baseDir = baseDir || path.join(process.cwd(), '.ai-builder', 'deployments');
        this.logger = logger;
        fs.ensureDirSync(this.baseDir);
    }
    getPathForId(id) {
        return path.join(this.baseDir, `${id}.json`);
    }
    serialize(deployment) {
        var _a;
        const copy = { ...deployment };
        // Convert dates to ISO strings for JSON
        copy.createdAt = (_a = deployment.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString();
        copy.startedAt = deployment.startedAt ? deployment.startedAt.toISOString() : undefined;
        copy.completedAt = deployment.completedAt ? deployment.completedAt.toISOString() : undefined;
        if (deployment.logs && deployment.logs.length) {
            copy.logs = deployment.logs.map(l => ({ ...l, timestamp: l.timestamp.toISOString() }));
        }
        return copy;
    }
    deserialize(obj) {
        const d = { ...obj };
        if (obj.createdAt)
            d.createdAt = new Date(obj.createdAt);
        if (obj.startedAt)
            d.startedAt = new Date(obj.startedAt);
        if (obj.completedAt)
            d.completedAt = new Date(obj.completedAt);
        if (obj.logs && Array.isArray(obj.logs)) {
            d.logs = obj.logs.map((l) => ({ ...l, timestamp: new Date(l.timestamp) }));
        }
        else {
            d.logs = [];
        }
        return d;
    }
    async saveDeployment(deployment) {
        var _a;
        const p = this.getPathForId(deployment.id);
        const data = this.serialize(deployment);
        await fs.writeJson(p, data, { spaces: 2 });
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug(`Saved deployment ${deployment.id} to ${p}`);
    }
    async getDeployment(id) {
        const p = this.getPathForId(id);
        if (!await fs.pathExists(p))
            return null;
        const obj = await fs.readJson(p);
        return this.deserialize(obj);
    }
    async listDeployments(projectId) {
        const files = await fs.readdir(this.baseDir);
        const deployments = [];
        import * as fs from 'fs-extra';
        import * as path from 'path';
        import { Logger } from '../utils/logger';
        import { Deployment, DeploymentLog } from '../types';
        class FileDeploymentStore {
            constructor(dir, logger) {
                this.dir = dir || path.join(process.cwd(), '.ai-builder', 'deployments');
                this.logger = logger || new logger_1.Logger({ level: 'info', format: 'pretty' });
                fs.ensureDirSync(this.dir);
            }
            fileFor(id) {
                return path.join(this.dir, `${id}.json`);
            }
            deserialize(obj) {
                return obj;
            }
            async saveDeployment(d) {
                await fs.writeJson(this.fileFor(d.id), d, { spaces: 2 });
            }
            async getDeployment(id) {
                const p = this.fileFor(id);
                if (!(await fs.pathExists(p)))
                    return null;
                return fs.readJson(p);
            }
            async listDeployments(projectId) {
                const files = await fs.readdir(this.dir);
                const out = [];
                for (const f of files) {
                    if (!f.endsWith('.json'))
                        continue;
                    const obj = await fs.readJson(path.join(this.dir, f));
                    if (projectId && obj.projectId !== projectId)
                        continue;
                    out.push(obj);
                }
                return out;
            }
            async appendLog(id, log) {
                const d = await this.getDeployment(id);
                if (!d)
                    throw new Error('deployment not found');
                d.logs = d.logs || [];
                d.logs.push(log);
                await this.saveDeployment(d);
            }
            async getDeploymentHistory(id) {
                const d = await this.getDeployment(id);
                if (!d)
                    return [];
                return d.logs || [];
            }
        }
        // SQLite-backed store implementation
        class SQLiteDeploymentStore {
            constructor(dbPath, logger) {
                this.dbPath = dbPath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
                this.logger = logger || new logger_1.Logger({ level: 'info', format: 'pretty' });
                let Database;
                try {
                    // dynamic require so environments without native module still work
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    Database = require('better-sqlite3');
                }
                catch (err) {
                    this.logger.warn('SQLite store not available, falling back to file-backed store');
                    throw err;
                }
                fs.ensureDirSync(path.dirname(this.dbPath));
                this.db = new Database(this.dbPath);
                this.init();
            }
            init() {
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
            async saveDeployment(d) {
                const stmt = this.db.prepare(`INSERT OR REPLACE INTO deployments (id, projectId, createdAt, data) VALUES (?, ?, ?, ?)`);
                stmt.run(d.id, d.projectId || null, d.createdAt || Date.now(), JSON.stringify(d));
            }
            async getDeployment(id) {
                const stmt = this.db.prepare(`SELECT data FROM deployments WHERE id = ?`);
                const row = stmt.get(id);
                if (!row)
                    return null;
                return JSON.parse(row.data);
            }
            async listDeployments(projectId) {
                let rows = [];
                if (projectId) {
                    const stmt = this.db.prepare(`SELECT data FROM deployments WHERE projectId = ?`);
                    rows = stmt.all(projectId);
                }
                else {
                    const stmt = this.db.prepare(`SELECT data FROM deployments`);
                    rows = stmt.all();
                }
                return rows.map(r => JSON.parse(r.data));
            }
            async appendLog(id, log) {
                const stmt = this.db.prepare(`INSERT INTO deployment_logs (deploymentId, ts, level, message) VALUES (?, ?, ?, ?)`);
                stmt.run(id, log.ts || Date.now(), log.level || 'info', log.message || '');
            }
            async getDeploymentHistory(id) {
                const stmt = this.db.prepare(`SELECT ts, level, message FROM deployment_logs WHERE deploymentId = ? ORDER BY id ASC`);
                const rows = stmt.all(id);
                return rows.map(r => ({ ts: r.ts, level: r.level, message: r.message }));
            }
        }
        export { FileDeploymentStore, SQLiteDeploymentStore };
    }
    serialize(deployment) {
        var _a;
        const obj = { ...deployment };
        obj.createdAt = (_a = deployment.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString();
        obj.startedAt = deployment.startedAt ? deployment.startedAt.toISOString() : undefined;
        obj.completedAt = deployment.completedAt ? deployment.completedAt.toISOString() : undefined;
        obj.logs = (deployment.logs || []).map(l => ({ ...l, timestamp: l.timestamp.toISOString() }));
        return JSON.stringify(obj);
    }
    deserialize(text) {
        const obj = JSON.parse(text);
        const d = { ...obj };
        if (obj.createdAt)
            d.createdAt = new Date(obj.createdAt);
        if (obj.startedAt)
            d.startedAt = new Date(obj.startedAt);
        if (obj.completedAt)
            d.completedAt = new Date(obj.completedAt);
        d.logs = (obj.logs || []).map((l) => ({ ...l, timestamp: new Date(l.timestamp) }));
        return d;
    }
    async saveDeployment(deployment) {
        var _a;
        const stmt = this.db.prepare('INSERT OR REPLACE INTO deployments (id, projectId, createdAt, data) VALUES (?, ?, ?, ?)');
        const createdAt = deployment.createdAt ? deployment.createdAt.getTime() : Date.now();
        stmt.run(deployment.id, deployment.projectId || null, createdAt, this.serialize(deployment));
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug(`Saved deployment ${deployment.id} to SQLite store`);
    }
    async getDeployment(id) {
        const row = this.db.prepare('SELECT data FROM deployments WHERE id = ?').get(id);
        if (!row)
            return null;
        return this.deserialize(row.data);
    }
    async listDeployments(projectId) {
        let rows = [];
        if (projectId) {
            rows = this.db.prepare('SELECT data FROM deployments WHERE projectId = ? ORDER BY createdAt ASC').all(projectId);
        }
        else {
            rows = this.db.prepare('SELECT data FROM deployments ORDER BY createdAt ASC').all();
        }
        return rows.map(r => this.deserialize(r.data));
    }
    async appendLog(deploymentId, log) {
        var _a, _b;
        const row = this.db.prepare('SELECT data FROM deployments WHERE id = ?').get(deploymentId);
        if (!row) {
            // create a minimal deployment row
            const obj = { id: deploymentId, logs: [{ ...log, timestamp: log.timestamp.toISOString() }], createdAt: new Date().toISOString() };
            this.db.prepare('INSERT INTO deployments (id, projectId, createdAt, data) VALUES (?, ?, ?, ?)').run(deploymentId, null, Date.now(), JSON.stringify(obj));
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug(`Appended log to new deployment ${deploymentId} in SQLite store`);
            return;
        }
        const dep = this.deserialize(row.data);
        dep.logs = dep.logs || [];
        dep.logs.push({ ...log, timestamp: log.timestamp });
        // update stored row
        this.db.prepare('UPDATE deployments SET data = ? WHERE id = ?').run(this.serialize(dep), deploymentId);
        (_b = this.logger) === null || _b === void 0 ? void 0 : _b.debug(`Appended log to deployment ${deploymentId} in SQLite store`);
    }
    async getDeploymentHistory(projectId) {
        return this.listDeployments(projectId);
    }
}
exports.FileDeploymentStore = FileDeploymentStore;
