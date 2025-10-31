require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");
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

const resolveTlsCredentials = () => {
  const keyPath = process.env.HTTPS_KEY_PATH;
  const certPath = process.env.HTTPS_CERT_PATH;
  if (!keyPath || !certPath) {
    throw new Error(
      "HTTPS_KEY_PATH and HTTPS_CERT_PATH must be configured for HTTPS server",
    );
  }

  const resolve = (input) =>
    path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);

  try {
    return {
      key: fs.readFileSync(resolve(keyPath)),
      cert: fs.readFileSync(resolve(certPath)),
    };
  } catch (error) {
    throw new Error(
      `Failed to read HTTPS credentials (${error?.message ?? "unknown error"})`,
    );
  }
};

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
      sameSite: "none",
      secure: true,
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

// Start server (HTTPS only)
const credentials = resolveTlsCredentials();
const server = https.createServer(credentials, app);

server.listen(config.port, () => {
  logger.info(`HTTPS server is running on port ${config.port}`);

  // Setup WebSocket after server is fully started
  try {
    setupWebSocket(server);
  } catch (error) {
    logger.error("Failed to setup WebSocket", {
      cause: error,
      errorMessage: error.message,
      errorStack: error.stack,
    });
  }

  // Optional: bootstrap OBS & Chat if tokens exist (non-blocking)
  try {
    const TokenService = require("./services/tokenService");
    const config = require("./config/config");
    const obsConn = config.mockMode
      ? require("./services/obsConnectionMock")
      : require("./services/obsConnection");
    const chatSvc = require("./services/twitchChatService");
    const eventSubSvc = require("./services/twitchEventSubService");

    (async () => {
      try {
        const hasTokens = await TokenService.cacheHasValidTokens();
        if (hasTokens) {
          try {
            await obsConn.connect(config.obs.host, config.obs.password);
            logger.info("OBS bootstrap connect attempted on server start", {
              host: config.obs.host,
            });
          } catch (e) {
            logger.error("OBS bootstrap connect failed", { error: e.message });
          }

          try {
            await chatSvc.initialize(null, config.twitch.chat.connectionType);
            logger.info("Chat bootstrap initialize attempted on server start", {
              connectionType: config.twitch.chat.connectionType,
            });
          } catch (e) {
            logger.error("Chat bootstrap initialize failed", {
              error: e.message,
            });
          }

          // Initialize EventSub WS (fire-and-forget)
          try {
            const res = await eventSubSvc.initialize(null);
            if (res?.success) {
              logger.info("EventSub WS initialized on server start");
            } else {
              logger.warn("EventSub WS init failed/skipped", {
                reason: res?.error,
              });
            }
          } catch (e) {
            logger.error("EventSub bootstrap failed", { error: e.message });
          }
        }
      } catch (e) {
        logger.error("Bootstrap precheck failed", { error: e.message });
      }
    })();
  } catch (e) {
    logger.error("Bootstrap scheduling failed", { error: e.message });
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! 💥 Shutting down...", {
    cause: err,
    errorName: err.name,
    errorMessage: err.message,
    errorStack: err.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! 💥 Shutting down...", {
    cause: err,
    errorName: err.name,
    errorMessage: err.message,
    errorStack: err.stack,
  });
  server.close(() => {
    process.exit(1);
  });
});
