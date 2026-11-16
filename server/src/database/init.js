import { db, closeDatabase } from '../config/database.js';
import { migrateDatabase } from './migrate.js';

try {
  const applied = migrateDatabase(db);
  console.log(`SQLite migrations complete (${applied.length} applied).`);
} catch (error) {
  console.error('SQLite initialization failed.');
  throw error;
} finally {
  closeDatabase();
}
