import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

export type DocId = `${string}:${string}`;

export interface Document<T = any> {
  id: DocId;
  type: string;
  version: number;
  data: T;
  meta: {
    createdAt: string;
    updatedAt: string;
    pluginId: string;
    tags?: string[];
  };
}

export class DocumentStore {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        meta TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
    `);
  }

  get<T = any>(id: DocId): Document<T> | null {
    const row = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...row,
      data: JSON.parse(row.data),
      meta: JSON.parse(row.meta),
    };
  }

  put<T = any>(doc: Omit<Document<T>, 'version' | 'meta'> & { pluginId: string; tags?: string[] }): Document<T> {
    const now = new Date().toISOString();
    const existing = this.get(doc.id);
    const version = existing ? existing.version + 1 : 1;
    
    const meta = {
      createdAt: existing ? existing.meta.createdAt : now,
      updatedAt: now,
      pluginId: doc.pluginId,
      tags: doc.tags,
    };

    const row = {
      id: doc.id,
      type: doc.type,
      version,
      data: JSON.stringify(doc.data),
      meta: JSON.stringify(meta),
    };

    this.db.prepare(`
      INSERT INTO documents (id, type, version, data, meta)
      VALUES (@id, @type, @version, @data, @meta)
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version,
        data = excluded.data,
        meta = excluded.meta
    `).run(row);

    return {
      ...row,
      data: doc.data,
      meta,
    };
  }

  list<T = any>(type: string): Document<T>[] {
    const rows = this.db.prepare('SELECT * FROM documents WHERE type = ?').all(type) as any[];
    return rows.map(row => ({
      ...row,
      data: JSON.parse(row.data),
      meta: JSON.parse(row.meta),
    }));
  }

  delete(id: DocId) {
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  }

  close() {
    this.db.close();
  }
}
