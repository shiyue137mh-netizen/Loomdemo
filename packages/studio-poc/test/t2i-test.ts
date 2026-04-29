import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log('Starting T2I Integration Test...');

  const kernel = spawn('npx', ['tsx', 'src/kernel/index.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '8086', DATABASE_PATH: 't2i-workspace.db' },
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 3000));

  const client = new WebSocket('ws://localhost:8086');
  await new Promise(r => client.on('open', r));

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
    console.log('Sending message with image intent: "please draw a cute cat"');
    const result: any = await call('st-mini.invoke', { message: 'please draw a cute cat' });

    console.log('\n--- Result Fragments ---');
    result.fragments.forEach((f: any) => {
      console.log(`[${f.id}] ${f.content}`);
      if (f.meta && f.meta.type === 'image') {
        console.log(`  -> Detected Image Metadata: ${f.meta.url}`);
      }
    });

    if (result.fragments.some((f: any) => f.meta && f.meta.type === 'image')) {
      console.log('\n✅ T2I Integration SUCCESS: st-mini successfully called ext-t2i-mock!');
    } else {
      console.error('\n❌ T2I Integration FAILED: Image fragment not found.');
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
