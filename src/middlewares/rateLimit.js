const rateLimit = require("express-rate-limit");
const logger = require("../configs/logger");

/**
 * Rate limiter geral para a API
 * Limita requisições por IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por IP
  message: {
    status: "error",
    message: "Muitas requisições deste IP, por favor tente novamente em 15 minutos.",
  },
  standardHeaders: true, // Retorna info de rate limit nos headers
  legacyHeaders: false, // Desabilita headers antigos
  handler: (req, res) => {
    logger.warn(`Rate limit excedido para IP: ${req.ip}`);
    res.status(429).json({
      status: "error",
      message: "Muitas requisições deste IP, por favor tente novamente em 15 minutos.",
    });
  },
});

/**
 * Rate limiter para autenticação
 * Mais restritivo para prevenir brute force
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Apenas 5 tentativas
  skipSuccessfulRequests: true, // Não conta requisições bem-sucedidas
  message: {
    status: "error",
    message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
  handler: (req, res) => {
    logger.warn(`Tentativas de login excedidas para IP: ${req.ip}`);
    res.status(429).json({
      status: "error",
      message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
    });
  },
});

/**
 * Rate limiter para criação de pedidos
 * Evita spam de pedidos
 */
const orderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // Máximo 10 pedidos em 5 minutos
  message: {
    status: "error",
    message: "Muitos pedidos criados. Aguarde alguns minutos.",
  },
  handler: (req, res) => {
    logger.warn(`Limite de criação de pedidos excedido para IP: ${req.ip}`);
    res.status(429).json({
      status: "error",
      message: "Muitos pedidos criados. Aguarde alguns minutos.",
    });
  },
});

/**
 * Rate limiter para confirmação de pagamentos (Admin)
 * Previne confirmações acidentais em massa
 */
const paymentConfirmLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // Máximo 20 confirmações por minuto
  message: {
    status: "error",
    message: "Muitas confirmações em pouco tempo. Aguarde um momento.",
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  orderLimiter,
  paymentConfirmLimiter,
};
