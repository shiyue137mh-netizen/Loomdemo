import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log('Starting Stage 2 Keystone Test (Persistence after Uninstall)...');

  const dbPath = path.join(__dirname, 'keystone-workspace.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const emptyExtDir = path.join(__dirname, 'empty-extensions');
  if (!fs.existsSync(emptyExtDir)) fs.mkdirSync(emptyExtDir);

  const call = (ws: WebSocket, method: string, params: any = {}) => {
    return new Promise((resolve, reject) => {
      const id = nanoid();
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
      const onMessage = (data: any) => {
        const resp = JSON.parse(data.toString());
        if (resp.id === id) {
          ws.off('message', onMessage);
          if (resp.error) reject(resp.error);
          else resolve(resp.result);
        }
      };
      ws.on('message', onMessage);
    });
  };

  // 1. Start kernel WITH extensions
  console.log('\n--- Phase 1: Run with extensions installed ---');
  let kernel = spawn('npx', ['tsx', 'src/kernel/index.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '8084', DATABASE_PATH: dbPath },
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 3000));
  let client = new WebSocket('ws://localhost:8084');
  await new Promise(r => client.on('open', r));

  console.log('Invoking st-mini.invoke...');
  await call(client, 'st-mini.invoke', { message: 'persist me', includeUpper: true });

  client.close();
  kernel.kill('SIGINT');
  await new Promise(r => setTimeout(r, 2000));

  // 2. Start kernel WITHOUT extensions
  console.log('\n--- Phase 2: Run with extensions UNINSTALLED ---');
  kernel = spawn('npx', ['tsx', 'src/kernel/index.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { 
      ...process.env, 
      PORT: '8085', 
      DATABASE_PATH: dbPath,
      EXTENSIONS_DIR: emptyExtDir 
    },
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 3000));
  
  // 3. Verify trace via CLI
  console.log('\n--- Phase 3: Verify trace via CLI ---');
  const traceShow = spawn('npx', ['tsx', 'src/cli/trace-show.ts', 'last'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_PATH: dbPath },
    stdio: 'inherit'
  });

  await new Promise(r => traceShow.on('close', r));

  kernel.kill('SIGINT');
  console.log('\n✅ Stage 2 Keystone Test Finished.');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
