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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const deployment_store_1 = require("../src/core/deployment-store");
const types_1 = require("../src/types");
describe('DeploymentStore implementations', () => {
    const tmp = path.join(os.tmpdir(), `ai-builder-test-${Date.now()}`);
    beforeAll(() => fs.ensureDirSync(tmp));
    afterAll(() => fs.removeSync(tmp));
    it('FileDeploymentStore: save/get/list/appendLog', async () => {
        const dir = path.join(tmp, 'file-store');
        fs.ensureDirSync(dir);
        const store = new deployment_store_1.FileDeploymentStore(dir, console);
        const d = {
            id: 'd1',
            projectId: 'p1',
            target: { name: 'local', type: 'local', config: {} },
            version: '1.0.0',
            status: types_1.DeploymentStatus.PENDING,
            logs: [],
            createdAt: new Date()
        };
        await store.saveDeployment(d);
        const got = await store.getDeployment('d1');
        expect(got).not.toBeNull();
        expect(got.id).toBe('d1');
        const list = await store.listDeployments('p1');
        expect(list.length).toBeGreaterThan(0);
        const log = { id: 'l1', level: 'info', message: 'hello', timestamp: new Date(), source: 'test' };
        await store.appendLog('d1', log);
        const updated = await store.getDeployment('d1');
        expect(updated.logs.length).toBe(1);
    });
    it('SQLiteDeploymentStore: save/get/list/appendLog (if available)', async () => {
        let sqliteAvailable = true;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            require('better-sqlite3');
        }
        catch (_) {
            sqliteAvailable = false;
        }
        if (!sqliteAvailable) {
            // skip if dependency not installed in environment
            return;
        }
        const dbPath = path.join(tmp, 'ai-builder.db');
        const store = new deployment_store_1.SQLiteDeploymentStore(dbPath, console);
        const d = {
            id: 's1',
            projectId: 'sp1',
            target: { name: 'local', type: 'local', config: {} },
            version: '2.0.0',
            status: types_1.DeploymentStatus.PENDING,
            logs: [],
            createdAt: new Date()
        };
        await store.saveDeployment(d);
        const got = await store.getDeployment('s1');
        expect(got).not.toBeNull();
        const list = await store.listDeployments('sp1');
        expect(list.length).toBeGreaterThan(0);
        const log = { id: 'sl1', level: 'info', message: 'hello sqlite', timestamp: new Date(), source: 'test' };
        await store.appendLog('s1', log);
        const updated = await store.getDeployment('s1');
        expect(updated.logs.length).toBe(1);
    });
});
