const express = require("express");
const { requireAuthWithDebug } = require("../middleware/auth");
const TokenService = require("../services/tokenService");
const twitchChatService = require("../services/twitchChatService");
const { SendMessageRequest, ChatEventTypes } = require("../dto/chatDto");
const logger = require("../utils/logger");
const config = require("../config/config");
const router = express.Router();

/**
 * Initialize chat connection
 * POST /api/chat/connect
 */
router.post(
  "/connect",
  async (req, res, next) => {
    try {
      await requireAuthWithDebug(req, res, next);
    } catch (error) {
      return next(error);
    }
  },
  async (req, res) => {
    try {
      logger.info("🔗 Chat connect request received", {
        userId: req.user?.id,
        username: req.user?.username,
        fromCache: req.fromCache || false,
        connectionType:
          req.body.connectionType || config.twitch.chat.connectionType,
        sessionId: req.sessionID,
      });

      // Check if tokens are valid (from session or cache)
      let tokens = TokenService.getTokens(req.session);
      if (!tokens && req.fromCache) {
        tokens = TokenService.getTokensFromCache(req.user?.id);
      }

      if (!tokens) {
        logger.warn("No valid tokens found for chat connection", {
          userId: req.user?.id,
          fromCache: req.fromCache,
          sessionId: req.sessionID,
        });
        return res.status(401).json({
          success: false,
          error: "Invalid or expired tokens. Please authenticate again.",
        });
      }

      // Get connection type from request body or use default
      const connectionType =
        req.body.connectionType || config.twitch.chat.connectionType;

      // Initialize chat service
      const result = await twitchChatService.initialize(
        req.session,
        connectionType
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            channel: result.channel,
            username: result.username,
            connectionType: result.connectionType,
            status: twitchChatService.getConnectionStatus(),
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error connecting to chat", {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to connect to chat: " + error.message,
      });
    }
  }
);

/**
 * Disconnect from chat
 * POST /api/chat/disconnect
 */
router.post(
  "/disconnect",
  async (req, res, next) => {
    try {
      await requireAuthWithDebug(req, res, next);
    } catch (error) {
      return next(error);
    }
  },
  (req, res) => {
    try {
      logger.info("🔌 Chat disconnect request received", {
        userId: req.user?.id,
        username: req.user?.username,
        fromCache: req.fromCache || false,
        sessionId: req.sessionID,
      });

      twitchChatService.disconnect();

      res.json({
        success: true,
        message: "Disconnected from chat",
      });
    } catch (error) {
      logger.error("Error disconnecting from chat", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to disconnect from chat: " + error.message,
      });
    }
  }
);

/**
 * Send a message to chat
 * POST /api/chat/send
 */
router.post(
  "/send",
  async (req, res, next) => {
    try {
      await requireAuthWithDebug(req, res, next);
    } catch (error) {
      return next(error);
    }
  },
  async (req, res) => {
    try {
      logger.info("📤 Chat send message request received", {
        userId: req.user?.id,
        username: req.user?.username,
        fromCache: req.fromCache || false,
        message:
          req.body.message?.substring(0, 50) +
          (req.body.message?.length > 50 ? "..." : ""),
        channel: req.body.channel,
        replyTo: req.body.replyToMessageId || null,
        sessionId: req.sessionID,
      });

      // Check if tokens are valid (from session or cache)
      let tokens = TokenService.getTokens(req.session);
      if (!tokens && req.fromCache) {
        tokens = TokenService.getTokensFromCache(req.user?.id);
      }

      if (!tokens) {
        logger.warn("No valid tokens found for sending message", {
          userId: req.user?.id,
          fromCache: req.fromCache,
          sessionId: req.sessionID,
        });
        return res.status(401).json({
          success: false,
          error: "Invalid or expired tokens. Please authenticate again.",
        });
      }

      // Create message request
      const messageRequest = new SendMessageRequest({
        message: req.body.message,
        channel: req.body.channel,
        replyToMessageId: req.body.replyToMessageId,
      });

      // Validate request
      const validation = messageRequest.validate();
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: "Invalid message: " + validation.errors.join(", "),
        });
      }

      // Send message
      const result = await twitchChatService.sendMessage(messageRequest);

      if (result.success) {
        logger.info("✅ Chat message sent successfully", {
          userId: req.user?.id,
          messageId: result.messageId,
          channel: result.channel,
        });
      } else {
        logger.error("❌ Chat message send failed", {
          userId: req.user?.id,
          error: result.error,
          channel: result.channel,
        });
      }

      res.json({
        success: result.success,
        data: {
          messageId: result.messageId,
          message: result.message,
          channel: result.channel,
          timestamp: result.timestamp,
        },
        error: result.error,
      });
    } catch (error) {
      logger.error("Error sending message to chat", {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        message: req.body.message?.substring(0, 50),
      });

      res.status(500).json({
        success: false,
        error: "Failed to send message: " + error.message,
      });
    }
  }
);

/**
 * Get chat connection status
 * GET /api/chat/status
 */
router.get(
  "/status",
  async (req, res, next) => {
    try {
      await requireAuthWithDebug(req, res, next);
    } catch (error) {
      return next(error);
    }
  },
  (req, res) => {
    try {
      const status = twitchChatService.getConnectionStatus();

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error("Error getting chat status", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get chat status: " + error.message,
      });
    }
  }
);

/**
 * Get token information
 * GET /api/chat/tokens
 */
router.get(
  "/tokens",
  async (req, res, next) => {
    try {
      await requireAuthWithDebug(req, res, next);
    } catch (error) {
      return next(error);
    }
  },
  (req, res) => {
    try {
      const tokens = TokenService.getTokens(req.session);
      const user = TokenService.getUserFromTokens(req.session);

      if (!tokens) {
        return res.status(401).json({
          success: false,
          error: "No tokens found",
        });
      }

      // Return token information without sensitive data
      res.json({
        success: true,
        data: {
          user: user,
          scopes: tokens.scope,
          expiresAt: tokens.expiresAt,
          tokenType: tokens.tokenType,
        },
      });
    } catch (error) {
      logger.error("Error getting token information", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get token information: " + error.message,
      });
    }
  }
);

/**
 * Refresh chat connection (disconnect and reconnect)
 * POST /api/chat/refresh
 */
router.post(
  "/refresh",
  async (req, res, next) => {
    try {
      await requireAuthWithDebug(req, res, next);
    } catch (error) {
      return next(error);
    }
  },
  async (req, res) => {
    try {
      // Check if tokens are valid
      if (!TokenService.areTokensValid(req.session)) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired tokens. Please authenticate again.",
        });
      }

      // Disconnect first
      twitchChatService.disconnect();

      // Get connection type from request body or use default
      const connectionType =
        req.body.connectionType || config.twitch.chat.connectionType;

      // Reconnect
      const result = await twitchChatService.initialize(
        req.session,
        connectionType
      );

      if (result.success) {
        res.json({
          success: true,
          data: {
            channel: result.channel,
            username: result.username,
            connectionType: result.connectionType,
            status: twitchChatService.getConnectionStatus(),
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error refreshing chat connection", {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Failed to refresh chat connection: " + error.message,
      });
    }
  }
);

module.exports = router;
