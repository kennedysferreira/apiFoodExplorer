const { Router } = require("express");
const userRoutes = require("./user.routes");
const platesRoutes = require("./plate.routes");
const paymentRoutes = require("./payment.routes");
const sessionRoutes = require("./sessions.routes");
const favoriteRoutes = require("./favorite.routes");
const ingredientsRoutes = require("./ingredients.routes");
const ordersRoutes = require("./orders.routes");
const addressesRoutes = require("./addresses.routes");
const loyaltyRoutes = require("./loyalty.routes");
const couponsRoutes = require("./coupons.routes");

const routes = Router();

// Health check endpoint
routes.get("/", (request, response) => {
  return response.json({
    message: "Sushihana API is running",
    version: "1.0.0",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

routes.use("/users", userRoutes);
routes.use("/plates", platesRoutes);
routes.use("/ingredients", ingredientsRoutes);
routes.use("/sessions", sessionRoutes);
routes.use("/payment", paymentRoutes);
routes.use("/favorites", favoriteRoutes);
routes.use("/orders", ordersRoutes);
routes.use("/addresses", addressesRoutes);
routes.use("/loyalty", loyaltyRoutes);
routes.use("/coupons", couponsRoutes);

module.exports = routes;
