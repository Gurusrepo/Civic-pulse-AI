import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1, fields: 3, parts: 4, fieldNameSize: 100, fieldSize: 10 * 1024 }
}).single('screenshot');

export function supportUpload(req, res, next) {
  multipart(req, res, async (error) => {
    if (error) return next(error);
    if (!req.file) return next();
    try {
      const detected = await fileTypeFromBuffer(req.file.buffer);
      if (!detected || !allowedMimeTypes.has(detected.mime)) {
        const unsupported = new Error('Screenshot must be a valid JPEG, PNG, or WebP image');
        unsupported.status = 415;
        return next(unsupported);
      }
      req.file.verifiedMimeType = detected.mime;
      next();
    } catch (verificationError) { next(verificationError); }
  });
}
