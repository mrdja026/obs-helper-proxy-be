const express = require("express");
const TokenService = require("../services/tokenService");
const logger = require("../utils/logger");
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
