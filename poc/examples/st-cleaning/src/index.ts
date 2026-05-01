import { pipeline } from '@loom/core';
import { 
  CleanThinkingPass, 
  PruneStatusPass,
  FlattenToMessages 
} from '@loom/st';

// 1. 模拟 8 条带有思维链和状态的消息 (最新的在最后)
const mockChat = Array.from({ length: 8 }, (_, i) => ({
  id: `msg-${i}`,
  content: `
<think>
这是第 ${i} 条消息的内部思考过程，非常长且冗余...
</think>
<角色状态>
心情: ${i % 3 === 0 ? '开心' : '平静'},
体力: ${100 - i * 10}
</角色状态>
这是第 ${i} 条消息的正文。`,
  meta: { kind: 'chat-message', role: i % 2 === 0 ? 'assistant' : 'user', stIndex: i }
}));

// 2. 定义 Pipeline
const cleaningPipeline = pipeline([
  // 第一步：全部清洗掉思维链
  CleanThinkingPass(),
  
  // 第二步：只保留最近 5 份状态
  PruneStatusPass({ keepRecent: 5 }),
  
  FlattenToMessages()
]);

// 3. 执行
async function runTest() {
  console.log('--- 正在启动上下文清理验证 (Cleaning & Pruning) ---\n');
  
  const result = await cleaningPipeline.run(mockChat as any);
  
  console.log('\n--- 流程执行日志 ---');
  result.snapshots.forEach(s => {
    if (s.logs.length > 0) {
      console.log(`[Pass: ${s.passName}]`);
      s.logs.forEach(l => console.log(`  > ${l.message}`));
    }
  });

  const finalFragment = result.fragments.find(f => f.id === 'openai-messages');
  if (finalFragment) {
    const messages = JSON.parse(finalFragment.content);
    console.log('\n--- 清理后的前 3 条消息 (最旧) ---');
    messages.slice(0, 3).forEach((m: any, i: number) => {
      console.log(`[Message ${i}] Content: ${m.content.replace(/\n/g, ' ')}`);
    });

    console.log('\n--- 清理后的后 3 条消息 (最新) ---');
    messages.slice(-3).forEach((m: any, i: number) => {
      console.log(`[Message ${i+5}] Content: ${m.content.replace(/\n/g, ' ')}`);
    });

    // 统计
    const totalThink = messages.filter((m: any) => m.content.includes('<think>')).length;
    const totalStatus = messages.filter((m: any) => m.content.includes('<角色状态>')).length;
    
    console.log(`\n统计结果:`);
    console.log(`- 剩余 <think> 数量: ${totalThink} (预期: 0)`);
    console.log(`- 剩余 <角色状态> 数量: ${totalStatus} (预期: 5)`);
    
    if (totalThink === 0 && totalStatus === 5) {
      console.log('\n✅ 验证成功：历史记录已完美清洗与修剪！');
    }
  }
}

runTest().catch(console.error);
