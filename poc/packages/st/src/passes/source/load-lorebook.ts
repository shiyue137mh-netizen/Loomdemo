import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 将 SillyTavern 的世界书 (Lorebook) 转换为 DataFragment
 * @param lorebook ST 的世界书 JSON
 */
export function LoadLorebook(lorebook: any): Pass<StMeta> {
  return {
    name: 'ST.LoadLorebook',
    run: (fragments) => {
      const rawEntries = lorebook.entries || [];
      const entries = Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries);
      const entryFragments: ResolvedFragment<StMeta>[] = entries.map((entry: any, index: number) => {
        return {
          id: `wi-${index}`,
          content: entry.content,
          meta: {
            kind: 'worldinfo-entry',
            role: 'system',
            // 常驻条目默认激活，非常驻条目默认关闭
            active: entry.constant || false,
            order: entry.order ?? 100,
            depth: 0, // 默认放在顶部
            // 存储关键词用于后续激活扫描
            extra: {
              keys: entry.key || entry.keys || [],
              comment: entry.comment || '',
              constant: entry.constant || false
            }
          }
        };
      });

      return [...fragments, ...entryFragments];
    }
  };
}
