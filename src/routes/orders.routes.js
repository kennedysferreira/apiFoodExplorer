const { Router } = require("express");
const ensureAuth = require("../middlewares/ensureAuth");
const OrdersController = require("../controllers/OrdersController");
const { orderLimiter, paymentConfirmLimiter } = require("../middlewares/rateLimit");

const ordersRoutes = Router();
const ordersController = new OrdersController();

// Todas as rotas requerem autenticação
ordersRoutes.use(ensureAuth);

// Criar pedido com rate limiter específico
ordersRoutes.post("/", orderLimiter, ordersController.create);

ordersRoutes.get("/", ordersController.index);
ordersRoutes.get("/payment-status/:status", ordersController.byPaymentStatus);
ordersRoutes.get("/:id", ordersController.show);
ordersRoutes.patch("/:id", ordersController.update);

// Confirmar pagamento com rate limiter
ordersRoutes.patch(
  "/:id/confirm-payment",
  paymentConfirmLimiter,
  ordersController.confirmPayment
);

ordersRoutes.delete("/:id", ordersController.delete);

module.exports = ordersRoutes;
