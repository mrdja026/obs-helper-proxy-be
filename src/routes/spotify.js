const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const spotify = require("../services/spotifyService");
const songQueue = require("../services/songQueue");
const fileStore = require("../services/spotifyFileTokenStorage");

// Exchange PKCE auth code for tokens and store refresh token
router.post("/auth/exchange", async (req, res) => {
  try {
    const { code, codeVerifier, redirectUri } = req.body || {};
    if (!code || !codeVerifier) {
      return res.status(400).json({ error: "bad_request" });
    }
    await spotify.exchangeCodeForTokens({ code, codeVerifier, redirectUri });
    return res.json({ ok: true });
  } catch (e) {
    logger.error("Spotify auth exchange failed", { error: e.message });
    const err =
      e?.message === "invalid_redirect_uri"
        ? "invalid_redirect_uri"
        : "exchange_failed";
    return res.status(400).json({ error: err });
  }
});

// Enqueue matched track on user's active device
router.post("/queue", async (req, res) => {
  try {
    const { itemId, index } = req.body || {};
    let item = null;
    if (itemId) {
      item = songQueue.getAll().find((i) => i.id === itemId);
    } else if (Number.isInteger(index)) {
      const list = songQueue.getAll();
      item = list[index] || null;
    }
    if (!item) return res.status(404).json({ error: "not_found" });
    if (item.matchStatus !== "matched" || !item.spotify?.uri) {
      return res.status(409).json({ error: "not_matched" });
    }

    const state = await spotify.getPlaybackState();
    const isActive = !!(state && state.device && state.device.is_active);
    if (!isActive) {
      return res.status(409).json({ error: "no_active_device" });
    }

    await spotify.addToPlaybackQueue(item.spotify.uri);
    return res.json({ ok: true });
  } catch (e) {
    logger.error("Spotify queue failed", { error: e.message });
    return res.status(500).json({ error: "queue_failed" });
  }
});

// Spotify auth status
router.get("/status", async (_req, res) => {
  try {
    const tokens = await fileStore.getTokens();
    if (!tokens) {
      return res.json({
        authenticated: false,
        hasRefresh: false,
        expiresAt: null,
      });
    }
    return res.json({
      authenticated: true,
      hasRefresh: !!tokens.refreshToken,
      expiresAt: tokens.expiresAt || null,
    });
  } catch (e) {
    logger.error("Spotify status failed", { error: e.message });
    return res.json({
      authenticated: false,
      hasRefresh: false,
      expiresAt: null,
    });
  }
});

// Spotify playback/devices debug snapshot (sanitized)
router.get("/debug", async (_req, res) => {
  try {
    const snapshot = await spotify.getPlaybackSnapshot();
    return res.json(snapshot);
  } catch (e) {
    const msg = e?.message || "debug_failed";
    if (
      msg === "spotify_not_authenticated" ||
      msg === "spotify_refresh_failed"
    ) {
      return res.status(401).json({ error: msg });
    }
    return res.status(500).json({ error: "debug_failed" });
  }
});

module.exports = router;
