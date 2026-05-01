import { DocumentStore } from '../kernel/document-store.js';
import { LoomRunner } from '../kernel/loom-runner.js';
import { PassRegistry } from '../kernel/pass-registry.js';
import { PluginLoader } from '../kernel/plugin-loader.js';
import { renderPipelineDashboard } from '@loom/devtool';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const traceId = process.argv[2];
  if (!traceId) {
    console.error('Usage: tsx trace-replay.ts <traceId>');
    process.exit(1);
  }

  const dbPath = process.env['DATABASE_PATH'] || 'workspace.db';
  const docStore = new DocumentStore(dbPath);
  const passRegistry = new PassRegistry();
  const loomRunner = new LoomRunner(docStore, passRegistry);
  
  const extensionsDir = path.resolve(__dirname, '../../extensions-bundled');
  const pluginLoader = new PluginLoader(extensionsDir, passRegistry, docStore, loomRunner);
  
  await pluginLoader.loadAll();

  const traceDoc = docStore.get(traceId as any);
  if (!traceDoc) {
    console.error(`Trace not found: ${traceId}`);
    process.exit(1);
  }

  const { input, result: originalResult } = traceDoc.data;
  
  console.log(`\nReplaying Trace: ${traceId}`);
  
  const replayResult = await loomRunner.run({
    passes: input.passes.map((p: any) => p.name),
    fragments: input.fragments,
    invoker: { clientId: 'cli-replay', callerRef: `replay:${traceId}` },
    options: { traceId: `system.trace:replay-${traceId.split(':')[1]}` }
  });

  console.log('\n--- Replay Result ---');
  renderPipelineDashboard(replayResult as any);

  docStore.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
