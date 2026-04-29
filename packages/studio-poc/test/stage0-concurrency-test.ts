import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log('Starting Stage 0 Concurrency Test...');

  const dbPath = path.join(__dirname, 'test-workspace.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  // 1. Start the kernel
  const kernel = spawn('npx', ['tsx', 'src/kernel/index.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '8081', DATABASE_PATH: dbPath },
    stdio: 'inherit'
  });

  // Give it time to start
  await new Promise(r => setTimeout(r, 3000));

  const client1 = new WebSocket('ws://localhost:8081');
  const client2 = new WebSocket('ws://localhost:8081');

  await Promise.all([
    new Promise(r => client1.on('open', r)),
    new Promise(r => client2.on('open', r))
  ]);

  console.log('Clients connected.');

  const callLoom = (client: WebSocket, stackId: string, content: string) => {
    return new Promise((resolve, reject) => {
      const id = nanoid();
      const payload = {
        jsonrpc: '2.0',
        id,
        method: 'loom.run',
        params: {
          passes: ['FakePass'],
          fragments: [{ id: 'msg', content, meta: {} }],
          invoker: { stackId }
        }
      };
      
      client.send(JSON.stringify(payload));
      
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
    console.log('Sending concurrent requests...');
    const [res1, res2] = await Promise.all([
      callLoom(client1, 'stack-A', 'Hello from A'),
      callLoom(client2, 'stack-B', 'Hello from B')
    ]) as any[];

    console.log('Results received.');
    console.log('Res 1:', res1.fragments[0].content);
    console.log('Res 2:', res2.fragments[0].content);

    if (res1.fragments[0].content.includes('Hello from A') && res2.fragments[0].content.includes('Hello from B')) {
      console.log('✅ Concurrency check passed: Contents are isolated.');
    } else {
      console.error('❌ Concurrency check failed: Contents mixed up!');
      process.exit(1);
    }

    // Check traces in DB (Optional but good for Stage 0)
    // We'll just wait a bit for traces to be written (fire-and-forget)
    await new Promise(r => setTimeout(r, 500));
    
    console.log('Test completed successfully.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    client1.close();
    client2.close();
    kernel.kill('SIGINT');
  }
}

runTest();
