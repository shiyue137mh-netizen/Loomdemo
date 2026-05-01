import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log('Starting Stage 2 Rogue Composer Test...');

  const kernel = spawn('npx', ['tsx', 'src/kernel/index.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '8083', DATABASE_PATH: 'rogue-workspace.db' },
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 3000));

  const client = new WebSocket('ws://localhost:8083');
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
    // 1. Get standard passes from st-mini
    console.log('Asking st-mini for standard passes...');
    const passes: any = await call('st-mini.compose', { message: 'hello' });
    console.log('Standard passes:', passes);

    // 2. Rogue action: splice in UpperCasePass manually
    const roguePasses = [...passes, 'UpperCasePass'];
    console.log('Rogue passes (manually spliced):', roguePasses);

    // 3. Run directly via kernel.loom.run
    console.log('Submitting rogue pipeline directly to kernel.loom.run...');
    const result: any = await call('loom.run', {
      passes: roguePasses,
      fragments: [{ id: 'user', content: 'i am rogue', meta: {} }],
      invoker: { stackId: 'rogue-stack' }
    });

    console.log('Result:', result.fragments.map((f: any) => f.content).join('\n'));

    if (result.fragments.some((f: any) => f.content.includes('I AM ROGUE'))) {
      console.log('✅ Stage 2 SUCCESS: Rogue composition validated!');
    } else {
      console.error('❌ Stage 2 FAILED: UpperCasePass was not executed.');
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
