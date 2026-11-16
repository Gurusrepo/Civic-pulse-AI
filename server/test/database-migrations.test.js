import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-migrations-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDirectory, 'runner.sqlite');
process.env.JWT_SECRET = 'migration-test-secret-long-enough-to-validate';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';

const { migrateDatabase } = await import('../src/database/migrate.js');
const { up: createCoreSchema } = await import('../src/database/migrations/001_core_schema.js');
import * as coreMigration from '../src/database/migrations/001_core_schema.js';
import * as civicIssueMigration from '../src/database/migrations/002_civic_issues.js';
import * as assignmentMigration from '../src/database/migrations/003_issue_assignments.js';
import * as groupingMigration from '../src/database/migrations/004_issue_grouping.js';
const { db: defaultDb, closeDatabase } = await import('../src/config/database.js');

after(() => {
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('fresh initialization applies each migration once and creates the full schema', () => {
  const fresh = new Database(':memory:');
  fresh.pragma('foreign_keys = ON');
  assert.deepEqual(migrateDatabase(fresh), ['001_core_schema', '002_civic_issues', '003_issue_assignments', '004_issue_grouping', '005_ward_team_management', '006_issue_team_assignments', '007_officer_workflow_evidence', '008_citizen_resolution_verification']);
  assert.deepEqual(migrateDatabase(fresh), []);
  assert.equal(fresh.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 8);
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='wards'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ward_teams'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ward_team_memberships'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='civic_issue_team_assignment_events'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='civic_issue_repair_evidence'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='civic_issue_work_events'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='civic_issue_resolution_verifications'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='civic_issue_dispute_reviews'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'civic_issues'").get());
  assert.ok(fresh.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'civic_issue_duplicate_suggestions'").get());
  assert.ok(fresh.prepare('PRAGMA table_info(complaints)').all().some((column) => column.name === 'civic_issue_id'));
  assert.ok(fresh.prepare('PRAGMA table_info(civic_issues)').all().some((column) => column.name === 'assigned_officer_id'));
  assert.ok(fresh.prepare('PRAGMA table_info(civic_issues)').all().some((column) => column.name === 'assigned_team_id'));
  fresh.close();
});

test('existing complaint, media, user and AI assessment data survive issue backfill', () => {
  const existing = new Database(':memory:');
  existing.pragma('foreign_keys = ON');
  createCoreSchema(existing);
  existing.prepare(`INSERT INTO users (id, display_name, email, password_hash, role)
    VALUES (1, 'Existing Citizen', 'citizen@example.test', 'hash', 'CITIZEN')`).run();
  existing.prepare(`INSERT INTO complaints (id, user_id, title, description, latitude, longitude, status)
    VALUES (11, 1, 'Pothole', 'A pothole near a crossing.', 1, 2, 'SUBMITTED')`).run();
  existing.prepare(`INSERT INTO complaint_media
    (id, complaint_id, uploader_id, object_key, media_type, mime_type, byte_size)
    VALUES (21, 11, 1, 'complaints/existing.jpg', 'IMAGE', 'image/jpeg', 100)`).run();
  existing.prepare(`INSERT INTO complaint_ai_assessments
    (id, complaint_id, status, category, department, severity, severity_reason, risk_factors,
     confidence, human_review_required, human_review_reason)
    VALUES (31, 11, 'SUCCEEDED', 'ROAD_DAMAGE', 'Roads & Infrastructure', 'MEDIUM',
      'A reported road defect.', '[]', 0.8, 0, '')`).run();

  assert.deepEqual(migrateDatabase(existing), ['001_core_schema', '002_civic_issues', '003_issue_assignments', '004_issue_grouping', '005_ward_team_management', '006_issue_team_assignments', '007_officer_workflow_evidence', '008_citizen_resolution_verification']);
  const linked = existing.prepare(`SELECT c.id, c.user_id, c.status, c.civic_issue_id, i.status AS issue_status
    FROM complaints c JOIN civic_issues i ON i.id = c.civic_issue_id WHERE c.id = 11`).get();
  assert.equal(linked.id, 11);
  assert.equal(linked.user_id, 1);
  assert.equal(linked.status, 'SUBMITTED');
  assert.equal(linked.issue_status, 'OPEN');
  assert.ok(linked.civic_issue_id > 0);
  assert.equal(existing.prepare('SELECT COUNT(*) AS count FROM complaint_media WHERE id = 21').get().count, 1);
  assert.equal(existing.prepare('SELECT COUNT(*) AS count FROM complaint_ai_assessments WHERE id = 31').get().count, 1);
  assert.equal(existing.prepare('PRAGMA foreign_key_check').all().length, 0);

  const issueCount = existing.prepare('SELECT COUNT(*) AS count FROM civic_issues').get().count;
  assert.deepEqual(migrateDatabase(existing), []);
  assert.equal(existing.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 8);
  assert.equal(existing.prepare('SELECT COUNT(*) AS count FROM civic_issues').get().count, issueCount);
  assert.throws(() => existing.prepare('UPDATE complaints SET civic_issue_id = 999 WHERE id = 11').run());
  existing.close();
});

test('ward migration preserves existing individual assignment and append-only history', () => {
  const legacy = new Database(':memory:');
  legacy.pragma('foreign_keys = ON');
  for (const migration of [coreMigration, civicIssueMigration, assignmentMigration, groupingMigration]) migration.up(legacy);
  legacy.prepare(`INSERT INTO users(id,display_name,email,password_hash,role) VALUES
    (1,'Legacy Admin','legacy-admin@example.test','hash','ADMIN'),
    (2,'Legacy Officer','legacy-officer@example.test','hash','OFFICER')`).run();
  const issueId = Number(legacy.prepare('INSERT INTO civic_issues DEFAULT VALUES').run().lastInsertRowid);
  legacy.prepare('UPDATE civic_issues SET assigned_officer_id=? WHERE id=?').run(2, issueId);
  legacy.prepare(`INSERT INTO civic_issue_assignment_events
    (civic_issue_id,event_type,previous_officer_id,officer_id,admin_user_id)
    VALUES(?,'ASSIGNED',NULL,2,1)`).run(issueId);
  legacy.exec(`CREATE TABLE schema_migrations (
    version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  for (const version of ['001_core_schema','002_civic_issues','003_issue_assignments','004_issue_grouping']) {
    legacy.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(version);
  }

  assert.deepEqual(migrateDatabase(legacy), ['005_ward_team_management', '006_issue_team_assignments', '007_officer_workflow_evidence', '008_citizen_resolution_verification']);
  assert.equal(legacy.prepare('SELECT assigned_officer_id FROM civic_issues WHERE id=?').get(issueId).assigned_officer_id, 2);
  assert.deepEqual(legacy.prepare(`SELECT event_type,officer_id,admin_user_id
    FROM civic_issue_assignment_events WHERE civic_issue_id=?`).get(issueId), {
    event_type: 'ASSIGNED', officer_id: 2, admin_user_id: 1
  });
  legacy.close();
});

test('the shared startup database can be initialized repeatedly without reapplying migrations', () => {
  assert.deepEqual(migrateDatabase(defaultDb), ['001_core_schema', '002_civic_issues', '003_issue_assignments', '004_issue_grouping', '005_ward_team_management', '006_issue_team_assignments', '007_officer_workflow_evidence', '008_citizen_resolution_verification']);
  assert.deepEqual(migrateDatabase(defaultDb), []);
  assert.equal(defaultDb.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 8);
});
