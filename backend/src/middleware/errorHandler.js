const notFound = (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'INVALID_JSON', message: 'Request body is not valid JSON' });
  }

  const status = err.statusCode || 500;
  if (!err.isOperational) {
    console.error('[error]', err);
  }

  const payload = {
    error: err.isOperational ? err.code : 'INTERNAL_ERROR',
    message: err.isOperational ? err.message : 'Something went wrong on the server',
  };
  if (err.details) payload.details = err.details;

  return res.status(err.isOperational ? status : 500).json(payload);
};

module.exports = { notFound, errorHandler };
