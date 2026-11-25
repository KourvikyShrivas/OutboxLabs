const AppError = require('../utils/AppError');

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    const summary = details.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message)).join('; ');
    return next(new AppError(400, 'VALIDATION_ERROR', summary || 'Invalid request body', details));
  }
  req.body = result.data;
  return next();
};

module.exports = { validateBody };
