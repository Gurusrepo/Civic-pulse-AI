export const version = '012_profile_images';

export function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN profile_image_key TEXT;
    ALTER TABLE users ADD COLUMN profile_image_mime_type TEXT
      CHECK (profile_image_mime_type IS NULL OR profile_image_mime_type IN ('image/jpeg','image/png','image/webp'));
  `);
}
