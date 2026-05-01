import { describe, expect, it } from 'vitest'
import { pipeline, replayTrace, type Pass } from '../src'

describe('replayTrace', () => {
  it('replays mutation trace to final fragments', () => {
    const pass: Pass = {
      name: 'mix',
      run: (fragments) => [
        { ...fragments[0]!, content: 'updated' },
        { id: 'new', content: 'added', meta: {} },
      ],
    }

    const result = pipeline([pass]).run([
      { id: 'a', content: 'original', meta: {} },
      { id: 'b', content: 'removed', meta: {} },
    ])

    expect(replayTrace(result.trace)).toEqual(result.trace.finalFragments)
  })

  it('can replay until a pass index', () => {
    const first: Pass = {
      name: 'first',
      run: (fragments) => fragments.map((fragment) => ({ ...fragment, content: `${fragment.content}1` })),
    }
    const second: Pass = {
      name: 'second',
      run: (fragments) => fragments.map((fragment) => ({ ...fragment, content: `${fragment.content}2` })),
    }

    const result = pipeline([first, second]).run([{ id: 'f', content: '', meta: {} }])

    expect(replayTrace(result.trace, { untilPassIndex: 0 })[0]!.content).toBe('1')
  })
})
