import type { Pass, ResolvedFragment } from '@loom/core';

export const StMiniSystemPromptPass: Pass<any> = {
  name: 'StMiniSystemPromptPass',
  version: '1.0.0',
  run: async (fragments: ResolvedFragment<any>[]) => {
    // In a real stack, this would fetch from a character document
    return [
      { id: 'system', content: 'You are a helpful AI assistant.', meta: { role: 'system' } },
      ...fragments
    ];
  }
};

export const StMiniHistoryPass: Pass<any> = {
  name: 'StMiniHistoryPass',
  version: '1.0.0',
  run: async (fragments: ResolvedFragment<any>[]) => {
    // Just a placeholder
    return fragments;
  }
};
