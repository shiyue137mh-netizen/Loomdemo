import { describe, expect, it } from 'vitest'
import traceSchema from '../src/schemas/trace.schema.json'
import { deserializeTrace, pipeline, serializeTrace, type Pass } from '../src'

describe('trace', () => {
  it('serializes and deserializes trace JSON', () => {
    const pass: Pass = {
      name: 'upper',
      run: (fragments) => fragments.map((fragment) => ({
        ...fragment,
        content: fragment.content.toUpperCase(),
      })),
    }

    const result = pipeline([pass]).run([{ id: 'f1', content: 'hello', meta: {} }])
    const serialized = serializeTrace(result.trace)

    expect(deserializeTrace(serialized)).toEqual(result.trace)
  })

  it('exports a strict Trace v1 schema with core definitions', () => {
    expect(traceSchema.properties.version).toEqual({ const: '1' })
    expect(traceSchema.additionalProperties).toBe(false)
    expect(traceSchema.$defs.fragment.required).toEqual(['id', 'content', 'meta'])
    expect(traceSchema.$defs.mutation.oneOf).toHaveLength(4)
    expect(traceSchema.$defs.execution.required).toContain('afterFragments')
    expect(traceSchema.$defs.diagnostic.required).toEqual([
      'severity',
      'code',
      'message',
      'pass',
    ])
  })
})
