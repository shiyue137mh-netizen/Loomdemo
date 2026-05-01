import fs from 'node:fs/promises';
import path from 'node:path';
import { PipelineResult } from '@loom/core';

const SNAPSHOT_DIR = '.loom/snapshots';

/**
 * 快照存储器：负责持久化 Pipeline 的运行结果
 */
export class SnapshotStore {
  constructor(private baseDir: string = process.cwd()) {}

  async save(name: string, result: PipelineResult<any>): Promise<string> {
    const dir = path.join(this.baseDir, SNAPSHOT_DIR);
    await fs.mkdir(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.json`;
    const filePath = path.join(dir, filename);

    // 序列化结果，由于 snapshots 可能很大，这里可以做一些精简
    const data = JSON.stringify(result, null, 2);
    await fs.writeFile(filePath, data);
    
    return filePath;
  }

  async list(): Promise<string[]> {
    const dir = path.join(this.baseDir, SNAPSHOT_DIR);
    try {
      const files = await fs.readdir(dir);
      return files.filter(f => f.endsWith('.json')).sort().reverse();
    } catch {
      return [];
    }
  }

  async load(filename: string): Promise<PipelineResult<any>> {
    const filePath = path.join(this.baseDir, SNAPSHOT_DIR, filename);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  }
}
