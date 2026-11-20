import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-admin-bootstrap-'));
const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDirectory, 'default.sqlite');
process.env.JWT_SECRET = 'admin-bootstrap-test-secret-long-enough';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';

const { closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
const { AdminBootstrapError, bootstrapInitialAdmin } = await import('../src/modules/admin/bootstrap.service.js');

after(() => {
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

function createDatabase() {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  migrateDatabase(database);
  return database;
}

function runScript(script, databasePath, variables) {
  return spawnSync(process.execPath, [path.join(serverDirectory, 'scripts', script)], {
    cwd: serverDirectory,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_PATH: databasePath,
      ...variables
    }
  });
}

test('initial Admin is created once with a bcrypt hash and unverified email', async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  const password = 'a-private-test-password';
  const result = await bootstrapInitialAdmin({
    displayName: 'Initial Admin',
    email: '  ADMIN@example.test ',
    password
  }, database);

  const admin = database.prepare(`SELECT display_name,email,password_hash,role,email_verified,account_status
    FROM users WHERE id=?`).get(result.userId);

  assert.equal(admin.display_name, 'Initial Admin');
  assert.equal(admin.email, 'admin@example.test');
  assert.equal(admin.role, 'ADMIN');
  assert.equal(admin.email_verified, 0);
  assert.equal(admin.account_status, 'ACTIVE');
  assert.notEqual(admin.password_hash, password);
  assert.equal(await bcrypt.compare(password, admin.password_hash), true);
});

test('invalid initial Admin details are rejected before creating a user', async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  await assert.rejects(
    bootstrapInitialAdmin({
      displayName: 'Initial Admin',
      email: 'not-an-email',
      password: 'a-private-test-password'
    }, database),
    AdminBootstrapError
  );
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0);
});

test('bootstrap refuses to overwrite an existing Admin or an existing account email', async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  database.prepare(`INSERT INTO users (display_name,email,password_hash,role)
    VALUES ('Existing Admin','admin@example.test','existing-hash','ADMIN')`).run();

  await assert.rejects(
    bootstrapInitialAdmin({
      displayName: 'Replacement Admin',
      email: 'admin@example.test',
      password: 'a-private-test-password'
    }, database),
    AdminBootstrapError
  );
  assert.deepEqual(database.prepare('SELECT display_name,email,password_hash,role FROM users').get(), {
    display_name: 'Existing Admin',
    email: 'admin@example.test',
    password_hash: 'existing-hash',
    role: 'ADMIN'
  });

  const citizenDatabase = createDatabase();
  t.after(() => citizenDatabase.close());
  citizenDatabase.prepare(`INSERT INTO users (display_name,email,password_hash,role)
    VALUES ('Existing Citizen','admin@example.test','citizen-hash','CITIZEN')`).run();

  await assert.rejects(
    bootstrapInitialAdmin({
      displayName: 'Initial Admin',
      email: 'admin@example.test',
      password: 'a-private-test-password'
    }, citizenDatabase),
    AdminBootstrapError
  );
  assert.equal(citizenDatabase.prepare('SELECT display_name,password_hash,role FROM users').get().display_name,
    'Existing Citizen');
});

test('simultaneous initial bootstrap attempts create exactly one Admin', async (t) => {
  const database = createDatabase();
  t.after(() => database.close());

  const results = await Promise.allSettled([
    bootstrapInitialAdmin({
      displayName: 'Admin One',
      email: 'one@example.test',
      password: 'a-private-test-password-one'
    }, database),
    bootstrapInitialAdmin({
      displayName: 'Admin Two',
      email: 'two@example.test',
      password: 'a-private-test-password-two'
    }, database)
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM users WHERE role='ADMIN'").get().count, 1);
});

test('bootstrap command does not print credentials and refuses a second run', () => {
  const databasePath = path.join(tempDirectory, 'bootstrap-command.sqlite');
  const email = 'initial-admin@example.test';
  const password = 'private-test-bootstrap-password';
  const first = runScript('bootstrap-admin.js', databasePath, {
    SEED_DISPLAY_NAME: 'Initial Admin',
    SEED_EMAIL: email,
    SEED_PASSWORD: password,
    SEED_ROLE: 'OFFICER'
  });

  assert.equal(first.status, 0, first.stderr);
  assert.doesNotMatch(first.stdout, new RegExp(email));
  assert.doesNotMatch(first.stdout, new RegExp(password));

  const second = runScript('bootstrap-admin.js', databasePath, {
    SEED_DISPLAY_NAME: 'Replacement Admin',
    SEED_EMAIL: email,
    SEED_PASSWORD: 'another-private-test-password',
    SEED_ROLE: 'ADMIN'
  });

  assert.equal(second.status, 1);
  assert.doesNotMatch(second.stderr, new RegExp(email));
  assert.doesNotMatch(second.stderr, new RegExp(password));

  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  const admin = database.prepare("SELECT display_name,role FROM users WHERE role='ADMIN'").get();
  assert.deepEqual(admin, { display_name: 'Initial Admin', role: 'ADMIN' });
  database.close();
});

test('development seed command cannot provision Admins or overwrite an Officer', () => {
  const adminSeed = runScript('seed-users.js', path.join(tempDirectory, 'admin-seed.sqlite'), {
    SEED_DISPLAY_NAME: 'Initial Admin',
    SEED_EMAIL: 'initial-admin@example.test',
    SEED_PASSWORD: 'private-test-bootstrap-password',
    SEED_ROLE: 'ADMIN'
  });
  assert.equal(adminSeed.status, 1);

  const databasePath = path.join(tempDirectory, 'officer-seed.sqlite');
  const first = runScript('seed-users.js', databasePath, {
    SEED_DISPLAY_NAME: 'First Officer',
    SEED_EMAIL: 'officer@example.test',
    SEED_PASSWORD: 'private-test-officer-password',
    SEED_ROLE: 'OFFICER'
  });
  assert.equal(first.status, 0, first.stderr);
  assert.doesNotMatch(first.stdout, /officer@example\.test|private-test-officer-password/);

  const repeated = runScript('seed-users.js', databasePath, {
    SEED_DISPLAY_NAME: 'Replacement Officer',
    SEED_EMAIL: 'officer@example.test',
    SEED_PASSWORD: 'replacement-private-password',
    SEED_ROLE: 'OFFICER'
  });
  assert.equal(repeated.status, 1);

  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  const officer = database.prepare('SELECT display_name,role FROM users WHERE email=?').get('officer@example.test');
  assert.deepEqual(officer, { display_name: 'First Officer', role: 'OFFICER' });
  database.close();
});
