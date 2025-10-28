const { Router } = require("express");
const SessionsCOntroller = require("../controllers/SessionsController");
const { authLimiter } = require("../middlewares/rateLimit");

const sessionsCOntroller = new SessionsCOntroller();

const sessionRoutes = Router();

// Aplicar rate limiter para prevenir brute force
sessionRoutes.post("/", authLimiter, sessionsCOntroller.create);

module.exports = sessionRoutes;
