const express = require("express");
const passport = require("../middleware/twitchAuth");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

// Twitch authentication routes
router.get(
  "/auth",
  passport.authenticate("twitch", { scope: ["user:read:email"] })
);

router.get("/auth/callback", (req, res, next) => {
  const logger = require("../utils/logger");
  logger.info("Twitch OAuth callback: received request", {
    query: req.query,
    sessionExists: !!req.session,
    sessionId: req.sessionID,
  });
  passport.authenticate(
    "twitch",
    { failureRedirect: "http://localhost:8080/?auth=error" },
    (err, user, info) => {
      if (err) {
        logger.error("Passport authenticate error:", err);
        return res.redirect("http://localhost:8080/?auth=error");
      }
      if (!user) {
        logger.error(
          "Passport authenticate failed: no user returned. Info:",
          info
        );
        return res.redirect("http://localhost:8080/?auth=error");
      }
      // Log in the user
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          logger.error("req.logIn error:", loginErr);
          return res.redirect("http://localhost:8080/?auth=error");
        }
        logger.info("Twitch OAuth callback: user authenticated and logged in", {
          userId: req.user?.id,
          displayName: req.user?.displayName,
          username: req.user?.username,
        });
        // Redirect to frontend with success indicator
        return res.redirect("http://localhost:8080/?auth=success");
      });
    }
  )(req, res, next);
});

router.get("/auth/logout", (req, res) => {
  req.logout((err) => {
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
router.get("/status", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: req.user,
    });
  } else {
    res.json({
      authenticated: false,
      user: null,
    });
  }
});

module.exports = router;
