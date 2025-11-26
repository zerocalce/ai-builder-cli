import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import { FileDeploymentStore, SQLiteDeploymentStore } from '../src/core/deployment-store';
import { Deployment, DeploymentStatus, DeploymentLog } from '../src/types';

describe('DeploymentStore implementations', () => {
  const tmp = path.join(os.tmpdir(), `ai-builder-test-${Date.now()}`);
  beforeAll(() => fs.ensureDirSync(tmp));
  afterAll(() => fs.removeSync(tmp));

  it('FileDeploymentStore: save/get/list/appendLog', async () => {
    const dir = path.join(tmp, 'file-store');
    fs.ensureDirSync(dir);
    const store = new FileDeploymentStore(dir as any, console as any);

    const d: Deployment = {
      id: 'd1',
      projectId: 'p1',
      target: { name: 'local', type: 'local', config: {} } as any,
      version: '1.0.0',
      status: DeploymentStatus.PENDING,
      logs: [],
      createdAt: new Date()
    } as any;

    await store.saveDeployment(d);
    const got = await store.getDeployment('d1');
    expect(got).not.toBeNull();
    expect(got!.id).toBe('d1');

    const list = await store.listDeployments('p1');
    expect(list.length).toBeGreaterThan(0);

    const log: DeploymentLog = { id: 'l1', level: 'info', message: 'hello', timestamp: new Date(), source: 'test' };
    await store.appendLog('d1', log);
    const updated = await store.getDeployment('d1');
    expect(updated!.logs.length).toBe(1);
  });

  it('SQLiteDeploymentStore: save/get/list/appendLog (if available)', async () => {
    let sqliteAvailable = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('better-sqlite3');
    } catch (_) {
      sqliteAvailable = false;
    }

    if (!sqliteAvailable) {
      // skip if dependency not installed in environment
      return;
    }

    const dbPath = path.join(tmp, 'ai-builder.db');
    const store = new (SQLiteDeploymentStore as any)(dbPath, console as any);

    const d: Deployment = {
      id: 's1',
      projectId: 'sp1',
      target: { name: 'local', type: 'local', config: {} } as any,
      version: '2.0.0',
      status: DeploymentStatus.PENDING,
      logs: [],
      createdAt: new Date()
    } as any;

    await store.saveDeployment(d);
    const got = await store.getDeployment('s1');
    expect(got).not.toBeNull();

    const list = await store.listDeployments('sp1');
    expect(list.length).toBeGreaterThan(0);

    const log: DeploymentLog = { id: 'sl1', level: 'info', message: 'hello sqlite', timestamp: new Date(), source: 'test' };
    await store.appendLog('s1', log);
    const updated = await store.getDeployment('s1');
    expect(updated!.logs.length).toBe(1);
  });
});
