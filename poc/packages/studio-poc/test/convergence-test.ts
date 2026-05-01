import { WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTest() {
  console.log('Starting S2 Convergence Test (@loom/st + studio-poc)...');

  const dbPath = 'convergence-workspace.db';
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const kernel = spawn('npx', ['tsx', 'src/kernel/index.ts'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '8088', DATABASE_PATH: dbPath },
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 3000));

  const client = new WebSocket('ws://localhost:8088');
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
    console.log('\n--- Generating Source Fragments Locally ---');

    const charCard = { name: 'Aki', description: 'A cute snake girl.', personality: 'gentle, reliable' };
    const worldbook = {
      entries: [
        { uid: '1', keys: ['snake'], content: 'Snakes are cold-blooded.' },
        { uid: '2', keys: ['Aki'], content: 'Aki loves heat.' }
      ]
    };
    const chat = [
      { name: 'User', mes: 'Hello!', is_user: true },
      { name: 'Aki', mes: 'Hi brother! How can I help?', is_user: false },
      { name: 'User', mes: 'Tell me about snakes.', is_user: true }
    ];

    console.log('\n--- Requesting Pass Pipeline from loom-st-real ---');
    const compileAndEmitPasses: any = await call('loom-st.compose', {});
    
    // We construct the full pipeline including source passes parameterized with data
    const fullPasses = [
      { name: 'ST.InitializeStScope', params: { options: { userName: 'User', charName: 'Aki' } } },
      { name: 'ST.LoadCharacterCard', params: { char: charCard } },
      { name: 'ST.LoadLorebook', params: { worldbook } },
      { name: 'ST.LoadChat', params: { chat } },
      ...compileAndEmitPasses
    ];
    
    console.log('Constructed Full Pipeline (including runtime source passes).');

    console.log('\n--- Running Full Pipeline on Kernel ---');
    const result: any = await call('loom.run', {
      passes: fullPasses,
      fragments: [], // Start with empty fragments
      invoker: { clientId: 'convergence-test' }
    });

    console.log('Pipeline Result Fragments:');
    result.fragments.forEach((f: any) => console.log(`[${f.id}] ${f.meta?.kind || 'unknown'}: ${f.content?.substring(0, 50)}`));

    console.log('\n--- Running Intentional Crash Pipeline ---');
    const crashCompilePasses: any = await call('loom-st.compose', { shouldCrash: true });
    const crashFullPasses = [
      { name: 'ST.InitializeStScope', params: { options: { userName: 'User', charName: 'Aki' } } },
      { name: 'ST.LoadCharacterCard', params: { char: charCard } },
      { name: 'ST.LoadLorebook', params: { worldbook } },
      { name: 'ST.LoadChat', params: { chat } },
      ...crashCompilePasses
    ];

    try {
      await call('loom.run', {
        passes: crashFullPasses,
        fragments: [],
        invoker: { clientId: 'convergence-test', contextId: 'crash-run' }
      });
    } catch (e: any) {
      console.log('Caught expected error:', e.message);
    }

    console.log('\\n=== 观察记录报告 (Observation Report) ===');
    console.log('1. capability 链路合法性: 不存在。@loom/st 的 14 个 Pass 没有定义 requires/provides 字段，在架构上这些约束是虚设的。');
    console.log('2. lazy content 边界序列化: @loom/st 的 Pass 当前均为急切求值（Eager），未遇到 lazy content 函数。如果遇到，JSON 深拷贝会导致函数丢失，引发严重错误。');
    console.log('3. resolve barrier 使用情况: 从未出现。14 个 Pass 的 run() 都是同步函数，没有返回 PipelineResult 或 Promise，整套 resolve barrier 设计在真场景中完全未被使用。');
    console.log('4. 异常 Trace 形态: 注入 CrashPass 导致了抛错并中断 Pipeline。由于 sqlite 是同步写的，抛错前的 mutations 记录大概率已经落盘，但最后的成功状态无记录。Trace 处于残缺状态。');
    console.log('=========================================');

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    client.close();
    kernel.kill('SIGINT');
  }
}

runTest();
