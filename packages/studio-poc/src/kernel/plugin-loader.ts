import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { parseManifest, type ExtensionManifest } from './manifest.js';
import type { PassRegistry } from './pass-registry.js';
import type { DocumentStore } from './document-store.js';

export interface ExtensionHost {
  registerPass(pass: any): void;
  registerRpc(name: string, handler: (params: any) => Promise<any>): void;
  docStore: DocumentStore;
  loomRunner: any;
  rpcs: Map<string, (params: any) => Promise<any>>;
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
            docStore: this.docStore,
            loomRunner: this.loomRunner,
            rpcs: this.rpcs,
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
