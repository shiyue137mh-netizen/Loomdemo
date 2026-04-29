import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { parseManifest, type ExtensionManifest } from './manifest.js';
import type { PassRegistry } from './pass-registry.js';
import type { DocumentStore } from './document-store.js';

export interface ExtensionHost {
  registerPass(pass: any): void;
  registerRpc(name: string, handler: (params: any) => Promise<any>): void;
  callRpc(name: string, params: any): Promise<any>;
  docStore: DocumentStore;
  loomRunner: any;
}

export class PluginLoader {
  private extensions = new Map<string, ExtensionManifest>();
  private rpcs = new Map<string, (params: any) => Promise<any>>();

  constructor(
    private extensionsDir: string,
    private passRegistry: PassRegistry,
    private docStore: DocumentStore,
    private loomRunner: any
  ) {}

  async loadAll() {
    if (!fs.existsSync(this.extensionsDir)) {
      console.warn(`Extensions directory not found: ${this.extensionsDir}`);
      return;
    }

    const entries = fs.readdirSync(this.extensionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.loadExtension(path.join(this.extensionsDir, entry.name));
      }
    }
  }

  private async loadExtension(extPath: string) {
    const manifestPath = path.join(extPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;

    const manifest = parseManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')));
    console.log(`Loading extension: ${manifest.id}@${manifest.version}`);

    if (manifest.server?.entry) {
      const entryPath = path.resolve(extPath, manifest.server.entry);
      const entryUrl = pathToFileURL(entryPath).href;
      
      try {
        const module = await import(entryUrl);
        if (typeof module.activate === 'function') {
          const host: ExtensionHost = {
            registerPass: (pass) => this.passRegistry.register(pass),
            registerRpc: (name, handler) => {
              console.log(`Registering RPC: ${name}`);
              this.rpcs.set(name, handler);
            },
            callRpc: async (name, params) => {
              const handler = this.rpcs.get(name);
              if (!handler) {
                throw new Error(`RPC method not found: ${name}`);
              }
              const result = await handler(params);
              
              // 记录 RPC 调用到 system.trace.rpc
              const traceId = `system.trace.rpc:ext-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              this.docStore.put({
                id: traceId as any,
                type: 'system.trace.rpc',
                pluginId: manifest.id,
                data: {
                  invoker: { clientId: 'internal', callerRef: `rpc:${name}` },
                  input: { rpc: name, params },
                  result,
                  timestamp: new Date().toISOString()
                }
              });
              
              return result;
            },
            docStore: this.docStore,
            loomRunner: this.loomRunner,
          };
          await module.activate(host);
        }
      } catch (err) {
        console.error(`Failed to activate extension ${manifest.id}:`, err);
      }
    }

    this.extensions.set(manifest.id, manifest);
  }

  getRpc(name: string) {
    return this.rpcs.get(name);
  }

  getExtensions() {
    return Array.from(this.extensions.values());
  }
}
