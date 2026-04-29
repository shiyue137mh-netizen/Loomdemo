import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log('Starting Data Sharing Integration Test...');

  const dbPath = 'data-sharing-workspace.db';
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const kernel = spawn('npx', ['tsx', 'src/kernel/index.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '8087', DATABASE_PATH: dbPath },
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 3000));

  const client = new WebSocket('ws://localhost:8087');
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
    // 1. Call t2i.generate (via st-mini or directly)
    console.log('Generating image...');
    await call('st-mini.invoke', { message: 'draw a landscape' });

    // 2. Query the data layer via docs.list
    console.log('Querying shared data layer for "asset.image" documents...');
    const images: any = await call('docs.list', { type: 'asset.image' });

    console.log('\n--- Documents in Shared Data Layer ---');
    images.forEach((doc: any) => {
      console.log(`[${doc.id}] Type: ${doc.type}, Created by: ${doc.meta.pluginId}`);
      console.log(`  Payload: ${JSON.stringify(doc.data)}`);
    });

    if (images.length > 0 && images[0].type === 'asset.image') {
      console.log('\n✅ Data Sharing SUCCESS: Backend extension saved data, and generic client retrieved it!');
    } else {
      console.error('\n❌ Data Sharing FAILED: Documents not found in DB.');
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
