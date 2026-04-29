import { StMiniSystemPromptPass, StMiniHistoryPass } from './passes/base.js';

export async function activate(host: any) {
  host.registerPass(StMiniSystemPromptPass);
  host.registerPass(StMiniHistoryPass);

  host.registerRpc('st-mini.compose', async (params: any) => {
    // Return a list of passes to run
    const passes = [
      'StMiniSystemPromptPass',
      'StMiniHistoryPass'
    ];
    
    // If the user requested UpperCasePass (cross-extension demo)
    if (params.includeUpper) {
      passes.push('UpperCasePass');
    }
    
    return passes;
  });

  host.registerRpc('st-mini.invoke', async (params: any) => {
    // 1. Check for image generation intent (Simple PoC logic)
    let extraFrags: any[] = [];
    if (params.message && (params.message.includes('draw') || params.message.includes('画') || params.message.includes('生成图片'))) {
      const t2i = host.rpcs.get('t2i.generate');
      if (t2i) {
        console.log('[st-mini] Image intent detected, calling T2I extension...');
        const imgResult = await t2i({ prompt: params.message });
        extraFrags.push({
          id: `img-${Date.now()}`,
          content: `![generated image](${imgResult.url})`,
          meta: { type: 'image', ...imgResult }
        });
      }
    }

    // 2. Run standard pipeline
    const result = await host.loomRunner.run({
      passes: params.includeUpper ? ['StMiniSystemPromptPass', 'StMiniHistoryPass', 'UpperCasePass'] : ['StMiniSystemPromptPass', 'StMiniHistoryPass'],
      fragments: params.fragments || [{ id: 'user', content: params.message, meta: {} }],
      invoker: params.invoker,
    });

    // 3. Merge extra fragments (like the generated image)
    result.fragments = [...result.fragments, ...extraFrags];
    return result;
  });
}
