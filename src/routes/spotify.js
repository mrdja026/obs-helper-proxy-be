const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const spotify = require("../services/spotifyService");
const songQueue = require("../services/songQueue");

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

module.exports = router;
