export function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error?.name === 'MulterError') {
  console.error('MULTER UPLOAD ERROR:', {
    code: error.code,
    field: error.field,
    message: error.message
  });

  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

  return res.status(status).json({
    error: error.message,
    code: error.code,
    field: error.field ?? null
  });
}
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    const response = { error: error.message };
    if (typeof error.code === 'string') response.code = error.code;
    if (typeof error.deliveryState === 'string') response.deliveryState = error.deliveryState;
    if (Number.isInteger(error.retryAfterSeconds) && error.retryAfterSeconds > 0) {
      response.retryAfterSeconds = error.retryAfterSeconds;
      res.set('Retry-After', String(error.retryAfterSeconds));
    }
    return res.status(error.status).json(response);
  }
  if (error?.expose === true && Number.isInteger(error.status) && error.status >= 500 && error.status < 600) {
    const response = { error: error.message };
    if (typeof error.code === 'string') response.code = error.code;
    return res.status(error.status).json(response);
  }
  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
  console.error('Request failed:', error?.name ?? 'Error', error?.code ?? '');
  res.status(500).json({ error: 'Internal server error' });
}
