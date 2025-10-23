require("express-async-errors");
require("dotenv/config");
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const AppError = require("./utils/AppError");
const uploadConfig = require("./configs/upload");
const cookieParser = require("cookie-parser");
const logger = require("./configs/logger");

const app = express();

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use(routes);
app.use("/files", express.static(uploadConfig.UPLOADS_FOLDER));

// Error handling middleware
app.use((error, request, response, next) => {
  if (error instanceof AppError) {
    logger.warn(
      `AppError: ${error.message} | Status: ${error.statusCode} | Path: ${request.path}`
    );
    return response.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }

  logger.error(`Internal Server Error: ${error.message}`, { stack: error.stack });

  return response.status(500).json({
    status: "error",
    message: "internal server error",
  });
});

const PORT = process.env.SERVER_PORT || 3333;
app.listen(PORT, () => {
  logger.info(`Sushihana API - Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});
