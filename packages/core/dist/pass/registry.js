export class PassRegistry {
    factories = new Map();
    register(factory) {
        if (!factory.name) {
            throw new Error('PassFactory must have a non-empty name');
        }
        if (this.factories.has(factory.name)) {
            throw new Error(`PassFactory "${factory.name}" is already registered`);
        }
        this.factories.set(factory.name, factory);
    }
    has(name) {
        return this.factories.has(name);
    }
    create(config) {
        const factory = this.factories.get(config.name);
        if (!factory) {
            throw new Error(`No PassFactory registered for "${config.name}"`);
        }
        return factory.create(config.params);
    }
    createAll(configs) {
        return configs.map((config) => this.create(config));
    }
}
export function factoryDiagnostic(factoryName, error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
        severity: 'error',
        code: 'loom/factory-threw',
        message: `PassFactory "${factoryName}" threw: ${message}`,
        pass: 'core',
    };
}
//# sourceMappingURL=registry.js.map