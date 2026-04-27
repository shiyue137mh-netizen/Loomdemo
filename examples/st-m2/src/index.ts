import { pipeline } from '@loom/core';
import { 
  LoadChat, 
  LoadLorebook,
  ActivateWorldInfo,
  FilterInactive,
  OrderByPosition,
  FlattenToMessages 
} from '@loom/st';

// 1. 模拟连环套世界书
const mockLorebook = {
  entries: [
    {
      keys: ["猫", "cat"],
      content: "【条目A】猫很可爱，尤其是它那对【耳朵】。",
      order: 10,
      depth: 0
    },
    {
      keys: ["耳朵", "ear"],
      content: "【条目B】猫的【耳朵】非常灵敏，能捕捉到【高频】振动。",
      order: 20,
      depth: 0
    },
    {
      keys: ["高频", "high-frequency"],
      content: "【条目C】所谓的【高频】是指频率在 20kHz 以上的声波。",
      order: 30,
      depth: 1 // 注入到最后一条消息之前
    }
  ]
};

// 2. 模拟多条聊天记录
const mockChat = [
  { name: '哥哥', mes: '我今天在街上看到一只可爱的猫。', is_user: true },
  { name: '青子', mes: '猫确实很可爱呢，哥哥。', is_user: false },
  { name: '哥哥', mes: '它的动作非常灵巧。', is_user: true }
];

// 3. 定义 Pipeline
const m2Pipeline = pipeline([
  LoadLorebook(mockLorebook),
  LoadChat(mockChat),
  
  // 执行递归激活
  ActivateWorldInfo({ maxIterations: 5 }),
  
  FilterInactive(),
  OrderByPosition(),
  FlattenToMessages()
]);

// 4. 执行测试
async function runTest() {
  console.log('--- 正在启动 Loom-ST M2 验证流水线 (Recursive Scanning) ---\n');
  
  const result = await m2Pipeline.run([]);
  
  const finalFragment = result.fragments.find(f => f.id === 'openai-messages');
  
  if (finalFragment) {
    console.log('\n--- 流程执行日志 (Pass Logs) ---');
    result.snapshots.forEach(s => {
      if (s.logs.length > 0) {
        console.log(`[Pass: ${s.passName}]`);
        s.logs.forEach(l => console.log(`  > ${l.message}`));
      }
    });

    console.log('\n--- 最终生成的 System 内容预览 ---');
    const messages = JSON.parse(finalFragment.content);
    const systemMsg = messages.find((m: any) => m.role === 'system');
    console.log(systemMsg ? systemMsg.content.substring(0, 200) + '...' : '无 System 消息');
    
    console.log('\n--- 激活深度分析 ---');
    const activatedEntries = result.snapshots.find(s => s.passName === 'ST.ActivateWorldInfo');
    const activeCount = activatedEntries?.fragments.filter(f => f.meta.kind === 'worldinfo-entry' && f.meta.active).length;
    
    console.log(`预期激活条目数: 3, 实际激活数: ${activeCount}`);
    
    if (activeCount === 3) {
      console.log('✅ 成功触发了连环激活：猫 -> 耳朵 -> 高频！');
    }
  }
}

runTest().catch(console.error);
