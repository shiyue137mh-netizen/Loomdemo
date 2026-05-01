import { DocumentStore } from '../kernel/document-store.js';
import { renderPipelineDashboard } from '@loom/devtool';
import path from 'path';

async function main() {
  const traceId = process.argv[2];
  if (!traceId) {
    console.error('Usage: tsx trace-show.ts <traceId>');
    process.exit(1);
  }

  const dbPath = process.env['DATABASE_PATH'] || 'workspace.db';
  const docStore = new DocumentStore(dbPath);

  let actualTraceId = traceId;
  if (traceId === 'last') {
    const row = (docStore as any).db.prepare("SELECT id FROM documents WHERE type = 'system.trace' ORDER BY id DESC LIMIT 1").get();
    if (!row) {
      console.error('No traces found in database.');
      process.exit(1);
    }
    actualTraceId = row.id;
  }

  const traceDoc = docStore.get(actualTraceId as any);
  if (!traceDoc || traceDoc.type !== 'system.trace') {
    console.error(`Trace not found: ${traceId}`);
    process.exit(1);
  }

  const { result } = traceDoc.data;
  
  console.log(`\nShowing Trace: ${traceId}`);
  console.log(`Timestamp: ${traceDoc.data.timestamp}`);
  console.log(`Invoker: ${JSON.stringify(traceDoc.data.invoker)}`);

  // Mock a PipelineResult for devtool
  const pipelineResult = {
    fragments: result.fragments,
    snapshots: result.snapshots,
    diagnostics: result.diagnostics,
    timings: result.timings,
    status: result.status,
  };

  renderPipelineDashboard(pipelineResult as any);

  docStore.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
