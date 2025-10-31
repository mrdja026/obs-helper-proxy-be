const express = require("express");
const passport = require("../middleware/twitchAuth");
const { requireAuth } = require("../middleware/auth");
const TokenService = require("../services/tokenService");
const websocket = require("../services/websocket");
const config = require("../config/config");
const router = express.Router();

// Twitch authentication routes
router.get(
  "/auth",
  passport.authenticate("twitch", { scope: config.twitch.scopes })
);

router.get("/auth/callback", async (req, res, next) => {
  const logger = require("../utils/logger");
  logger.info("Twitch OAuth callback: received request", {
    query: req.query,
    sessionExists: !!req.session,
    sessionId: req.sessionID,
  });
  passport.authenticate(
    "twitch",
    { failureRedirect: "http://localhost:8084/?auth=error" },
    (err, user, info) => {
      if (err) {
        logger.error("Passport authenticate error:", err);
        return res.redirect("http://localhost:8084/?auth=error");
      }
      if (!user) {
        logger.error(
          "Passport authenticate failed: no user returned. Info:",
          info
        );
        return res.redirect("http://localhost:8084/?auth=error");
      }
      // Log in the user
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          logger.error("req.logIn error:", loginErr);
          return res.redirect("http://localhost:8084/?auth=error");
        }

        // Store tokens in session using TokenService
        if (user.tokens) {
          await TokenService.storeTokens(req.session, user.tokens, user);
          logger.info("Twitch tokens stored in session", {
            userId: user.id,
            scopes: user.tokens.scope,
          });
        }

        logger.info("Twitch OAuth callback: user authenticated and logged in", {
          userId: req.user?.id,
          displayName: req.user?.displayName,
          username: req.user?.username,
        });

        // Ensure the session is persisted to store before redirecting back to frontend
        try {
          req.session.save((saveErr) => {
            if (saveErr) {
              logger.error("Session save error after login:", saveErr);
              // Still redirect, frontend will be able to use token fallback if configured
              return res.redirect("http://localhost:8084/?auth=partial");
            }

            websocket
              .broadcastTwitchStatus(req.session)
              .catch((error) =>
                logger.warn("Failed to broadcast Twitch status", {
                  error: error?.message,
                }),
              );

            // Fire-and-forget: auto-connect OBS and initialize chat after successful auth
            // Do not await; keep redirect snappy
            try {
              (async () => {
                const config = require("../config/config");
                const logger = require("../utils/logger");
                const obsConnection = config.mockMode
                  ? require("../services/obsConnectionMock")
                  : require("../services/obsConnection");
                const twitchChatService = require("../services/twitchChatService");

                try {
                  await obsConnection.connect(
                    config.obs.host,
                    config.obs.password
                  );
                  logger.info("OBS auto-connect triggered after Twitch auth", {
                    host: config.obs.host,
                  });
                } catch (e) {
                  logger.error("OBS auto-connect failed", { error: e.message });
                }

                try {
                  await twitchChatService.initialize(
                    req.session,
                    config.twitch.chat.connectionType
                  );
                  logger.info("Chat auto-connect triggered after Twitch auth", {
                    connectionType: config.twitch.chat.connectionType,
                  });
                } catch (e) {
                  logger.error("Chat auto-connect failed", {
                    error: e.message,
                  });
                }
              })();
            } catch (e) {
              logger.error("Auto-connect scheduler failed", {
                error: e.message,
              });
            }

            // Redirect to frontend with success indicator
            return res.redirect("http://localhost:8084/?auth=success");
          });
        } catch (e) {
          logger.error("Unexpected session save exception:", e);
          return res.redirect("http://localhost:8084/?auth=partial");
        }
      });
    }
  )(req, res, next);
});

router.get("/auth/logout", async (req, res) => {
  // Clear tokens from session
  await TokenService.clearTokens(req.session);

  websocket
    .broadcastTwitchStatus(req.session)
    .catch((error) => {
      const logger = require("../utils/logger");
      logger.warn("Failed to broadcast Twitch status after logout", {
        error: error?.message,
      });
    });

  req.logout(async (err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Session destruction failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
});

// Protected route example
router.get("/profile", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Get authentication status
router.get("/status", async (req, res) => {
  try {
    const isSessionAuth = req.isAuthenticated && req.isAuthenticated();
    if (isSessionAuth) {
      return res.json({
        authenticated: true,
        method: "session",
        user: req.user || null,
        hasRefresh: true,
      });
    }

    const tokens = await TokenService.getTokens(req.session, { allowExpired: true });
    if (!tokens) {
      return res.json({
        authenticated: false,
        user: null,
      });
    }

    const msUntilExpiry = TokenService.msUntilExpiry(tokens);
    const isExpired = TokenService.isTokenExpired(tokens);
    const isNearExpiry = msUntilExpiry !== null && msUntilExpiry < 60 * 1000;
    const hasRefresh = TokenService.hasRefreshToken(tokens);

    if ((isExpired || isNearExpiry) && hasRefresh) {
      const refreshed = await TokenService.refreshWithStoredTokens(req.session);
      if (refreshed?.ok) {
        if (req.session && typeof req.session.save === "function") {
          await new Promise((resolve, reject) =>
            req.session.save((err) => (err ? reject(err) : resolve()))
          ).catch((saveError) => {
            const logger = require("../utils/logger");
            logger.warn("Session save failed after token refresh", {
              error: saveError?.message,
            });
          });
        }
        const refreshedTokens = await TokenService.getTokens(req.session);
        return res.json({
          authenticated: true,
          method: isSessionAuth ? "session" : refreshedTokens?.user ? "token_fallback" : "token_unknown",
          user: req.user || refreshedTokens?.user || tokens.user || null,
          tokenInfo: refreshedTokens
            ? {
                expiresAt: refreshedTokens.expiresAt || null,
                scope: refreshedTokens.scope || [],
                tokenType: refreshedTokens.tokenType || "bearer",
              }
            : undefined,
          hasRefresh: true,
          refreshed: true,
        });
      }
    }

    return res.json({
      authenticated: !isExpired,
      method: !isExpired && isSessionAuth
        ? "session"
        : tokens.user
        ? "token_fallback"
        : "token_unknown",
      user: tokens.user || null,
      tokenInfo: {
        expiresAt: tokens.expiresAt || null,
        scope: tokens.scope || [],
        tokenType: tokens.tokenType || "bearer",
      },
      hasRefresh,
      needsReauth: isExpired && hasRefresh,
    });
  } catch (err) {
    const logger = require("../utils/logger");
    logger.error("Error in /api/twitch/status", err);
    return res
      .status(500)
      .json({ authenticated: false, error: "status_failed" });
  }
});

// On-demand Twitch token refresh
router.post("/refresh", async (req, res) => {
  const logger = require("../utils/logger");
  try {
    const result = await TokenService.refreshWithStoredTokens(req.session);
    if (result?.ok) {
      // Persist session to ensure refreshed tokens are saved
      if (req.session && typeof req.session.save === "function") {
        await new Promise((resolve, reject) =>
          req.session.save((err) => (err ? reject(err) : resolve()))
        ).catch((saveError) => {
          const logger = require("../utils/logger");
          logger.warn("Session save failed after manual refresh", {
            error: saveError?.message,
          });
        });
      }
      websocket
        .broadcastTwitchStatus(req.session)
        .catch((error) =>
          logger.warn("Failed to broadcast Twitch status after refresh", {
            error: error?.message,
          })
        );
      return res.json({ ok: true, expiresAt: result.expiresAt || null });
    }
    return res.status(401).json({ code: "TWITCH_AUTH_REQUIRED" });
  } catch (e) {
    logger.error("/api/twitch/refresh failed", e);
    return res.status(500).json({ error: "TWITCH_REFRESH_FAILED" });
  }
});

// Debug endpoint to help verify session/cookie presence and fallback behavior
router.get("/debug", async (req, res) => {
  try {
    const sessionId = req.sessionID;
    const hasSession = !!req.session;
    const isAuth =
      typeof req.isAuthenticated === "function" ? req.isAuthenticated() : false;
    const tokens = await TokenService.getTokens(req.session, { allowExpired: true });

    return res.json({
      session: {
        id: sessionId || null,
        exists: hasSession,
        cookie: req.session?.cookie
          ? {
              path: req.session.cookie.path,
              httpOnly: req.session.cookie.httpOnly,
              sameSite: req.session.cookie.sameSite,
              secure: req.session.cookie.secure,
              originalMaxAge: req.session.cookie.originalMaxAge,
            }
          : null,
      },
      passport: {
        isAuthenticated: isAuth,
        user: req.user || null,
      },
      fallback: tokens
        ? {
            available: true,
            user: tokens.user || null,
            expiresAt: tokens.expiresAt || null,
            scope: tokens.scope || [],
          }
        : { available: false },
      note: "If isAuthenticated=false but fallback.available=true, ensure your frontend fetch includes credentials: 'include' and that CORS origin matches exactly.",
    });
  } catch (e) {
    const logger = require("../utils/logger");
    logger.error("Error in /api/twitch/debug", e);
    return res.status(500).json({ error: "debug_failed" });
  }
});

// Return current user info (falls back to token storage if no session)
router.get("/me", async (req, res) => {
  try {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.json({
        authenticated: true,
        method: "session",
        user: req.user || null,
      });
    }
    const tokens = await TokenService.getTokens(req.session, { allowExpired: true });
    if (tokens) {
      return res.json({
        authenticated: true,
        method: tokens.user ? "token_fallback" : "token_unknown",
        user: tokens.user || null,
      });
    }
    return res.json({ authenticated: false, user: null });
  } catch (err) {
    const logger = require("../utils/logger");
    logger.error("Error in /api/twitch/me", err);
    return res.status(500).json({ authenticated: false, error: "me_failed" });
  }
});

// Promote token-fallback into a real session (helps the frontend stay 'online')
router.post("/auth/bootstrap", async (req, res) => {
  const logger = require("../utils/logger");
  try {
    // Already authenticated via session
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.json({
        bootstrapped: false,
        reason: "already_authenticated",
        user: req.user || null,
      });
    }

    const tokens = await TokenService.getTokens(req.session, { allowExpired: true });
    if (!tokens || !tokens.user) {
      return res
        .status(401)
        .json({ bootstrapped: false, error: "no_tokens_available" });
    }

    // Create a lightweight session user from stored tokens
    const sessionUser = {
      id: tokens.user.id,
      username: tokens.user.username,
      displayName: tokens.user.displayName,
    };

    req.logIn(sessionUser, (loginErr) => {
      if (loginErr) {
        logger.error("Bootstrap req.logIn error:", loginErr);
        return res
          .status(500)
          .json({ bootstrapped: false, error: "login_failed" });
      }
      // Ensure session is persisted before responding
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error("Bootstrap session save error:", saveErr);
          return res
            .status(500)
            .json({ bootstrapped: false, error: "session_save_failed" });
        }
        websocket
          .broadcastTwitchStatus(req.session)
          .catch((error) =>
            logger.warn("Failed to broadcast Twitch status after bootstrap", {
              error: error?.message,
            })
          );
        return res.json({ bootstrapped: true, user: sessionUser });
      });
    });
  } catch (e) {
    logger.error("Unexpected error in /api/twitch/auth/bootstrap:", e);
    return res
      .status(500)
      .json({ bootstrapped: false, error: "bootstrap_failed" });
  }
});

module.exports = router;
