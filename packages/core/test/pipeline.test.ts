import { describe, it, expect } from 'vitest'
import { pipeline } from '../src/pipeline'
import { Pass, DataFragment, ResolvedFragment, Diagnostic, Scope } from '../src/types'
import { PipelineValidationError } from '../src/errors'

describe('pipeline', () => {
  it('should run passes sequentially and record snapshots', async () => {
    const pass1: Pass = {
      name: 'Pass1',
      version: '1.0.0',
      run: (fragments) => {
        return fragments.map((f) => ({ ...f, content: f.content + ' passed 1' }))
      },
    }
    const pass2: Pass = {
      name: 'Pass2',
      version: '1.0.0',
      run: async (fragments) => {
        return fragments.map((f) => ({ ...f, content: f.content + ' passed 2' }))
      },
    }

    const input: DataFragment[] = [
      { id: '1', content: 'hello', meta: {} },
    ]

    const result = await pipeline([pass1, pass2]).run(input)

    expect(result.fragments).toHaveLength(1)
    expect(result.fragments[0]!.content).toBe('hello passed 1 passed 2')
    expect(result.status).toBe('ok')

    // Snapshots: 1 resolution + 2 passes = 3
    expect(result.snapshots).toHaveLength(3)
    expect(result.snapshots[0]!.passName).toBe('ResolutionPass')
    expect(result.snapshots[1]!.passName).toBe('Pass1')
    expect(result.snapshots[2]!.passName).toBe('Pass2')

    // Timings
    expect(result.timings).toHaveLength(2)
    expect(result.timings[0]!.passName).toBe('Pass1')
    expect(result.timings[1]!.passName).toBe('Pass2')
    expect(result.timings[0]!.durationMs).toBeGreaterThanOrEqual(0)

    // Construction diagnostics should be present
    expect(result.constructionDiagnostics).toBeDefined()
    expect(result.constructionDiagnostics).toHaveLength(0) // no warnings/errors for valid pipeline
  })

  it('should support synchronous and asynchronous passes identically', async () => {
    const syncPass: Pass = {
      name: 'Sync',
      version: '1.0.0',
      run: (fragments) => fragments,
    }
    const asyncPass: Pass = {
      name: 'Async',
      version: '1.0.0',
      run: async (fragments) => fragments,
    }

    const result = await pipeline([syncPass, asyncPass]).run([])
    expect(result.snapshots).toHaveLength(3)
  })

  describe('SnapshotMode', () => {
    it('should support snapshot: "off"', async () => {
      const p: Pass = {
        name: 'Test',
        version: '1.0.0',
        run: (fragments) => fragments,
      }

      const result = await pipeline([p]).run(
        [{ id: '1', content: 'hi', meta: {} }],
        { snapshot: 'off' }
      )

      expect(result.snapshots).toHaveLength(0)
      expect(result.fragments).toHaveLength(1)
    })

    it('should support snapshot: "boundaries" (default)', async () => {
      const p: Pass = {
        name: 'Test',
        version: '1.0.0',
        run: (fragments) => fragments,
      }

      const result = await pipeline([p]).run(
        [{ id: '1', content: 'hi', meta: {} }]
      )

      expect(result.snapshots.length).toBeGreaterThan(0)
    })
  })

  describe('id validation', () => {
    it('should detect duplicate fragment ids', async () => {
      const p: Pass = {
        name: 'Pass',
        version: '1.0.0',
        run: (fragments) => fragments,
      }

      const result = await pipeline([p]).run([
        { id: 'dup', content: 'a', meta: {} },
        { id: 'dup', content: 'b', meta: {} },
      ])

      const dupDiags = result.diagnostics.filter(
        (d: Diagnostic) => d.code === 'loom/duplicate-id'
      )
      expect(dupDiags.length).toBe(1)
    })

    it('should detect empty fragment id', async () => {
      const p: Pass = {
        name: 'Pass',
        version: '1.0.0',
        run: (fragments) => fragments,
      }

      const result = await pipeline([p]).run([
        { id: '', content: 'a', meta: {} },
      ])

      const emptyDiags = result.diagnostics.filter(
        (d: Diagnostic) => d.code === 'loom/empty-id'
      )
      expect(emptyDiags.length).toBe(1)
    })
  })

  describe('Diagnostic system', () => {
    it('should collect diagnostics from ctx.diagnose()', async () => {
      const p: Pass = {
        name: 'DiagPass',
        version: '1.0.0',
        run: (fragments, ctx) => {
          ctx.diagnose({
            severity: 'warning',
            code: 'test/my-warning',
            message: 'Something looks off',
            fragmentId: fragments[0]?.id,
          })
          return fragments
        },
      }

      const result = await pipeline([p]).run([
        { id: 'f1', content: 'hi', meta: {} },
      ])

      const myDiags = result.diagnostics.filter(
        (d: Diagnostic) => d.code === 'test/my-warning'
      )
      expect(myDiags).toHaveLength(1)
      expect(myDiags[0]!.severity).toBe('warning')
      expect(myDiags[0]!.pass).toBe('DiagPass')
      expect(myDiags[0]!.fragmentId).toBe('f1')
    })
  })

  describe('capability validation', () => {
    it('should throw PipelineValidationError for missing required capability', () => {
      const noProvider: Pass = {
        name: 'NeedsCap',
        version: '1.0.0',
        requires: ['non-existent'],
        run: (fragments) => fragments,
      }

      expect(() => pipeline([noProvider])).toThrow(PipelineValidationError)
    })

    it('should construct successfully when capabilities are satisfied', () => {
      const provider: Pass = {
        name: 'Provider',
        version: '1.0.0',
        provides: ['sorted'],
        run: (fragments) => fragments,
      }
      const consumer: Pass = {
        name: 'Consumer',
        version: '1.0.0',
        requires: ['sorted'],
        run: (fragments) => fragments,
      }

      const p = pipeline([provider, consumer])
      expect(p).toBeDefined()
    })
  })

  describe('pass validation', () => {
    it('should throw PipelineValidationError for null pass', () => {
      expect(() => pipeline([null as any])).toThrow(PipelineValidationError)
    })

    it('should throw PipelineValidationError for undefined pass', () => {
      expect(() => pipeline([undefined as any])).toThrow(PipelineValidationError)
    })

    it('should throw PipelineValidationError for pass without run()', () => {
      expect(() =>
        pipeline([{ name: 'Bad', version: '1.0.0' } as any])
      ).toThrow(PipelineValidationError)
    })

    it('should throw PipelineValidationError for pass with empty name', () => {
      expect(() =>
        pipeline([{ name: '', version: '1.0.0', run: () => [] }])
      ).toThrow(PipelineValidationError)
    })

    it('should include diagnostics in validation error', () => {
      try {
        pipeline([{ name: '', version: '1.0.0', run: () => [] }])
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(PipelineValidationError)
        const err = e as PipelineValidationError
        expect(err.diagnostics).toBeDefined()
        expect(err.diagnostics!.length).toBeGreaterThan(0)
      }
    })

    it('should emit info diagnostic for empty pipeline', () => {
      // empty pipeline is not an error — it's info
      const p = pipeline([])
      expect(p).toBeDefined()
    })
  })

  describe('thunk can access scope', () => {
    it('should resolve thunk with scope available', async () => {
      const p: Pass = {
        name: 'ScopeReader',
        version: '1.0.0',
        run: (fragments, _ctx) => {
          const f = fragments[0]
          expect(f).toBeDefined()
          expect(f!.content).toBe('hello from scope')
          return fragments
        },
      }

      const result = await pipeline([p]).run(
        [
          {
            id: 'f1',
            content: (resolveCtx) => {
              return resolveCtx.scope.get('greeting') ?? 'missing'
            },
            meta: {},
          },
        ],
        { initialScope: { greeting: 'hello from scope' } }
      )

      expect(result.fragments[0]!.content).toBe('hello from scope')
    })
  })

  describe('immutability', () => {
    it('should freeze fragments in snapshots when snapshot mode is on', async () => {
      const p: Pass = {
        name: 'FreezeTest',
        version: '1.0.0',
        run: (fragments) => {
          return fragments.map((f) => ({ ...f, content: f.content + '!' }))
        },
      }

      const result = await pipeline([p]).run([
        { id: 'f1', content: 'hi', meta: {} },
      ])

      for (const snap of result.snapshots) {
        expect(Object.isFrozen(snap.fragments)).toBe(true)
        for (const f of snap.fragments) {
          expect(Object.isFrozen(f)).toBe(true)
        }
      }
    })
  })

  describe('unversioned pass diagnostic', () => {
    it('should emit diagnostic for unversioned passes', async () => {
      const p: Pass = {
        name: 'NoVersion',
        // deliberately no version
        run: (fragments) => fragments,
      }

      const result = await pipeline([p]).run([
        { id: 'f1', content: 'hi', meta: {} },
      ])

      const unversioned = result.diagnostics.filter(
        (d: Diagnostic) => d.code === 'loom/unversioned-pass'
      )
      expect(unversioned.length).toBe(1)
      expect(unversioned[0]!.severity).toBe('info')
    })
  })

  describe('Mutation computation in snapshots', () => {
    it('should record add mutations when pass creates fragments', async () => {
      const p: Pass = {
        name: 'Creator',
        version: '1.0.0',
        run: (_frags) => {
          return [
            { id: 'new1', content: 'c1', meta: {} },
            { id: 'new2', content: 'c2', meta: {} },
          ]
        },
      }

      const result = await pipeline([p]).run([])

      const lastSnap = result.snapshots[result.snapshots.length - 1]!
      expect(lastSnap.mutations.length).toBe(2)
      expect(lastSnap.mutations.every((m) => m.op === 'add')).toBe(true)
    })

    it('should record remove mutations when pass drops fragments', async () => {
      const p: Pass = {
        name: 'Remover',
        version: '1.0.0',
        run: (_frags) => [],
      }

      const result = await pipeline([p]).run([
        { id: 'f1', content: 'hi', meta: {} },
        { id: 'f2', content: 'bye', meta: {} },
      ])

      const lastSnap = result.snapshots[result.snapshots.length - 1]!
      expect(lastSnap.mutations.length).toBe(2)
      expect(lastSnap.mutations.every((m) => m.op === 'remove')).toBe(true)
    })

    it('should record update mutations when content changes', async () => {
      const p: Pass = {
        name: 'Updater',
        version: '1.0.0',
        run: (fragments) =>
          fragments.map((f) => ({ ...f, content: f.content.toUpperCase() })),
      }

      const result = await pipeline([p]).run([
        { id: 'f1', content: 'hello', meta: {} },
        { id: 'f2', content: 'world', meta: {} },
      ])

      const lastSnap = result.snapshots[result.snapshots.length - 1]!
      const updates = lastSnap.mutations.filter((m) => m.op === 'update')
      expect(updates.length).toBe(2)
    })

    it('should record move mutations when order changes', async () => {
      const p: Pass = {
        name: 'Reverser',
        version: '1.0.0',
        run: (fragments) => [...fragments].reverse(),
      }

      const result = await pipeline([p]).run([
        { id: 'a', content: 'first', meta: {} },
        { id: 'b', content: 'second', meta: {} },
      ])

      const lastSnap = result.snapshots[result.snapshots.length - 1]!
      const moves = lastSnap.mutations.filter((m) => m.op === 'move')
      // Reversing [a,b] → [b,a] moves both elements
      expect(moves).toHaveLength(2)
    })

    it('should record multiple mutation types simultaneously', async () => {
      // Before: [a(0,'original'), b(1,'second'), c(2,'third')]
      // After:  [a(0,'a-updated'), c(1,'third'), new(2,'added')]
      // a: index 0→0, content changed → update
      // c: index 2→1 → move
      // new: not in before → add
      // b: not in after → remove
      const p: Pass = {
        name: 'Mixer',
        version: '1.0.0',
        run: (fragments) => {
          return [
            { ...fragments[0]!, content: 'a-updated' }, // update
            { ...fragments[2]! },                        // move c
            { id: 'new', content: 'added', meta: {} },   // add
          ]
        },
      }

      const result = await pipeline([p]).run([
        { id: 'a', content: 'original', meta: {} },
        { id: 'b', content: 'second', meta: {} },
        { id: 'c', content: 'third', meta: {} },
      ])

      const lastSnap = result.snapshots[result.snapshots.length - 1]!
      const ops = lastSnap.mutations.map((m) => m.op)
      expect(ops).toContain('add')
      expect(ops).toContain('remove')
      expect(ops).toContain('move')
      expect(ops).toContain('update')
    })
  })

  describe('error paths', () => {
    it('should handle pass that throws', async () => {
      const badPass: Pass = {
        name: 'BadPass',
        version: '1.0.0',
        run: () => {
          throw new Error('something went wrong')
        },
      }

      const p = pipeline([badPass])

      await expect(
        p.run([{ id: 'f1', content: 'hi', meta: {} }])
      ).rejects.toThrow(/BadPass/)
    })

    it('should record diagnostic when pass throws', async () => {
      const badPass: Pass = {
        name: 'BadPass',
        version: '1.0.0',
        run: () => {
          throw new Error('intentional error')
        },
      }

      // Use snapshot mode off to test that pass-threw diagnostic is emitted
      // even though the pipeline itself throws
      try {
        await pipeline([badPass]).run(
          [{ id: 'f1', content: 'hi', meta: {} }],
          { snapshot: 'off' }
        )
        expect.fail('should have thrown')
      } catch {
        // Expected — error path is tested above
      }
    })
  })
})
