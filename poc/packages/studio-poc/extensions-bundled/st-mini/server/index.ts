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
      try {
        const imgResult = await host.callRpc('t2i.generate', { prompt: params.message });
        if (imgResult) {
          console.log('[st-mini] Image intent detected, calling T2I extension...');
          extraFrags.push({
            id: `img-${Date.now()}`,
            content: `![generated image](${imgResult.url})`,
            meta: { type: 'image', ...imgResult }
          });
        }
      } catch (err) {
        console.error('[st-mini] Failed to call T2I extension:', err);
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
