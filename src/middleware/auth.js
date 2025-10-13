const passport = require("passport");
const TokenService = require("../services/tokenService");
const logger = require("../utils/logger");

// Authentication middleware
const requireAuth = async (req, res, next) => {
  // First check Passport session authentication
  if (req.isAuthenticated()) {
    return next();
  }

  // Fallback to token cache authentication
  const cachedTokens = await TokenService.getTokensFromCache();
  if (cachedTokens && cachedTokens.user) {
    logger.info("Using cached tokens for authentication", {
      userId: cachedTokens.user?.id,
      username: cachedTokens.user?.username,
    });

    // Set user on request object
    req.user = cachedTokens.user;
    req.fromCache = true;
    req.cachedTokens = cachedTokens;

    return next();
  }

  // No authentication found
  const cacheStats = await TokenService.getCacheStats();
  logger.warn("Authentication failed - no valid session or cached tokens", {
    sessionId: req.sessionID,
    hasSession: !!req.session,
    cacheStats,
  });

  return res.status(401).json({
    error: "Authentication required",
    message: "You must be logged in to access this resource",
    hint: "Try authenticating at /api/twitch/auth or ensure tokens are cached",
  });
};

// Optional authentication middleware (doesn't block if not authenticated)
const optionalAuth = (req, res, next) => {
  // Just continue to next middleware
  return next();
};

// Check if user is authenticated and return user info if so
const getAuthStatus = (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({
      authenticated: true,
      user: req.user,
    });
  }
  return res.json({
    authenticated: false,
    user: null,
  });
};

// Enhanced authentication middleware with debug info
const requireAuthWithDebug = async (req, res, next) => {
  logger.info("Authentication check", {
    path: req.path,
    method: req.method,
    sessionId: req.sessionID,
    isAuthenticated: req.isAuthenticated(),
    hasSession: !!req.session,
    cacheStats: await TokenService.getCacheStats(),
  });

  return requireAuth(req, res, next);
};

// Get user from session or cache
const getUser = async (req) => {
  if (req.isAuthenticated()) {
    return req.user;
  }

  const cachedTokens = await TokenService.getTokensFromCache();
  return cachedTokens ? cachedTokens.user : null;
};

module.exports = {
  requireAuth,
  requireAuthWithDebug,
  optionalAuth,
  getAuthStatus,
  getUser,
};
