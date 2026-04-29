import { pipeline, type ResolvedFragment, type Pass, type RunOptions, type PipelineResult } from '@loom/core';
import { nanoid } from 'nanoid';
import type { DocumentStore } from './document-store.js';
import type { PassRegistry } from './pass-registry.js';

export interface Invoker {
  stackId?: string;
  clientId: string;
  callerRef?: string;
}

export interface RunParams {
  passes: (Pass<any> | string)[]; // Allow pass names for PoC Stage 0
  fragments: ResolvedFragment<any>[];
  invoker: Invoker;
  options?: RunOptions & { traceId?: string };
}

export class LoomRunner {
  constructor(
    private docStore: DocumentStore,
    private passRegistry: PassRegistry
  ) {}

  async run(params: RunParams): Promise<PipelineResult<any>> {
    const traceId = params.options?.traceId || `system.trace:${nanoid()}`;
    
    // Resolve passes
    const actualPasses = params.passes.map(p => {
      if (typeof p === 'string') {
        const pass = this.passRegistry.get(p);
        if (!pass) throw new Error(`Unknown pass: ${p}`);
        return pass;
      }
      return p;
    });
    
    // We wrap the sink to collect data for the trace document
    const result = await pipeline(actualPasses)
      .run(params.fragments, {
        ...params.options,
        snapshot: 'boundaries', // Always snapshot for trace
      });

    // Fire-and-forget trace writing (as per Tenet IV)
    this.writeTrace(traceId, params, result).catch(err => {
      console.error('Failed to write trace:', err);
    });

    return result;
  }

  private async writeTrace(traceId: string, params: RunParams, result: PipelineResult<any>) {
    this.docStore.put({
      id: traceId as any,
      type: 'system.trace',
      pluginId: 'system.kernel',
      data: {
        invoker: params.invoker,
        input: {
          passes: params.passes.map(p => ({ name: p.name, version: p.version })),
          fragments: params.fragments,
        },
        result: {
          status: result.status,
          fragments: result.fragments,
          snapshots: result.snapshots,
          diagnostics: result.diagnostics,
          timings: result.timings,
          error: result.error ? String(result.error) : undefined,
        },
        timestamp: new Date().toISOString(),
      },
    });
  }
}
