require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const session = require("express-session");
const passport = require("./middleware/twitchAuth");
const { setupWebSocket } = require("./services/websocket");
const apiRoutes = require("./routes/api");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");
const { securityHeaders } = require("./middleware/security");
const logger = require("./utils/logger");
const config = require("./config/config");

const app = express();

// Security middleware
app.use(securityHeaders);

// Basic middleware
app.use(cors(config.cors));
// Handle CORS preflight for all routes
app.options("*", cors(config.cors));
app.use(express.json());
app.use(compression());

// Logging
app.use(requestLogger);

// Sessions (required for Passport to support req.isAuthenticated)
// Note: In production, set cookie.secure = true and use a proper store instead of MemoryStore.
app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Use 'lax' for localhost dev to ensure session persists across OAuth redirects; switch to 'none' + secure:true in production with cross-origin
      sameSite: "lax",
      secure: false, // set to true when behind HTTPS
    },
  })
);

// Passport initialization (enables req.isAuthenticated, req.user, req.logout)
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api", apiRoutes);

// Error handling
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Server is running on port ${config.port}`);
});

// Setup WebSocket
setupWebSocket(server);

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  logger.error(err.name, err.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...");
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
