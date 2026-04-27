import { Pass, ResolvedFragment } from '@loom/core';
import { StMeta } from '../../types.js';

/**
 * 将 SillyTavern 的角色卡数据转换为多个 DataFragment
 * @param card ST 的角色卡 JSON 对象
 */
export function LoadCharacterCard(card: any): Pass<StMeta> {
  return {
    name: 'ST.LoadCharacterCard',
    run: (fragments) => {
      const cardFragments: ResolvedFragment<StMeta>[] = [];
      const charName = card.name || 'Char';

      // 1. 角色描述 (Description)
      if (card.description) {
        cardFragments.push({
          id: 'char-description',
          content: card.description,
          meta: { 
            kind: 'character-card', 
            role: 'system', 
            author: charName, 
            depth: 0, 
            order: 10 
          }
        });
      }

      // 2. 角色性格 (Personality)
      if (card.personality) {
        cardFragments.push({
          id: 'char-personality',
          content: card.personality,
          meta: { 
            kind: 'character-card', 
            role: 'system', 
            author: charName, 
            depth: 0, 
            order: 20 
          }
        });
      }

      // 3. 场景设定 (Scenario)
      if (card.scenario) {
        cardFragments.push({
          id: 'char-scenario',
          content: card.scenario,
          meta: { 
            kind: 'character-card', 
            role: 'system', 
            author: charName, 
            depth: 0, 
            order: 30 
          }
        });
      }

      // 4. 对话例子 (Mes Examples)
      // 注意：ST 的例子可能是未切分的字符串，M0 先将其作为整体处理
      if (card.mes_example) {
        cardFragments.push({
          id: 'char-examples',
          content: card.mes_example,
          meta: { 
            kind: 'character-card', 
            role: 'system', 
            author: charName, 
            depth: 0, 
            order: 40 
          }
        });
      }

      return [...fragments, ...cardFragments];
    }
  };
}
