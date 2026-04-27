import { Pass } from '@loom/core';
import { StMeta } from '../../types.js';

export interface StScopeOptions {
  userName?: string;
  charName?: string;
}

/**
 * 初始化 SillyTavern 的变量作用域 (Scope)
 */
export function InitializeStScope(options: StScopeOptions): Pass<StMeta> {
  return {
    name: 'ST.InitializeStScope',
    run: (fragments, ctx) => {
      // 将变量写入全局作用域
      if (options.userName) {
        ctx.scope.set('user', options.userName);
      }
      
      if (options.charName) {
        ctx.scope.set('char', options.charName);
      }

      // 如果有角色卡碎片，也可以从中提取更多变量
      const charCard = fragments.find(f => f.meta.kind === 'character-card');
      if (charCard && charCard.meta.author && !ctx.scope.has('char')) {
        ctx.scope.set('char', charCard.meta.author);
      }

      // Source Pass 通常原样返回碎片，只修改 scope
      return [...fragments];
    }
  };
}
