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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const migration_1 = __importDefault(require("../src/core/migration"));
const sample = {
    id: 'deploy_test_1',
    projectId: 'proj_test_1',
    target: { name: 'local', type: 'local' },
    version: '0.1.0',
    status: 'failed',
    logs: [
        { id: 'log1', level: 'info', message: 'start', timestamp: new Date().toISOString(), source: 'test' }
    ],
    createdAt: new Date().toISOString()
};
describe('MigrationManager E2E', () => {
    let tmpdir;
    beforeEach(async () => {
        tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-builder-test-'));
        await fs.ensureDir(path.join(tmpdir, '.ai-builder', 'deployments'));
    });
    afterEach(async () => {
        await fs.remove(tmpdir).catch(() => { });
    });
    test('dry-run does not create sqlite DB and reports migrated count', async () => {
        const src = path.join(tmpdir, '.ai-builder', 'deployments');
        const fpath = path.join(src, `${sample.id}.json`);
        await fs.writeJson(fpath, sample, { spaces: 2 });
        const mgr = new migration_1.default();
        const res = await mgr.migrateFileToSQLite({ dryRun: true, sourceDir: src, sqlitePath: path.join(tmpdir, 'deployments.db') });
        expect(res.migrated).toBe(1);
        // DB should not exist after dry-run
        const exists = await fs.pathExists(path.join(tmpdir, 'deployments.db'));
        expect(exists).toBe(false);
    });
    test('apply creates sqlite DB and validate reports entries (skips if sqlite unavailable)', async () => {
        const src = path.join(tmpdir, '.ai-builder', 'deployments');
        const db = path.join(tmpdir, 'deployments.db');
        const fpath = path.join(src, `${sample.id}.json`);
        await fs.writeJson(fpath, sample, { spaces: 2 });
        const mgr = new migration_1.default();
        try {
            const res = await mgr.migrateFileToSQLite({ dryRun: false, sourceDir: src, sqlitePath: db });
            expect(res.migrated).toBe(1);
            const v = await mgr.validateMigration(db);
            expect(v.valid).toBe(true);
            expect(v.total).toBeGreaterThanOrEqual(1);
        }
        catch (err) {
            // If better-sqlite3 isn't available in the environment, skip this test
            const msg = err.message || '';
            if (msg.includes('better-sqlite3') || msg.includes('cannot find module')) {
                console.warn('better-sqlite3 not available, skipping sqlite apply test');
                return;
            }
            throw err;
        }
    });
    test('restore backup when finalization fails', async () => {
        const src = path.join(tmpdir, '.ai-builder', 'deployments');
        const db = path.join(tmpdir, 'deployments.db');
        const fpath = path.join(src, `${sample.id}.json`);
        await fs.writeJson(fpath, sample, { spaces: 2 });
        // create an initial DB file to be backed up
        await fs.writeFile(db, 'original-content');
        expect(await fs.pathExists(db)).toBe(true);
        const mgr = new migration_1.default();
        let threw = false;
        try {
            await mgr.migrateFileToSQLite({ dryRun: false, sourceDir: src, sqlitePath: db, failOnFinalize: true });
        }
        catch (err) {
            threw = true;
        }
        expect(threw).toBe(true);
        // original DB should have been restored (or still exist)
        expect(await fs.pathExists(db)).toBe(true);
        const content = await fs.readFile(db, 'utf8');
        expect(content).toBe('original-content');
    });
});
