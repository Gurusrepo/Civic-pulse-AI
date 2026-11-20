import Database from 'better-sqlite3';
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-long-enough-for-test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-test';
import { migrations } from '../src/database/migrate.js';

const db = new Database(':memory:');
db.pragma('foreign_keys = OFF');
db.pragma('legacy_alter_table = ON');
for (const m of migrations.slice(0, 24)) m.up(db);
db.pragma('legacy_alter_table = OFF');
db.pragma('foreign_keys = ON');

const triggers = db.prepare(`SELECT name FROM sqlite_master WHERE type='trigger'`).all();
console.log('Triggers after 001-024:', JSON.stringify(triggers.map(t => t.name)));
