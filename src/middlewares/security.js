const helmet = require("helmet");

/**
 * Configura��o do Helmet para seguran�a HTTP
 * Helmet ajuda a proteger a aplica��o definindo v�rios headers HTTP
 */
const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
    },
  },

  // Remove o header X-Powered-By
  hidePoweredBy: true,

  // For�a HTTPS (desabilitar em desenvolvimento)
  hsts: {
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true,
  },

  // Previne clickjacking
  frameguard: {
    action: "deny",
  },

  // Previne MIME type sniffing
  noSniff: true,

  // Adiciona prote��o XSS
  xssFilter: true,

  // Permite recursos cross-origin (para imagens)
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
});

/**
 * Configura��o do Helmet para desenvolvimento
 * Menos restritivo para facilitar testes
 */
const helmetConfigDev = helmet({
  contentSecurityPolicy: false,
  hsts: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
});

/**
 * Middleware de sanitiza��o de inputs
 * Remove caracteres perigosos de strings
 */
const sanitizeInput = (req, res, next) => {
  // Sanitizar body
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        // Remove scripts e tags HTML perigosas
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
          .trim();
      }
    });
  }

  // Sanitizar query params
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === "string") {
        req.query[key] = req.query[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
          .trim();
      }
    });
  }

  next();
};

/**
 * Middleware para prevenir SQL Injection b�sico
 * Detecta padr�es suspeitos em inputs
 */
const sqlInjectionProtection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(union.*select)/gi,
    /(;|\-\-|\/\*|\*\/)/g,
  ];

  const checkValue = (value) => {
    if (typeof value === "string") {
      return sqlPatterns.some((pattern) => pattern.test(value));
    }
    return false;
  };

  // Verificar body
  if (req.body) {
    for (const key in req.body) {
      if (checkValue(req.body[key])) {
        return res.status(400).json({
          status: "error",
          message: "Input inv�lido detectado",
        });
      }
    }
  }

  // Verificar query params
  if (req.query) {
    for (const key in req.query) {
      if (checkValue(req.query[key])) {
        return res.status(400).json({
          status: "error",
          message: "Input inv�lido detectado",
        });
      }
    }
  }

  next();
};

module.exports = {
  helmetConfig,
  helmetConfigDev,
  sanitizeInput,
  sqlInjectionProtection,
};
