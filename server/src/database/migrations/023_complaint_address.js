export const version = '023_complaint_address';

export function up(db) {
  const columns = db.prepare('PRAGMA table_info(complaints)').all();
  if (columns.some((column) => column.name === 'address')) return;

  // Nullable for legacy complaints created before addresses were persisted.
  db.exec('ALTER TABLE complaints ADD COLUMN address TEXT');
}