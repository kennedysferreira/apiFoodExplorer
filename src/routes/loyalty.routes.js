const { Router } = require("express");
const ensureAuth = require("../middlewares/ensureAuth");
const LoyaltyPointsController = require("../controllers/LoyaltyPointsController");

const loyaltyRoutes = Router();
const loyaltyPointsController = new LoyaltyPointsController();

// Todas as rotas requerem autenticação
loyaltyRoutes.use(ensureAuth);

loyaltyRoutes.get("/", loyaltyPointsController.show);
loyaltyRoutes.get("/all", loyaltyPointsController.index);
loyaltyRoutes.post("/use", loyaltyPointsController.usePoints);
loyaltyRoutes.post("/add", loyaltyPointsController.addPoints);

module.exports = loyaltyRoutes;
