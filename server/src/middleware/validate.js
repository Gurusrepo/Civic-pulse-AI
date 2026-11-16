export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message }))
      });
    }
    if (property === 'query') req.validatedQuery = result.data;
    else req[property] = result.data;
    next();
  };
}
