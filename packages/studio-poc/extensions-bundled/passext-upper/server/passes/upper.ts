import type { Pass, ResolvedFragment } from '@loom/core';

export const UpperCasePass: Pass<any> = {
  name: 'UpperCasePass',
  version: '1.0.0',
  run: async (fragments: ResolvedFragment<any>[]) => {
    return fragments.map(f => ({
      ...f,
      content: f.content.toUpperCase()
    }));
  }
};
