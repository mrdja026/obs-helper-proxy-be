const express = require("express");
const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// OBS routes
router.use("/obs", require("./obs"));

// Twitch routes
router.use("/twitch", require("./twitch"));

// Chat routes
router.use("/chat", require("./chat"));

// Test routes
router.use("/test", require("./test"));

module.exports = router;
