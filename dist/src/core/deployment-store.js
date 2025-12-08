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
exports.SQLiteDeploymentStore = exports.FileDeploymentStore = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
class FileDeploymentStore {
    constructor(dir, logger) {
        this.dir = dir || path.join(process.cwd(), '.ai-builder', 'deployments');
        this.logger = logger || new (require('../utils/logger').Logger)({ level: 'info', format: 'pretty' });
        fs.ensureDirSync(this.dir);
    }
    fileFor(id) {
        return path.join(this.dir, `${id}.json`);
    }
    async saveDeployment(d) {
        await fs.writeJson(this.fileFor(d.id), d, { spaces: 2 });
    }
    async getDeployment(id) {
        const p = this.fileFor(id);
        if (!(await fs.pathExists(p)))
            return null;
        const obj = await fs.readJson(p);
        return obj;
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
exports.FileDeploymentStore = FileDeploymentStore;
class SQLiteDeploymentStore {
    constructor(dbPath, logger) {
        this.dbPath = dbPath || path.join(process.cwd(), '.ai-builder', 'deployments.db');
        this.logger = logger || new (require('../utils/logger').Logger)({ level: 'info', format: 'pretty' });
        let Database;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            Database = require('better-sqlite3');
        }
        catch (err) {
            this.logger.warn('SQLite store not available');
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
        const stmt = this.db.prepare('INSERT OR REPLACE INTO deployments (id, projectId, createdAt, data) VALUES (?, ?, ?, ?)');
        stmt.run(d.id, d.projectId || null, d.createdAt ? d.createdAt.getTime() : Date.now(), JSON.stringify(d));
    }
    async getDeployment(id) {
        const stmt = this.db.prepare('SELECT data FROM deployments WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return JSON.parse(row.data);
    }
    async listDeployments(projectId) {
        let rows = [];
        if (projectId) {
            rows = this.db.prepare('SELECT data FROM deployments WHERE projectId = ? ORDER BY createdAt ASC').all(projectId);
        }
        else {
            rows = this.db.prepare('SELECT data FROM deployments ORDER BY createdAt ASC').all();
        }
        return rows.map(r => JSON.parse(r.data));
    }
    async appendLog(id, log) {
        const stmt = this.db.prepare('INSERT INTO deployment_logs (deploymentId, ts, level, message) VALUES (?, ?, ?, ?)');
        stmt.run(id, log.timestamp ? new Date(log.timestamp).getTime() : Date.now(), log.level || 'info', log.message || '');
    }
    async getDeploymentHistory(id) {
        const stmt = this.db.prepare('SELECT ts, level, message FROM deployment_logs WHERE deploymentId = ? ORDER BY id ASC');
        const rows = stmt.all(id);
        return rows.map((r) => ({ id: '', level: r.level, message: r.message, timestamp: new Date(r.ts), source: '' }));
    }
}
exports.SQLiteDeploymentStore = SQLiteDeploymentStore;
