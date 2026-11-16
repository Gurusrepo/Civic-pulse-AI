import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 1, parts: 2, fieldNameSize: 100, fieldSize: 1024 }
}).single('photo');

export function repairEvidenceUpload(req, res, next) {
  multipart(req, res, async error => {
    if (error) return next(error);
    if (!req.file) {
      const missing = new Error('A repair evidence photo is required');
      missing.status = 400;
      return next(missing);
    }
    try {
      const detected = await fileTypeFromBuffer(req.file.buffer);
      if (!detected || !allowedMimeTypes.has(detected.mime)) {
        const invalid = new Error('Photo must be a valid JPEG, PNG, or WebP image');
        invalid.status = 415;
        return next(invalid);
      }
      req.file.verifiedMimeType = detected.mime;
      next();
    } catch (verificationError) { next(verificationError); }
  });
}
