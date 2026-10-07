/**
 * Valida body, query y params con esquemas zod.
 * Los valores ya validados (y convertidos) quedan en req.valid.{body,query,params}.
 * En Express 5 req.query es de solo lectura, por eso no se reescribe.
 */
function validate(esquemas) {
  return (req, res, next) => {
    req.valid = req.valid || {};
    for (const parte of ['params', 'query', 'body']) {
      if (!esquemas[parte]) continue;
      const resultado = esquemas[parte].safeParse(req[parte] ?? {});
      if (!resultado.success) return next(resultado.error);
      req.valid[parte] = resultado.data;
    }
    next();
  };
}

module.exports = { validate };
