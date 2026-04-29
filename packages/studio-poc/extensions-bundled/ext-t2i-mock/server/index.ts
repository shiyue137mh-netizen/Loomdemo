export async function activate(host: any) {
  console.log('T2I Mock Extension Activated');

  host.registerRpc('t2i.generate', async (params: any) => {
    const { prompt } = params;
    console.log(`[T2I] Generating image for prompt: ${prompt}`);
    
    // Simulate generation delay
    await new Promise(r => setTimeout(r, 1000));
    
    // 2. Return and Persist
    const result = {
      url: `https://fake-sd.com/gen/${Math.random().toString(36).substring(7)}.png`,
      prompt,
      engine: 'mock-stable-diffusion',
      timestamp: new Date().toISOString()
    };

    // Save to shared DocumentStore
    const docId = `asset.image:${nanoid()}`;
    host.docStore.put({
      id: docId as any,
      type: 'asset.image',
      pluginId: 'ext-t2i-mock',
      data: result
    });

    return { ...result, docId };
  });
}

import { nanoid } from 'nanoid';
