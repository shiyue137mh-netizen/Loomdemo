import { pipeline } from '@loom/core';
import { 
  LoadChat, 
  LoadCharacterCard, 
  LoadLorebook,
  OrderByPosition, 
  ActivateWorldInfo,
  FilterInactive,
  CollapseChatToUser,
  InjectStyleToSystem,
  FlattenToMessages 
} from '@loom/st';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. 从 fixtures 读取数据
async function loadFixtures() {
  const characterPath = path.join(__dirname, '../fixtures/character.json');
  const chatPath = path.join(__dirname, '../fixtures/chat.json');
  const lorebookPath = path.join(__dirname, '../fixtures/lorebook.json');
  
  const character = JSON.parse(await fs.readFile(characterPath, 'utf-8'));
  const chat = JSON.parse(await fs.readFile(chatPath, 'utf-8'));
  const lorebook = JSON.parse(await fs.readFile(lorebookPath, 'utf-8'));
  
  return { character, chat, lorebook };
}

// 3. 执行测试
async function runTest() {
  console.log('--- 正在启动 Loom-ST M0 实战验证 (World Info + Fixtures) ---\n');
  
  const { character, chat, lorebook } = await loadFixtures();

  // 2. 定义 Pipeline
  const stPipeline = pipeline([
    // Source 阶段：加载所有原始碎片
    LoadCharacterCard(character),
    LoadChat(chat),
    LoadLorebook(lorebook),
    
    // Compile 阶段：逻辑处理
    ActivateWorldInfo(), // 扫描聊天记录并激活 WI
    FilterInactive(),    // 剔除未激活的碎片
    InjectStyleToSystem(), // 【新】将文风注入到人设
    CollapseChatToUser(), // 合并聊天记录
    OrderByPosition(),   // 根据 depth/order 排序
    
    // Emit 阶段：格式化输出
    FlattenToMessages()
  ]);

  const result = await stPipeline.run([]);
  
  // 获取最终的 Emit 碎片
  const finalFragment = result.fragments.find(f => f.id === 'openai-messages');
  
  if (finalFragment) {
    console.log('编织完成！生成的 OpenAI 消息预览：');
    const messages = JSON.parse(finalFragment.content);
    console.log(JSON.stringify(messages, null, 2));
    
    console.log('\n--- 最终 System 提示词详情 ---');
    const systemMsg = messages.find((m: any) => m.role === 'system');
    console.log(systemMsg ? systemMsg.content : '未发现 System 消息');
    
    // 简单验证一下快照 (Observability)
    console.log('\n--- 流程快照记录 ---');
    result.snapshots.forEach(s => {
      console.log(`[Pass: ${s.passName}] 处理后的碎片数量: ${s.fragments.length}`);
    });
  } else {
    console.error('错误：未生成最终消息。');
  }
}

runTest().catch(console.error);
