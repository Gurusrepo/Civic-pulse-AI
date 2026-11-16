export function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error?.name === 'MulterError') {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded photo exceeds the 5 MB limit'
      : 'Invalid multipart upload';
    return res.status(status).json({ error: message });
  }
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
  console.error('Request failed:', error?.name ?? 'Error', error?.code ?? '');
  res.status(500).json({ error: 'Internal server error' });
}
