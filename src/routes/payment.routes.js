const { Router } = require("express");
const ensureAuth = require("../middlewares/ensureAuth");
const PaymentController = require("../controllers/PaymentController");
const verifyRoleAuthorization = require("../middlewares/verifyRoleAuthorization");
const { paymentConfirmLimiter } = require("../middlewares/rateLimit");

const paymentRoutes = Router();
const paymentController = new PaymentController();

// ========================================
// NOVAS ROTAS - Sistema de Confirmação Manual
// ========================================

// Listar pedidos pendentes de confirmação (Admin)
paymentRoutes.get(
  "/pending",
  ensureAuth,
  verifyRoleAuthorization("admin"),
  paymentController.listPending
);

// Histórico de confirmações (Admin)
paymentRoutes.get(
  "/history",
  ensureAuth,
  verifyRoleAuthorization("admin"),
  paymentController.confirmationHistory
);

// Confirmar pagamento manualmente (Admin)
paymentRoutes.post(
  "/confirm/:id",
  ensureAuth,
  verifyRoleAuthorization("admin"),
  paymentConfirmLimiter,
  paymentController.confirmPayment
);

// Rejeitar pagamento (Admin)
paymentRoutes.patch(
  "/reject/:id",
  ensureAuth,
  verifyRoleAuthorization("admin"),
  paymentConfirmLimiter,
  paymentController.rejectPayment
);

// ========================================
// ROTAS LEGADAS (compatibilidade)
// ========================================

paymentRoutes.get("/:id", ensureAuth, paymentController.show);
paymentRoutes.put("/qrcode/:id", paymentController.execute);
paymentRoutes.get("/", ensureAuth, paymentController.index);
paymentRoutes.post("/", ensureAuth, paymentController.create);
paymentRoutes.patch(
  "/:id",
  ensureAuth,
  verifyRoleAuthorization("admin"),
  paymentController.update
);

module.exports = paymentRoutes;
