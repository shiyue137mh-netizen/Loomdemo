import type { Pass } from '@loom/core';

export class PassRegistry {
  private passes = new Map<string, Pass<any>>();

  register(pass: Pass<any>) {
    console.log(`Registering pass: ${pass.name}`);
    this.passes.set(pass.name, pass);
  }

  get(name: string): Pass<any> | undefined {
    return this.passes.get(name);
  }

  list(): Pass<any>[] {
    return Array.from(this.passes.values());
  }
}
