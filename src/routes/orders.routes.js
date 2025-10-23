const { Router } = require("express");
const ensureAuth = require("../middlewares/ensureAuth");
const OrdersController = require("../controllers/OrdersController");

const ordersRoutes = Router();
const ordersController = new OrdersController();

// Todas as rotas requerem autenticação
ordersRoutes.use(ensureAuth);

ordersRoutes.post("/", ordersController.create);
ordersRoutes.get("/", ordersController.index);
ordersRoutes.get("/payment-status/:status", ordersController.byPaymentStatus);
ordersRoutes.get("/:id", ordersController.show);
ordersRoutes.patch("/:id", ordersController.update);
ordersRoutes.patch("/:id/confirm-payment", ordersController.confirmPayment);
ordersRoutes.delete("/:id", ordersController.delete);

module.exports = ordersRoutes;
