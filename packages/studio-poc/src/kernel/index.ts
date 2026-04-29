import { DocumentStore } from './document-store.js';
import { LoomRunner } from './loom-runner.js';
import { Transport } from './transport.js';
import { PassRegistry } from './pass-registry.js';
import { PluginLoader } from './plugin-loader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const dbPath = process.env['DATABASE_PATH'] || 'workspace.db';
  const port = parseInt(process.env['PORT'] || '8080', 10);

  const docStore = new DocumentStore(dbPath);
  const passRegistry = new PassRegistry();
  const loomRunner = new LoomRunner(docStore, passRegistry);
  
  const extensionsDir = process.env['EXTENSIONS_DIR'] || path.resolve(__dirname, '../../extensions-bundled');
  const pluginLoader = new PluginLoader(extensionsDir, passRegistry, docStore, loomRunner);
  
  await pluginLoader.loadAll();

  const transport = new Transport(port, docStore, loomRunner, pluginLoader);

  console.log('Loom Studio Kernel (PoC Stage 1) started.');
  
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    transport.close();
    docStore.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error starting kernel:', err);
  process.exit(1);
});
