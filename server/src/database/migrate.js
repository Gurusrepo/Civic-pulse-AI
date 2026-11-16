import { db as defaultDatabase } from '../config/database.js';
import * as coreSchema from './migrations/001_core_schema.js';
import * as civicIssues from './migrations/002_civic_issues.js';
import * as issueAssignments from './migrations/003_issue_assignments.js';
import * as issueGrouping from './migrations/004_issue_grouping.js';
import * as wardTeamManagement from './migrations/005_ward_team_management.js';
import * as issueTeamAssignments from './migrations/006_issue_team_assignments.js';
import * as officerWorkflowEvidence from './migrations/007_officer_workflow_evidence.js';

const migrations = [coreSchema, civicIssues, issueAssignments, issueGrouping, wardTeamManagement, issueTeamAssignments, officerWorkflowEvidence];

export function migrateDatabase(database = defaultDatabase) {
  const applyPendingMigrations = database.transaction(() => {
    database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`);
    const isApplied = database.prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
    const recordApplied = database.prepare('INSERT INTO schema_migrations (version) VALUES (?)');
    const applied = [];

    for (const migration of migrations) {
      if (isApplied.get(migration.version)) continue;
      migration.up(database);
      recordApplied.run(migration.version);
      applied.push(migration.version);
    }
    return applied;
  });

  return applyPendingMigrations.immediate();
}
