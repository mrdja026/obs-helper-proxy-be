const express = require("express");
const passport = require("../middleware/twitchAuth");
const { requireAuth } = require("../middleware/auth");
const TokenService = require("../services/tokenService");
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
    // First prefer Passport session auth
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.json({
        authenticated: true,
        method: "session",
        user: req.user || null,
      });
    }

    // Fallback to token service (file/memory cache)
    const tokens = await TokenService.getTokens(req.session);
    if (tokens) {
      return res.json({
        authenticated: true,
        method: tokens.user ? "token_fallback" : "token_unknown",
        user: tokens.user || null,
        tokenInfo: {
          expiresAt: tokens.expiresAt || null,
          scope: tokens.scope || [],
          tokenType: tokens.tokenType || "bearer",
        },
      });
    }

    return res.json({
      authenticated: false,
      user: null,
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
    const result = await TokenService.refreshTokens(req.session);
    if (result?.ok) {
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
    const tokens = await TokenService.getTokens(req.session);

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
    const tokens = await TokenService.getTokens(req.session);
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

    const tokens = await TokenService.getTokens(req.session);
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
