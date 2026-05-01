import type { Diagnostic } from '../diagnostic/types'
import type { Pass, PassConfig, PassFactory } from './types'

export class PassRegistry<M = unknown> {
  private readonly factories = new Map<string, PassFactory<unknown, M>>()

  register<P>(factory: PassFactory<P, M>): void {
    if (!factory.name) {
      throw new Error('PassFactory must have a non-empty name')
    }
    if (this.factories.has(factory.name)) {
      throw new Error(`PassFactory "${factory.name}" is already registered`)
    }
    this.factories.set(factory.name, factory as PassFactory<unknown, M>)
  }

  has(name: string): boolean {
    return this.factories.has(name)
  }

  create(config: PassConfig): Pass<M> {
    const factory = this.factories.get(config.name)
    if (!factory) {
      throw new Error(`No PassFactory registered for "${config.name}"`)
    }
    return factory.create(config.params)
  }

  createAll(configs: readonly PassConfig[]): readonly Pass<M>[] {
    return configs.map((config) => this.create(config))
  }
}

export function factoryDiagnostic(factoryName: string, error: unknown): Diagnostic {
  const message = error instanceof Error ? error.message : String(error)
  return {
    severity: 'error',
    code: 'loom/factory-threw',
    message: `PassFactory "${factoryName}" threw: ${message}`,
    pass: 'core',
  }
}
