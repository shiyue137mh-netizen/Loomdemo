import { DataFragment } from '@loom/core';

/**
 * SillyTavern 专用的元数据结构
 */
export interface StMeta {
  /** 片段类型 */
  kind: 'chat-message' | 'worldinfo-entry' | 'preset-entry' | 'character-card' | 'authors-note' | 'rag-retrieval' | 'state-variable';
  
  /** 对应 ST 的 injection_depth (0 为顶部，正数为倒数第 N 条消息) */
  depth?: number;
  
  /** 对应 ST 的 injection_order (同 depth 下的排序优先级，默认 100) */
  order?: number;
  
  /** 角色身份 */
  role?: 'system' | 'user' | 'assistant';
  
  /** 激活状态 (主要用于世界书条目) */
  active?: boolean;
  
  /** 原始索引 (用于保持聊天记录顺序) */
  stIndex?: number;
  
  /** 发言人名称 */
  author?: string;
  
  /** 原始 extra 数据 (保留 ST 的扩展信息) */
  extra?: Record<string, any>;
  
  /** 世界书条目的注入槽位 */
  slot?: 'before' | 'after' | 'depth' | 'examples';
}

/** 扩展 DataFragment 以包含 StMeta */
export type StFragment = DataFragment & {
  meta: StMeta;
};
