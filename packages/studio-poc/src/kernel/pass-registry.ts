import type { Pass } from '@loom/core';

export type PassRegistration = Pass<any> | { name: string; factory: (params?: any) => Pass<any> };

export class PassRegistry {
  private passes = new Map<string, PassRegistration>();

  register(entry: PassRegistration) {
    const name = 'run' in entry ? entry.name : entry.name;
    console.log(`Registering pass: ${name}`);
    this.passes.set(name, entry);
  }

  get(name: string, params?: any): Pass<any> | undefined {
    const entry = this.passes.get(name);
    if (!entry) return undefined;
    if ('run' in entry) return entry;
    return entry.factory(params);
  }

  list(): PassRegistration[] {
    return Array.from(this.passes.values());
  }
}
