const express = require("express");
const router = express.Router();
const ws = require("../services/websocket");

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// WS stats (best-effort)
router.get("/ws/stats", (req, res) => {
  try {
    res.json(ws.getStats());
  } catch (e) {
    res.status(500).json({ error: e?.message || "failed" });
  }
});

// OBS routes
router.use("/obs", require("./obs"));

// Twitch routes
router.use("/twitch", require("./twitch"));

// Chat routes
router.use("/chat", require("./chat"));

// Queue routes
router.use("/", require("./queue"));

// Spotify routes
router.use("/spotify", require("./spotify"));

// Test routes
router.use("/test", require("./test"));

module.exports = router;
