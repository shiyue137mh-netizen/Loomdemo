import { describe, it, expect } from 'vitest'
import { resolveContent, resolveFragments } from '../src/resolution'
import { DataFragment, Scope } from '../src/types'

function makeScope(initial: Record<string, any> = {}): Scope {
  const store = { ...initial }
  return {
    get: (key: string) => store[key],
    set: (key: string, value: any) => { store[key] = value },
    has: (key: string) => Object.prototype.hasOwnProperty.call(store, key),
    get entries() { return Object.freeze({ ...store }) },
  }
}

describe('resolution', () => {
  it('should resolve string content', async () => {
    const frag: DataFragment = { id: '1', content: 'hello', meta: {} }
    const resolved = await resolveContent(frag, makeScope())
    expect(resolved.content).toBe('hello')
  })

  it('should resolve Promise<string> content', async () => {
    const frag: DataFragment = { id: '1', content: Promise.resolve('hello promise'), meta: {} }
    const resolved = await resolveContent(frag, makeScope())
    expect(resolved.content).toBe('hello promise')
  })

  it('should resolve thunk content, passing ResolveContext', async () => {
    let receivedCtx: any = null
    const frag: DataFragment = {
      id: 'f1',
      content: async (ctx) => {
        receivedCtx = ctx
        return ctx.scope.get('greeting') ?? 'fallback'
      },
      meta: {},
    }
    const scope = makeScope({ greeting: 'hello from scope' })
    const resolved = await resolveContent(frag, scope)
    expect(resolved.content).toBe('hello from scope')
    expect(receivedCtx).toBeDefined()
    expect(receivedCtx.fragmentId).toBe('f1')
    expect(receivedCtx.scope).toBe(scope)
  })

  it('should resolve sync thunk', async () => {
    const frag: DataFragment = {
      id: 'f1',
      content: (ctx) => `resolved-${ctx.fragmentId}`,
      meta: {},
    }
    const resolved = await resolveContent(frag, makeScope())
    expect(resolved.content).toBe('resolved-f1')
  })

  it('should resolve all fragments concurrently', async () => {
    const start = performance.now()
    const fragments: DataFragment[] = [
      { id: '1', content: new Promise((r) => setTimeout(() => r('1'), 50)), meta: {} },
      { id: '2', content: new Promise((r) => setTimeout(() => r('2'), 50)), meta: {} },
    ]
    const resolved = await resolveFragments(fragments, makeScope())
    const duration = performance.now() - start

    // Concurrency means it should take around 50ms, not 100ms
    expect(duration).toBeLessThan(90)
    expect(resolved).toHaveLength(2)
  })
})
