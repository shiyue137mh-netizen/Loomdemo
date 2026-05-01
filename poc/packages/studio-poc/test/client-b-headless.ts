import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log('Starting Stage 1 Headless Client Test...');

  const dbPath = path.join(__dirname, 'stage1-workspace.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  // 1. Start the kernel
  const kernel = spawn('npx', ['tsx', 'src/kernel/index.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '8082', DATABASE_PATH: dbPath },
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 3000));

  const client = new WebSocket('ws://localhost:8082');
  await new Promise(r => client.on('open', r));
  console.log('Client connected.');

  const call = (method: string, params: any = {}) => {
    return new Promise((resolve, reject) => {
      const id = nanoid();
      client.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
      const onMessage = (data: any) => {
        const resp = JSON.parse(data.toString());
        if (resp.id === id) {
          client.off('message', onMessage);
          if (resp.error) reject(resp.error);
          else resolve(resp.result);
        }
      };
      client.on('message', onMessage);
    });
  };

  try {
    // 2. Introspect
    console.log('\n--- system.introspect ---');
    const intro: any = await call('system.introspect');
    console.log('Studio Version:', intro.studio.version);
    console.log('Extensions:', intro.extensions.map((e: any) => e.id).join(', '));

    // 3. Invoke standard st-mini
    console.log('\n--- st-mini.invoke (standard) ---');
    const res1: any = await call('st-mini.invoke', { message: 'hello' });
    console.log('Output:', res1.fragments.map((f: any) => f.content).join('\n'));

    // 4. Invoke with cross-extension composition
    console.log('\n--- st-mini.invoke (with includeUpper) ---');
    const res2: any = await call('st-mini.invoke', { message: 'hello', includeUpper: true });
    console.log('Output:', res2.fragments.map((f: any) => f.content).join('\n'));

    if (res2.fragments.some((f: any) => f.content.includes('HELLO'))) {
      console.log('\n✅ Stage 1 SUCCESS: Cross-extension composition confirmed!');
    } else {
      console.error('\n❌ Stage 1 FAILED: UpperCasePass effect not found.');
      process.exit(1);
    }

  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    client.close();
    kernel.kill('SIGINT');
  }
}

runTest();
