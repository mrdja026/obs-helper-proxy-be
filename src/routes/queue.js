const express = require("express");
const router = express.Router();
const { requireAuthWithDebug } = require("../middleware/auth");
const logger = require("../utils/logger");
const songQueue = require("../services/songQueue");

// Get current queue
router.get("/song-queue", (req, res) => {
  res.json({ queue: songQueue.getAll(), capacity: songQueue.MAX_CAPACITY });
});

// Add song
router.post("/song-queue", (req, res) => {
  const { title, requestedBy } = req.body || {};
  const result = songQueue.addSong({
    title,
    requestedBy: requestedBy || "api",
  });
  if (!result.ok) {
    if (result.error === "full") {
      return res.status(429).json({
        error: "queue_full",
        message: "Queue full. Try again once the queue is empty.",
      });
    }
    return res.status(400).json({ error: result.error || "bad_request" });
  }
  return res.status(201).json({ item: result.item, position: result.position });
});

// Admin helpers: only allow authenticated requests (mods/broadcaster tools)
router.delete("/song-queue/:index", requireAuthWithDebug, (req, res) => {
  const idx = Number(req.params.index);
  const result = songQueue.removeByIndex(idx);
  if (!result.ok) {
    return res.status(404).json({ error: "not_found" });
  }
  return res.json({ removed: result.item });
});

router.post("/song-queue/skip", requireAuthWithDebug, (req, res) => {
  const result = songQueue.skip();
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  return res.json({ skipped: result.item });
});

router.delete("/song-queue", requireAuthWithDebug, (req, res) => {
  const result = songQueue.clear();
  return res.json({ cleared: result.count });
});

module.exports = router;
