import { DataFragment, ResolvedFragment, Scope } from './types'
import { LoomError } from './errors'

export async function resolveContent<M>(
  fragment: DataFragment<M>,
  scope: Scope
): Promise<ResolvedFragment<M>> {
  let content: string
  try {
    if (typeof fragment.content === 'string') {
      content = fragment.content
    } else if (typeof fragment.content === 'function') {
      content = await fragment.content({ scope, fragmentId: fragment.id })
    } else {
      content = await fragment.content
    }
  } catch (error) {
    throw new LoomError(`Failed to resolve content for fragment "${fragment.id}"`, error)
  }

  return {
    id: fragment.id,
    content,
    meta: fragment.meta,
  }
}

export async function resolveFragments<M>(
  fragments: ReadonlyArray<DataFragment<M>>,
  scope: Scope
): Promise<ResolvedFragment<M>[]> {
  return Promise.all(fragments.map((f) => resolveContent(f, scope)))
}
