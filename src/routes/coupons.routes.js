const { Router } = require("express");
const ensureAuth = require("../middlewares/ensureAuth");
const CouponsController = require("../controllers/CouponsController");

const couponsRoutes = Router();
const couponsController = new CouponsController();

// Todas as rotas requerem autenticação
couponsRoutes.use(ensureAuth);

couponsRoutes.post("/", couponsController.create);
couponsRoutes.get("/", couponsController.index);
couponsRoutes.get("/:id", couponsController.show);
couponsRoutes.get("/:id/statistics", couponsController.statistics);
couponsRoutes.post("/validate", couponsController.validate);
couponsRoutes.put("/:id", couponsController.update);
couponsRoutes.delete("/:id", couponsController.delete);

module.exports = couponsRoutes;
