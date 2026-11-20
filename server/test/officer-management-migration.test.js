import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import * as migration from '../src/database/migrations/027_officer_management.js';

test('officer migration preserves existing users and adds unique IDs plus append-only account history', () => {
  const db = new Database(':memory:');
  try {
    db.exec(`CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      role TEXT NOT NULL,
      account_status TEXT NOT NULL
    );
    CREATE TABLE ward_team_memberships (officer_user_id INTEGER);`);
    db.prepare('INSERT INTO users(id,role,account_status) VALUES(1,?,?),(2,?,?)')
      .run('OFFICER', 'ACTIVE', 'ADMIN', 'ACTIVE');
    migration.up(db);

    assert.deepEqual(db.prepare('SELECT id,role,account_status,employee_id FROM users ORDER BY id').all(), [
      { id: 1, role: 'OFFICER', account_status: 'ACTIVE', employee_id: null },
      { id: 2, role: 'ADMIN', account_status: 'ACTIVE', employee_id: null }
    ]);
    db.prepare('UPDATE users SET employee_id=? WHERE id=1').run('EMP-1');
    assert.throws(() => db.prepare('UPDATE users SET employee_id=? WHERE id=2').run('EMP-2'));
    assert.throws(() => db.prepare('INSERT INTO users(id,role,account_status,employee_id) VALUES(3,?,?,?)')
      .run('OFFICER', 'ACTIVE', 'emp-1'));

    db.prepare(`INSERT INTO officer_account_events
      (officer_user_id,admin_user_id,event_type,next_status) VALUES(1,2,'CREATED','ACTIVE')`).run();
    assert.throws(() => db.prepare('UPDATE officer_account_events SET next_status=next_status').run());
    assert.throws(() => db.prepare('DELETE FROM officer_account_events').run());
  } finally {
    db.close();
  }
});
