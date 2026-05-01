import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';
import ejs from 'ejs';

/**
 * 升级版模板解析器：支持 EJS 和 SillyTavern 核心宏
 */
export function ResolveTemplates(): Pass<StMeta> {
  return {
    name: 'ST.ResolveTemplates',
    run: async (fragments, ctx) => {
      // 1. 定义宏环境 (Macro Environment)
      const getvar = (path: string, options?: { defaults?: any }) => {
        const value = ctx.scope.get(path);
        return value !== undefined ? value : options?.defaults;
      };

      const setvar = (path: string, value: any) => {
        ctx.scope.set(path, value);
        return ''; // setvar 宏通常不输出内容
      };

      const addvar = (path: string, delta: any) => {
        const current = Number(ctx.scope.get(path) || 0);
        ctx.scope.set(path, current + Number(delta));
        return '';
      };

      const getwi = async (group: string | null, key: string) => {
        // 在当前碎片中查找匹配的世界书条目 (优先匹配 comment)
        const entry = fragments.find(f => 
          f.meta.kind === 'worldinfo-entry' && 
          (f.meta.extra?.comment === key || f.id === key)
        );
        
        if (!entry) {
          ctx.log(`getwi: 条目 "${key}" 未找到`);
          return '';
        }
        
        // 递归渲染条目内容，确保嵌套宏也能生效
        return await render(entry.content);
      };

      const render = async (text: string): Promise<string> => {
        if (!text) return '';
        if (!text.includes('<%') && !text.includes('{{')) return text;
        
        try {
          // 渲染 EJS 模板
          // 注意：ST 的 EJS 往往使用 _ 后缀来清理空白，如 <%_ ... _%>
          const rendered = await ejs.render(text, {
            getvar,
            setvar,
            addvar,
            getwi,
            // 基础注入
            user: ctx.scope.get('user'),
            char: ctx.scope.get('char'),
            ...ctx.scope.entries
          }, { async: true });

          // 渲染经典的 {{variable}} 宏逻辑 (作为兜底或组合使用)
          return rendered.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const val = getvar(key.trim());
            return val !== undefined ? String(val) : match;
          });
        } catch (err: any) {
          ctx.log(`EJS 渲染错误: ${err.message}`, { text: text.substring(0, 100) });
          return text;
        }
      };

      // 2. 遍历并渲染所有碎片
      const result: ResolvedFragment<StMeta>[] = [];
      for (const f of fragments) {
        // 只渲染可能包含模板的碎片类型，或者全部渲染但跳过无模板的
        if (f.meta.kind === 'worldinfo-entry' || f.meta.kind === 'preset-entry' || f.meta.kind === 'character-card') {
           const newContent = await render(f.content);
           result.push({ ...f, content: newContent });
        } else {
           result.push(f);
        }
      }

      return result;
    }
  };
}
