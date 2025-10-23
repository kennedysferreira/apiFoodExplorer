const { Router } = require("express");
const ensureAuth = require("../middlewares/ensureAuth");
const AddressesController = require("../controllers/AddressesController");

const addressesRoutes = Router();
const addressesController = new AddressesController();

// Todas as rotas requerem autenticação
addressesRoutes.use(ensureAuth);

addressesRoutes.post("/", addressesController.create);
addressesRoutes.get("/", addressesController.index);
addressesRoutes.get("/:id", addressesController.show);
addressesRoutes.put("/:id", addressesController.update);
addressesRoutes.delete("/:id", addressesController.delete);
addressesRoutes.patch("/:id/default", addressesController.setDefault);

module.exports = addressesRoutes;
