require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3001,
  mockMode: process.env.MOCK_MODE === "true" || false,
  obs: {
    host: process.env.OBS_WS_HOST || "ws://127.0.0.1:4456",
    password: process.env.OBS_WS_PASSWORD,
    micInputName: process.env.OBS_MIC_INPUT_NAME || "Mic",
    micSceneName: process.env.OBS_MIC_SCENE_NAME || "sceen live",
  },
  cors: {
    origin: [
      "http://localhost:8084",
      "http://localhost:8081",
      "http://192.168.0.234:8081",
      "http://localhost:8082",
      "http://192.168.0.234:8082",
      "exp://192.168.0.234:8081",
      "https://127.0.0.1:8443",
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
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    redirectUri:
      process.env.SPOTIFY_REDIRECT_URI || "obshelper://oauthredirect",
    redirectUriNative:
      process.env.SPOTIFY_REDIRECT_URI_NATIVE || "obshelper://oauthredirect",
    redirectUriWeb:
      process.env.SPOTIFY_REDIRECT_URI_WEB ||
      "https://127.0.0.1:8443/oauthredirect",
    scopes: [
      "user-modify-playback-state",
      "user-read-playback-state",
      // optional scopes can be appended here: "user-read-currently-playing"
    ],
    tokenStorage: {
      method: process.env.SPOTIFY_TOKEN_STORAGE_METHOD || "file",
      filePath: process.env.SPOTIFY_TOKEN_FILE_PATH || "spotify-tokens.json",
    },
    get allowedRedirectUris() {
      return [this.redirectUriNative, this.redirectUriWeb].filter(Boolean);
    },
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    callbackUrl:
      process.env.TWITCH_CALLBACK_URL ||
      "http://localhost:3001/api/twitch/auth/callback",
    scopes: [
      "user:read:email",
      "chat:read",
      "chat:edit",
      // Added for realtime notifications via EventSub
      "channel:read:subscriptions",
      "moderator:read:followers",
    ],
    tokenStorage: {
      method: process.env.TWITCH_TOKEN_STORAGE_METHOD || "file", // "session", "file", or "hybrid"
      filePath: process.env.TWITCH_TOKEN_FILE_PATH || "twitch-tokens.json",
    },
    chat: {
      connectionType: process.env.TWITCH_CHAT_TYPE || "broadcaster", // "broadcaster" or "bot"
      botUsername: process.env.TWITCH_BOT_USERNAME,
      botOAuthToken: process.env.TWITCH_BOT_OAUTH_TOKEN,
      channelName: process.env.TWITCH_CHANNEL_NAME,
      reconnectAttempts: process.env.TWITCH_CHAT_RECONNECT_ATTEMPTS || 5,
      reconnectDelay: process.env.TWITCH_CHAT_RECONNECT_DELAY || 2000,
      enableLogging: process.env.TWITCH_CHAT_ENABLE_LOGGING !== "false",
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableWebSocketLogs: process.env.WS_ENABLE_LOGS !== "false",
  },
};
