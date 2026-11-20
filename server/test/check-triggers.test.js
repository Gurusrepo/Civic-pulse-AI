import Database from 'better-sqlite3';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-triggers-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tmpDir, 'check.sqlite');
process.env.JWT_SECRET = 'test-secret-long-enough-for-test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-test';

const { migrations } = await import('../src/database/migrate.js');

test('check triggers after migrations 001-024', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = OFF');
  db.pragma('legacy_alter_table = ON');
  for (const m of migrations.slice(0, 24)) m.up(db);
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');

  const triggers = db.prepare(`SELECT name FROM sqlite_master WHERE type='trigger'`).all();
  console.log('Triggers after 001-024:', JSON.stringify(triggers.map(t => t.name)));
  
  // Now check what happens when migration 025 runs
  db.pragma('foreign_keys = OFF');
  db.pragma('legacy_alter_table = ON');
  migrations[24].up(db); // 025
  db.pragma('legacy_alter_table = OFF');
  db.pragma('foreign_keys = ON');
  
  const triggers2 = db.prepare(`SELECT name FROM sqlite_master WHERE type='trigger'`).all();
  console.log('Triggers after 025:', JSON.stringify(triggers2.map(t => t.name)));
  db.close();
});
