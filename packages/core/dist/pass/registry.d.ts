import type { Diagnostic } from '../diagnostic/types';
import type { Pass, PassConfig, PassFactory } from './types';
export declare class PassRegistry<M = unknown> {
    private readonly factories;
    register<P>(factory: PassFactory<P, M>): void;
    has(name: string): boolean;
    create(config: PassConfig): Pass<M>;
    createAll(configs: readonly PassConfig[]): readonly Pass<M>[];
}
export declare function factoryDiagnostic(factoryName: string, error: unknown): Diagnostic;
//# sourceMappingURL=registry.d.ts.map