import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 0, parts: 1, fieldNameSize: 100 }
}).single('photo');

export function profileImageUpload(req, res, next) {
  multipart(req, res, async (error) => {
    if (error) return next(error);
    if (!req.file) {
      const missingPhoto = new Error('A profile photo file is required');
      missingPhoto.status = 400;
      return next(missingPhoto);
    }
    try {
      const detected = await fileTypeFromBuffer(req.file.buffer);
      if (!detected || !allowedMimeTypes.has(detected.mime)) {
        const unsupported = new Error('Profile photo must be a valid JPEG, PNG, or WebP image');
        unsupported.status = 415;
        return next(unsupported);
      }
      req.file.verifiedMimeType = detected.mime;
      next();
    } catch (verificationError) { next(verificationError); }
  });
}
