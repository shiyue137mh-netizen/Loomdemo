import {
  PassRegistry,
  type Diagnostic,
  type Fragment,
  type Pass,
  type PassConfig,
  type PassFactory,
} from '@loom/core'

export interface AppendParams {
  readonly suffix: string
}

export interface PrependParams {
  readonly prefix: string
}

export interface FilterByMetaParams {
  readonly key: string
  readonly equals: unknown
}

export interface SortByMetaNumberParams {
  readonly key: string
  readonly direction?: 'asc' | 'desc'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function requireString(record: Record<string, unknown>, key: string, passName: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new Error(`${passName} params.${key} must be a string`)
  }
  return value
}

function assertNoExtraKeys(record: Record<string, unknown>, allowed: readonly string[], passName: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new Error(`${passName} params.${key} is not allowed`)
    }
  }
}

function assertRecordParams(params: unknown, passName: string): Record<string, unknown> {
  if (!isRecord(params)) {
    throw new Error(`${passName} params must be an object`)
  }
  return params
}

function appendParams(params: unknown): AppendParams {
  const record = assertRecordParams(params, 'stdlib.append')
  assertNoExtraKeys(record, ['suffix'], 'stdlib.append')
  return { suffix: requireString(record, 'suffix', 'stdlib.append') }
}

function prependParams(params: unknown): PrependParams {
  const record = assertRecordParams(params, 'stdlib.prepend')
  assertNoExtraKeys(record, ['prefix'], 'stdlib.prepend')
  return { prefix: requireString(record, 'prefix', 'stdlib.prepend') }
}

function filterByMetaParams(params: unknown): FilterByMetaParams {
  const record = assertRecordParams(params, 'stdlib.filterByMeta')
  assertNoExtraKeys(record, ['key', 'equals'], 'stdlib.filterByMeta')
  if (!Object.prototype.hasOwnProperty.call(record, 'equals')) {
    throw new Error('stdlib.filterByMeta params.equals is required')
  }
  return { key: requireString(record, 'key', 'stdlib.filterByMeta'), equals: record.equals }
}

function sortByMetaNumberParams(params: unknown): SortByMetaNumberParams {
  const record = assertRecordParams(params, 'stdlib.sortByMetaNumber')
  assertNoExtraKeys(record, ['key', 'direction'], 'stdlib.sortByMetaNumber')
  const direction = record.direction
  if (direction !== undefined && direction !== 'asc' && direction !== 'desc') {
    throw new Error('stdlib.sortByMetaNumber params.direction must be "asc" or "desc"')
  }
  return {
    key: requireString(record, 'key', 'stdlib.sortByMetaNumber'),
    ...(direction ? { direction } : {}),
  }
}

function metaValue(fragment: Fragment, key: string): unknown {
  if (!fragment.meta || typeof fragment.meta !== 'object' || Array.isArray(fragment.meta)) {
    return undefined
  }
  return (fragment.meta as Record<string, unknown>)[key]
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
  }
  return undefined
}

export function createAppendPass(params: AppendParams): Pass {
  return {
    name: 'stdlib.append',
    reads: ['content'],
    writes: ['content'],
    run: (fragments) => fragments.map((fragment) => ({
      ...fragment,
      content: `${fragment.content}${params.suffix}`,
    })),
  }
}

export function createPrependPass(params: PrependParams): Pass {
  return {
    name: 'stdlib.prepend',
    reads: ['content'],
    writes: ['content'],
    run: (fragments) => fragments.map((fragment) => ({
      ...fragment,
      content: `${params.prefix}${fragment.content}`,
    })),
  }
}

export function createFilterByMetaPass(params: FilterByMetaParams): Pass {
  return {
    name: 'stdlib.filterByMeta',
    reads: [`meta.${params.key}`],
    writes: [],
    run: (fragments) => fragments.filter((fragment) => metaValue(fragment, params.key) === params.equals),
  }
}

export function createSortByMetaNumberPass(params: SortByMetaNumberParams): Pass {
  const direction = params.direction ?? 'asc'
  const factor = direction === 'asc' ? 1 : -1

  return {
    name: 'stdlib.sortByMetaNumber',
    reads: [`meta.${params.key}`],
    writes: [],
    run: (fragments) => [...fragments]
      .map((fragment, index) => ({
        fragment,
        index,
        value: toFiniteNumber(metaValue(fragment, params.key)),
      }))
      .sort((left, right) => {
        if (left.value === undefined && right.value === undefined) return left.index - right.index
        if (left.value === undefined) return 1
        if (right.value === undefined) return -1
        const diff = left.value - right.value
        return diff === 0 ? left.index - right.index : diff * factor
      })
      .map((item) => item.fragment),
  }
}

export const appendFactory: PassFactory<unknown> = {
  name: 'stdlib.append',
  paramsSchema: {
    type: 'object',
    required: ['suffix'],
    properties: { suffix: { type: 'string' } },
    additionalProperties: false,
  },
  create: (params) => createAppendPass(appendParams(params)),
}

export const prependFactory: PassFactory<unknown> = {
  name: 'stdlib.prepend',
  paramsSchema: {
    type: 'object',
    required: ['prefix'],
    properties: { prefix: { type: 'string' } },
    additionalProperties: false,
  },
  create: (params) => createPrependPass(prependParams(params)),
}

export const filterByMetaFactory: PassFactory<unknown> = {
  name: 'stdlib.filterByMeta',
  paramsSchema: {
    type: 'object',
    required: ['key', 'equals'],
    properties: { key: { type: 'string' }, equals: true },
    additionalProperties: false,
  },
  create: (params) => createFilterByMetaPass(filterByMetaParams(params)),
}

export const sortByMetaNumberFactory: PassFactory<unknown> = {
  name: 'stdlib.sortByMetaNumber',
  paramsSchema: {
    type: 'object',
    required: ['key'],
    properties: {
      key: { type: 'string' },
      direction: { enum: ['asc', 'desc'] },
    },
    additionalProperties: false,
  },
  create: (params) => createSortByMetaNumberPass(sortByMetaNumberParams(params)),
}

export function createStdlibRegistry(): PassRegistry {
  const registry = new PassRegistry()
  registry.register(appendFactory)
  registry.register(prependFactory)
  registry.register(filterByMetaFactory)
  registry.register(sortByMetaNumberFactory)
  return registry
}

export function validatePipeline(configs: readonly PassConfig[], registry = createStdlibRegistry()): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const available = new Set<string>()

  for (let index = 0; index < configs.length; index++) {
    const config = configs[index]!
    let pass: Pass
    try {
      pass = registry.create(config)
    } catch (error) {
      diagnostics.push({
        severity: 'error',
        code: error instanceof Error && error.name === 'PassFactoryMissingError'
          ? 'loom-stdlib/factory-missing'
          : 'loom-stdlib/invalid-params',
        message: error instanceof Error ? error.message : String(error),
        pass: config.name,
        meta: { passIndex: index },
      })
      continue
    }

    for (const requirement of pass.requires ?? []) {
      if (!available.has(requirement)) {
        diagnostics.push({
          severity: 'error',
          code: 'loom-stdlib/missing-required-capability',
          message: `Pass "${pass.name}" requires capability "${requirement}" which is not provided by a prior pass`,
          pass: pass.name,
          meta: { capability: requirement, passIndex: index },
        })
      }
    }

    for (const provided of pass.provides ?? []) {
      available.add(provided)
    }
  }

  return diagnostics
}
