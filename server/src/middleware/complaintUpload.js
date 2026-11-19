import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const multipart = multer({
  storage: multer.memoryStorage(),
  limits: {
  fileSize: MAX_FILE_SIZE_BYTES,
  files: 1,
  fields: 10,
  parts: 11,
  fieldNameSize: 100,
  fieldSize: 10 * 1024
}
}).single('photo');

export function complaintUpload(req, res, next) {
  multipart(req, res, async (error) => {
    if (error) return next(error);
    if (!req.file) {
      const missingPhoto = new Error('A photo file is required');
      missingPhoto.status = 400;
      return next(missingPhoto);
    }

    try {
      const detectedType = await fileTypeFromBuffer(req.file.buffer);
      if (!detectedType || !allowedMimeTypes.has(detectedType.mime)) {
        const unsupported = new Error('Photo must be a valid JPEG, PNG, or WebP image');
        unsupported.status = 415;
        return next(unsupported);
      }
      req.file.verifiedMimeType = detectedType.mime;
      next();
    } catch (verificationError) {
      next(verificationError);
    }
  });
}

export { MAX_FILE_SIZE_BYTES };
