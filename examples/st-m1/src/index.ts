import { pipeline } from '@loom/core';
import { 
  LoadChat, 
  LoadCharacterCard, 
  InitializeStScope,
  ResolveTemplates,
  OrderByPosition, 
  FlattenToMessages 
} from '@loom/st';

// 1. 模拟带有模板占位符的数据
const mockCharacter = {
  name: '青子',
  description: '{{char}} 是一位专业、可靠、温顺的蛇娘秘书。',
  personality: '{{char}} 对 {{user}} 极其忠诚。',
  scenario: '{{char}} 和 {{user}} 正在温馨的办公室内。'
};

const mockChat = [
  { name: '哥哥', mes: '{{char}}，早安。', is_user: true },
  { name: '青子', mes: '早安，{{user}}。今天的日程已经准备好了哦。', is_user: false }
];

// 2. 定义 Pipeline
const m1Pipeline = pipeline([
  // Source 阶段
  LoadCharacterCard(mockCharacter),
  LoadChat(mockChat),
  
  // M1 核心：初始化作用域
  InitializeStScope({
    userName: '哥哥',
    charName: '青子'
  }),
  
  // M1 核心：解析模板 (建议在排序前或排序后执行，这里选排序前)
  ResolveTemplates(),
  
  // Compile 阶段
  OrderByPosition(),
  
  // Emit 阶段
  FlattenToMessages()
]);

// 3. 执行测试
async function runTest() {
  console.log('--- 正在启动 Loom-ST M1 验证流水线 (Scope & Template) ---\n');
  
  const result = await m1Pipeline.run([]);
  
  const finalFragment = result.fragments.find(f => f.id === 'openai-messages');
  
  if (finalFragment) {
    console.log('编织与解析完成！生成的 OpenAI 消息如下：');
    console.log(finalFragment.content);
    
    console.log('\n--- 作用域状态追踪 (Scope Observability) ---');
    const initSnapshot = result.snapshots.find(s => s.passName === 'ST.InitializeStScope');
    if (initSnapshot) {
      console.log('初始化后的变量池:', JSON.stringify(initSnapshot.scopeEntries, null, 2));
    }
    
    const finalSnapshot = result.snapshots[result.snapshots.length - 1];
    if (finalSnapshot) {
      console.log('\n最终结果快照包含变量:', Object.keys(finalSnapshot.scopeEntries).length, '个');
    }
  }
}

runTest().catch(console.error);
