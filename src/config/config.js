require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3001,
  mockMode: process.env.MOCK_MODE === "true" || false,
  obs: {
    host: process.env.OBS_WS_HOST || "ws://127.0.0.1:4456",
    password: process.env.OBS_WS_PASSWORD,
  },
  cors: {
    origin: [
      "http://localhost:8080",
      "http://localhost:8081",
      "http://192.168.0.234:8081",
      "exp://192.168.0.234:8081",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  websocket: {
    heartbeatInterval: process.env.WS_HEARTBEAT_INTERVAL || 30000,
    maxReconnectAttempts: process.env.WS_MAX_RECONNECT_ATTEMPTS || 5,
    reconnectInterval: process.env.WS_RECONNECT_INTERVAL || 3000,
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableWebSocketLogs: process.env.WS_ENABLE_LOGS !== "false",
  },
};
