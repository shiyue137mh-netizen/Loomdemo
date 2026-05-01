import { pipeline, DataFragment } from '@loom/core';
import { 
  LoadChat, 
  LoadLorebook,
  ActivateWorldInfo,
  FilterInactive,
  FlattenToMessages,
  ResolveTemplates 
} from '@loom/st';
import { renderPipelineDashboard, SnapshotStore } from '@loom/devtool';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 1. 定义 ST 适配器和 Pass ---

/**
 * 加载预设 Prompt
 */
function LoadStPreset(presetData: any) {
  return {
    name: 'ST.LoadPreset',
    run: (fragments: any[]) => {
      const presetFragments = (presetData.prompts || []).map((p: any) => ({
        id: `preset-${p.identifier || Math.random()}`,
        content: p.content,
        meta: {
          kind: 'preset-entry',
          depth: p.injection_depth ?? 0,
          order: p.injection_order ?? 100,
          role: p.role || 'system',
          active: p.enabled !== false
        }
      }));
      return [...fragments, ...presetFragments];
    }
  };
}

/**
 * 变量替换 Pass (简单版)
 */
function STMacroPass(macros: Record<string, string>) {
  return {
    name: 'ST.Macros',
    run: (fragments: DataFragment[]) => {
      return fragments.map(f => {
        let content = f.content || '';
        for (const [key, value] of Object.entries(macros)) {
          content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        // 处理一些常见的清理宏
        content = content.replace(/{{trim}}/g, '');
        return { ...f, content };
      });
    }
  };
}

/**
 * 核心排序 Pass：复刻 ST 逻辑
 */
function STSortingPass() {
  return {
    name: 'ST.Sorting',
    run: (fragments: any[]) => {
      const chatMessages = fragments
        .filter(f => f.meta.kind === 'chat-message')
        .sort((a, b) => (a.meta.stIndex ?? 0) - (b.meta.stIndex ?? 0));
      
      const injections = fragments
        .filter(f => f.meta.kind !== 'chat-message')
        .filter(f => f.meta.active !== false);

      const sortedInjections = [...injections].sort((a, b) => {
        const depthA = a.meta.depth ?? 0;
        const depthB = b.meta.depth ?? 0;
        if (depthA !== depthB) return depthA - depthB;
        
        const orderA = a.meta.order ?? 100;
        const orderB = b.meta.order ?? 100;
        if (orderA !== orderB) return orderB - orderA;

        const roles = { system: 0, user: 1, assistant: 2 };
        return (roles[a.meta.role as keyof typeof roles] ?? 0) - (roles[b.meta.role as keyof typeof roles] ?? 0);
      });

      const result = [...chatMessages];
      
      const depth0 = sortedInjections.filter(i => (i.meta.depth ?? 0) === 0);
      result.unshift(...depth0);

      const depthN = sortedInjections.filter(i => (i.meta.depth ?? 0) > 0);
      
      const groupsByDepth = new Map<number, any[]>();
      for (const i of depthN) {
        const d = i.meta.depth!;
        if (!groupsByDepth.has(d)) groupsByDepth.set(d, []);
        groupsByDepth.get(d)!.push(i);
      }

      for (const [depth, group] of groupsByDepth.entries()) {
        const injectIdx = Math.max(0, result.length - depth);
        result.splice(injectIdx, 0, ...group);
      }

      return result;
    }
  };
}

// --- 2. 运行环境 ---

async function run() {
  const presetPath = path.join(__dirname, '../../../st-data/潮汐Version Ourobros.json');
  const lorebookPath = path.join(__dirname, '../../../st-data/发条不再转动.json');
  const chatPath = path.join(__dirname, '../fixtures/chat.json');

  const preset = JSON.parse(await fs.readFile(presetPath, 'utf-8'));
  const lorebook = JSON.parse(await fs.readFile(lorebookPath, 'utf-8'));
  const chat = JSON.parse(await fs.readFile(chatPath, 'utf-8'));

  console.log('--- Loom-ST 实战演示：EJS 与酒馆宏模拟 ---\n');

  const stPipeline = pipeline([
    // Source 阶段
    LoadStPreset(preset),
    LoadChat(chat),
    LoadLorebook(lorebook),
    
    // Compile 阶段：初始化状态
    {
      name: 'ST.InitState',
      run: (fragments, ctx) => {
        ctx.scope.set('stat_data.世界.发条', 95); // 设置发条为 95 (进入阶段03)
        ctx.scope.set('user', 'Mingyue');
        ctx.scope.set('char', 'Chaoxi');
        return fragments;
      }
    },
    ActivateWorldInfo(), // 扫描并激活 WI
    ResolveTemplates(),  // 解析 EJS 和 宏
    FilterInactive(),    // 剔除未激活的碎片
    STSortingPass(),     // 核心编织逻辑
    
    // Emit 阶段
    FlattenToMessages()
  ]);

  const result = await stPipeline.run([]);
  
  // 渲染 DevTool 仪表盘 (POC)
  renderPipelineDashboard(result);

  // 持久化快照 (NEW!)
  const store = new SnapshotStore();
  const snapshotPath = await store.save('chaoxi-assembly', result);
  console.log(chalk.gray(`\n💾 快照已保存至: ${snapshotPath}`));

  const finalFragment = result.fragments.find(f => f.id === 'openai-messages');

  if (finalFragment) {
    const messages = JSON.parse(finalFragment.content);
    console.log('✅ 提示词组装完成 (含 EJS 逻辑)！');
    
    console.log('\n--- 状态检查：发条控制器触发情况 ---');
    // 检查是否包含了“发条阶段03”的内容
    const hasPhase3 = messages.some((m: any) => m.content.includes('发条阶段03') || m.content.includes('核心状态: 时间倒退加速'));
    console.log(`是否命中“发条阶段03”: ${hasPhase3 ? 'YES' : 'NO'}`);

    console.log('\n--- 渲染后的内容预览 (前 10 条) ---');
    messages.slice(0, 10).forEach((m: any, i: number) => {
      const preview = m.content.length > 80 ? m.content.substring(0, 80) + '...' : m.content;
      console.log(`[${i}] [${m.role.toUpperCase()}] ${preview}`);
    });
  }
}

run().catch(console.error);
