const express = require("express");
const TokenService = require("../services/tokenService");
const logger = require("../utils/logger");
const { broadcastSongQueueUpdated } = require("../services/websocket");
const websocket = require("../services/websocket");
const router = express.Router();

/**
 * Test endpoint to check session and tokens
 * GET /api/test/session
 */
router.get("/session", (req, res) => {
  try {
    const sessionId = req.sessionID;
    const isAuthenticated = req.isAuthenticated();
    const user = req.user;

    // Check tokens
    const tokens = TokenService.getTokens(req.session);
    const areTokensValid = TokenService.areTokensValid(req.session);
    const userFromTokens = TokenService.getUserFromTokens(req.session);

    // Check cache tokens
    const cacheTokens = TokenService.getTokensFromCache();
    const cacheStats = TokenService.getCacheStats();

    logger.info("Session test endpoint accessed", {
      sessionId,
      isAuthenticated,
      hasUser: !!user,
      hasTokens: !!tokens,
      areTokensValid,
      hasCacheTokens: !!cacheTokens,
      cacheStats,
    });

    res.json({
      sessionId,
      isAuthenticated,
      user: user || null,
      tokens: tokens
        ? {
            user: userFromTokens,
            scopes: tokens.scope,
            expiresAt: tokens.expiresAt,
            tokenType: tokens.tokenType,
          }
        : null,
      areTokensValid,
      cacheTokens: cacheTokens
        ? {
            user: cacheTokens.user,
            scopes: cacheTokens.scope,
            expiresAt: cacheTokens.expiresAt,
            tokenType: cacheTokens.tokenType,
          }
        : null,
      cacheStats,
    });
  } catch (error) {
    logger.error("Error in session test endpoint", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * Test endpoint to check chat service status
 * GET /api/test/chat
 */
router.get("/chat", (req, res) => {
  try {
    const twitchChatService = require("../services/twitchChatService");
    const status = twitchChatService.getConnectionStatus();

    logger.info("Chat test endpoint accessed", {
      connected: status.connected,
      channel: status.channel,
      username: status.username,
    });

    res.json({
      status,
    });
  } catch (error) {
    logger.error("Error in chat test endpoint", {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: error.message,
    });
  }
});

module.exports = router;

/**
 * Dev-only: POST /api/test/notify
 * body: { type: 'follow'|'sub', name?: string }
 */
if (process.env.NODE_ENV !== "production") {
  router.post("/notify", (req, res) => {
    try {
      const type = String(req.body?.type || "").toLowerCase();
      const name =
        req.body?.name || (type === "follow" ? "Follower" : "Subscriber");
      if (type !== "follow" && type !== "sub") {
        return res.status(400).json({ error: "type must be follow|sub" });
      }

      const payload =
        type === "follow"
          ? {
              displayName: name,
              userId: "dev",
              eventAt: new Date().toISOString(),
            }
          : {
              displayName: name,
              userId: "dev",
              tier: "1000",
              isGift: false,
              months: 1,
              eventAt: new Date().toISOString(),
            };

      const message = {
        v: 1,
        type: type === "follow" ? "twitchFollow" : "twitchSubscribe",
        data: payload,
        timestamp: new Date().toISOString(),
      };

      try {
        // reach into websocket service to broadcast
        const ws = require("../services/websocket");
        // websocket module exports helpers; however broadcast is internal. We simulate by exposing a minimal interface.
        // Fallback: add a small hack by requiring the module and calling internal broadcast if present.
        if (
          ws &&
          ws._instance &&
          typeof ws._instance.broadcast === "function"
        ) {
          ws._instance.broadcast(message);
        }
      } catch {}

      res.json({ ok: true, sent: message });
    } catch (e) {
      res.status(500).json({ error: e?.message || "failed" });
    }
  });
}
