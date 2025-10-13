const logger = require("../utils/logger");

class TokenCache {
  constructor() {
    this.cache = new Map(); // userId -> tokenData
    this.sessionToUser = new Map(); // sessionId -> userId
  }

  /**
   * Store tokens in cache
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {Object} tokens - Token data
   * @param {Object} user - User information
   */
  storeTokens(userId, sessionId, tokens, user) {
    try {
      // Store tokens with timestamp
      this.cache.set(userId, {
        ...tokens,
        user,
        createdAt: new Date(),
        sessionId,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      });

      // Map session to user for easy lookup
      this.sessionToUser.set(sessionId, userId);

      logger.info("Tokens stored in cache", {
        userId,
        username: user.username,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      });
    } catch (error) {
      logger.error("Failed to store tokens in cache", {
        error: error.message,
        userId,
      });
    }
  }

  /**
   * Get tokens by user ID
   * @param {String} userId - User ID
   * @returns {Object|null} Token data or null
   */
  getTokensByUserId(userId) {
    const tokenData = this.cache.get(userId);
    if (!tokenData) {
      return null;
    }

    // Check if token is expired
    if (new Date() > tokenData.expiresAt) {
      logger.warn("Cached tokens expired", {
        userId,
        expiredAt: tokenData.expiresAt,
      });
      this.removeTokens(userId);
      return null;
    }

    return tokenData;
  }

  /**
   * Get tokens by session ID
   * @param {String} sessionId - Session ID
   * @returns {Object|null} Token data or null
   */
  getTokensBySessionId(sessionId) {
    const userId = this.sessionToUser.get(sessionId);
    if (!userId) {
      return null;
    }

    return this.getTokensByUserId(userId);
  }

  /**
   * Get latest tokens (for fallback authentication)
   * @returns {Object|null} Most recent token data or null
   */
  getLatestTokens() {
    if (this.cache.size === 0) {
      return null;
    }

    // Find the most recently added tokens
    let latestTokens = null;
    let latestTime = new Date(0);

    for (const [userId, tokenData] of this.cache.entries()) {
      // Check if token is not expired
      if (
        new Date() <= tokenData.expiresAt &&
        tokenData.createdAt > latestTime
      ) {
        latestTokens = tokenData;
        latestTime = tokenData.createdAt;
      }
    }

    if (!latestTokens) {
      logger.warn("No valid tokens found in cache");
      return null;
    }

    logger.debug("Retrieved latest tokens from cache", {
      userId: latestTokens.user?.id,
      username: latestTokens.user?.username,
    });

    return latestTokens;
  }

  /**
   * Remove tokens by user ID
   * @param {String} userId - User ID
   */
  removeTokens(userId) {
    const tokenData = this.cache.get(userId);
    if (tokenData) {
      this.cache.delete(userId);
      this.sessionToUser.delete(tokenData.sessionId);
      logger.info("Tokens removed from cache", { userId });
    }
  }

  /**
   * Remove tokens by session ID
   * @param {String} sessionId - Session ID
   */
  removeTokensBySessionId(sessionId) {
    const userId = this.sessionToUser.get(sessionId);
    if (userId) {
      this.removeTokens(userId);
    }
  }

  /**
   * Clear all tokens
   */
  clearAll() {
    const size = this.cache.size;
    this.cache.clear();
    this.sessionToUser.clear();
    logger.info(`Cleared ${size} token(s) from cache`);
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpired() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [userId, tokenData] of this.cache.entries()) {
      if (now > tokenData.expiresAt) {
        this.removeTokens(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired token(s) from cache`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = new Date();
    let validCount = 0;
    let expiredCount = 0;

    for (const [userId, tokenData] of this.cache.entries()) {
      if (now <= tokenData.expiresAt) {
        validCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
      sessions: this.sessionToUser.size,
    };
  }

  /**
   * Check if any valid tokens exist
   * @returns {Boolean} True if valid tokens exist
   */
  hasValidTokens() {
    return this.getLatestTokens() !== null;
  }
}

// Singleton instance
const tokenCache = new TokenCache();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  tokenCache.cleanupExpired();
}, 5 * 60 * 1000);

module.exports = tokenCache;
