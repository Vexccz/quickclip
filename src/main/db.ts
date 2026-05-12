import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { app } from 'electron';
import type { ClipItem, ClipType, Category, Settings } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';

let db: Database.Database;

export function initDb(): void {
  const dir = path.join(app.getPath('userData'));
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'history.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      preview TEXT,
      imageDataUrl TEXT,
      ocrText TEXT,
      ocrStatus TEXT DEFAULT 'none',
      linkTitle TEXT,
      linkDescription TEXT,
      linkImage TEXT,
      linkStatus TEXT DEFAULT 'none',
      pinned INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      hash TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS idx_clips_updated ON clips(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_clips_pinned ON clips(pinned DESC, updatedAt DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function hashContent(type: ClipType, content: string): string {
  return crypto.createHash('sha256').update(`${type}:${content}`).digest('hex');
}

export interface InsertClipInput {
  type: ClipType;
  category: Category;
  content: string;
  preview: string | null;
  imageDataUrl?: string | null;
  ocrStatus?: 'none' | 'pending' | 'done' | 'error';
  linkStatus?: 'none' | 'pending' | 'done' | 'error';
}

export function upsertClip(input: InsertClipInput): ClipItem {
  const now = Date.now();
  const hash = hashContent(input.type, input.content);

  const existing = db
    .prepare('SELECT * FROM clips WHERE hash = ?')
    .get(hash) as ClipItem | undefined;

  if (existing) {
    db.prepare('UPDATE clips SET updatedAt = ? WHERE id = ?').run(now, existing.id);
    return { ...existing, updatedAt: now };
  }

  const stmt = db.prepare(`
    INSERT INTO clips (type, category, content, preview, imageDataUrl,
                       ocrStatus, linkStatus, pinned, createdAt, updatedAt, hash)
    VALUES (@type, @category, @content, @preview, @imageDataUrl,
            @ocrStatus, @linkStatus, 0, @createdAt, @updatedAt, @hash)
  `);
  const info = stmt.run({
    type: input.type,
    category: input.category,
    content: input.content,
    preview: input.preview,
    imageDataUrl: input.imageDataUrl ?? null,
    ocrStatus: input.ocrStatus ?? 'none',
    linkStatus: input.linkStatus ?? 'none',
    createdAt: now,
    updatedAt: now,
    hash
  });

  return getClip(Number(info.lastInsertRowid))!;
}

export function getClip(id: number): ClipItem | null {
  const row = db.prepare('SELECT * FROM clips WHERE id = ?').get(id) as ClipItem | undefined;
  return row ?? null;
}

export function listClips(limit = 1000): ClipItem[] {
  return db
    .prepare('SELECT * FROM clips ORDER BY pinned DESC, updatedAt DESC LIMIT ?')
    .all(limit) as ClipItem[];
}

export function deleteClip(id: number): void {
  db.prepare('DELETE FROM clips WHERE id = ?').run(id);
}

export function clearAll(): void {
  db.prepare('DELETE FROM clips WHERE pinned = 0').run();
}

export function togglePin(id: number): void {
  db.prepare('UPDATE clips SET pinned = 1 - pinned, updatedAt = updatedAt WHERE id = ?').run(id);
}

export function trimHistory(maxItems: number): number {
  const stmt = db.prepare(`
    DELETE FROM clips
    WHERE pinned = 0
      AND id NOT IN (
        SELECT id FROM clips WHERE pinned = 0
        ORDER BY updatedAt DESC LIMIT ?
      )
  `);
  const info = stmt.run(maxItems);
  return info.changes;
}

export function updateOcr(id: number, text: string, status: 'done' | 'error'): void {
  db.prepare('UPDATE clips SET ocrText = ?, ocrStatus = ? WHERE id = ?').run(text, status, id);
}

export function updateLinkPreview(
  id: number,
  data: { title: string | null; description: string | null; image: string | null },
  status: 'done' | 'error'
): void {
  db.prepare(
    'UPDATE clips SET linkTitle = ?, linkDescription = ?, linkImage = ?, linkStatus = ? WHERE id = ?'
  ).run(data.title, data.description, data.image, status, id);
}

// ---------- Settings ----------

export function loadSettings(): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out as unknown as Settings;
}

export function saveSettings(partial: Partial<Settings>): Settings {
  const current = loadSettings();
  const next = { ...current, ...partial };
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries: [string, unknown][]) => {
    for (const [k, v] of entries) stmt.run(k, JSON.stringify(v));
  });
  tx(Object.entries(next));
  return next;
}
