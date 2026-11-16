export const version = '001_core_schema';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CITIZEN' CHECK (role IN ('CITIZEN', 'OFFICER', 'ADMIN')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
      description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 5000),
      latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
      longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
      location_accuracy_meters REAL CHECK (location_accuracy_meters IS NULL OR location_accuracy_meters > 0),
      status TEXT NOT NULL DEFAULT 'SUBMITTED',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_complaints_user_created
      ON complaints(user_id, created_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS complaint_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      uploader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      object_key TEXT NOT NULL UNIQUE,
      media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO')),
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK (byte_size > 0),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_complaint_media_complaint
      ON complaint_media(complaint_id, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_complaint_media_uploader
      ON complaint_media(uploader_id);

    CREATE TABLE IF NOT EXISTS complaint_ai_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
      category TEXT CHECK (category IS NULL OR category IN (
        'ROAD_DAMAGE', 'WATER_SUPPLY', 'DRAINAGE', 'WASTE_MANAGEMENT',
        'STREETLIGHT', 'PUBLIC_HEALTH', 'PUBLIC_PROPERTY', 'OTHER'
      )),
      department TEXT CHECK (department IS NULL OR department IN (
        'Roads & Infrastructure', 'Water Supply', 'Drainage', 'Sanitation',
        'Electricity', 'Public Health', 'Public Works', 'General Administration'
      )),
      severity TEXT CHECK (severity IS NULL OR severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      severity_reason TEXT,
      risk_factors TEXT,
      confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
      human_review_required INTEGER CHECK (
        human_review_required IS NULL OR human_review_required IN (0, 1)
      ),
      human_review_reason TEXT,
      error_code TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_assessments_complaint_created
      ON complaint_ai_assessments(complaint_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_assessments_queue
      ON complaint_ai_assessments(status, created_at, id);
  `);
}
