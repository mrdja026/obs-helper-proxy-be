const logger = require("../utils/logger");
const tokenCache = require("./tokenCache");
const fileTokenStorage = require("./fileTokenStorage");
const config = require("../config/config");

class TokenService {
  /**
   * Store OAuth tokens in the session
   * @param {Object} session - Express session object
   * @param {Object} tokens - Token object containing accessToken, refreshToken, expiresIn
   * @param {Object} user - User information
   */
  static async storeTokens(session, tokens, user) {
    if (!session) {
      logger.error("Session object is required for storing tokens");
      return false;
    }

    try {
      // Store tokens with expiration time
      session.twitchTokens = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        scope: tokens.scope || [],
        tokenType: tokens.tokenType || "bearer",
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        },
      };

      logger.info("Tokens stored successfully in session", {
        userId: user.id,
        username: user.username,
        expiresAt: session.twitchTokens.expiresAt,
      });

      // Store based on configured method
      const storageMethod = config.twitch.tokenStorage.method;

      if (storageMethod === "file" || storageMethod === "hybrid") {
        await fileTokenStorage.storeTokens(tokens, user);
      }

      if (storageMethod === "hybrid" && session && session.id) {
        // Only use cache in hybrid mode, not in pure file mode
        tokenCache.storeTokens(session.id, tokens, user);
      }

      return true;
    } catch (error) {
      logger.error("Failed to store tokens in session", {
        error: error.message,
        userId: user?.id,
      });
      return false;
    }
  }

  /**
   * Get tokens from session or file
   * @param {Object} session - Express session object
   * @returns {Promise<Object|null>} Token object or null if not found
   */
  static async getTokens(session) {
    // First try session
    if (session && session.twitchTokens) {
      const tokens = session.twitchTokens;

      // Check if token is expired
      if (tokens.expiresAt && new Date() > new Date(tokens.expiresAt)) {
        logger.warn("Access token has expired", {
          userId: tokens.user?.id,
          expiredAt: tokens.expiresAt,
        });
      } else {
        return tokens;
      }
    }

    // Fallback based on configured method
    const storageMethod = config.twitch.tokenStorage.method;

    if (storageMethod === "file" || storageMethod === "hybrid") {
      const fileTokens = await fileTokenStorage.getTokens();
      if (fileTokens) {
        logger.info("Using tokens from file storage", {
          userId: fileTokens.user?.id,
          username: fileTokens.user?.username,
        });
        return fileTokens;
      }
    }

    if (storageMethod === "session" || storageMethod === "hybrid") {
      const cachedTokens = tokenCache.getLatestTokens();
      if (cachedTokens) {
        logger.info("Using tokens from memory cache", {
          userId: cachedTokens.user?.id,
          username: cachedTokens.user?.username,
        });
        return cachedTokens;
      }
    }

    return null;
  }

  /**
   * Check if tokens are valid and not expired
   * @param {Object} session - Express session object
   * @returns {Promise<Boolean>} True if tokens are valid
   */
  static async areTokensValid(session) {
    const tokens = await this.getTokens(session);
    return tokens !== null;
  }

  /**
   * Get access token from session or file
   * @param {Object} session - Express session object
   * @returns {Promise<String|null>} Access token or null if not found
   */
  static async getAccessToken(session) {
    const tokens = await this.getTokens(session);
    return tokens ? tokens.accessToken : null;
  }

  /**
   * Get refresh token from session or file
   * @param {Object} session - Express session object
   * @returns {Promise<String|null>} Refresh token or null if not found
   */
  static async getRefreshToken(session) {
    const tokens = await this.getTokens(session);
    return tokens ? tokens.refreshToken : null;
  }

  /**
   * Get user information from tokens
   * @param {Object} session - Express session object
   * @returns {Promise<Object|null>} User information or null if not found
   */
  static async getUserFromTokens(session) {
    const tokens = await this.getTokens(session);
    return tokens ? tokens.user : null;
  }

  /**
   * Clear tokens from session, file, and cache
   * @param {Object} session - Express session object
   */
  static async clearTokens(session) {
    if (session && session.twitchTokens) {
      const userId = session.twitchTokens.user?.id;
      delete session.twitchTokens;
      logger.info("Tokens cleared from session", { userId });
    }

    // Clear based on configured method
    const storageMethod = config.twitch.tokenStorage.method;

    if (storageMethod === "file" || storageMethod === "hybrid") {
      await fileTokenStorage.clearTokens();
    }

    if (storageMethod === "session" || storageMethod === "hybrid") {
      if (session && session.id) {
        tokenCache.clearTokens(session.id);
      }
    }
  }

  /**
   * Update tokens in session (useful after token refresh)
   * @param {Object} session - Express session object
   * @param {Object} newTokens - New token object
   */
  static async updateTokens(session, newTokens) {
    if (!session || !session.twitchTokens) {
      logger.error("No existing tokens found for update");
      return false;
    }

    try {
      const existingUser = session.twitchTokens.user;

      // Update token information while preserving user data
      session.twitchTokens = {
        ...session.twitchTokens,
        accessToken: newTokens.accessToken,
        refreshToken:
          newTokens.refreshToken || session.twitchTokens.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
        scope: newTokens.scope || session.twitchTokens.scope,
        tokenType: newTokens.tokenType || session.twitchTokens.tokenType,
      };

      logger.info("Tokens updated successfully in session", {
        userId: existingUser?.id,
        newExpiresAt: session.twitchTokens.expiresAt,
      });

      // Update based on configured method
      const storageMethod = config.twitch.tokenStorage.method;

      if (storageMethod === "file" || storageMethod === "hybrid") {
        await fileTokenStorage.storeTokens(
          newTokens,
          session.twitchTokens.user
        );
      }

      return true;
    } catch (error) {
      logger.error("Failed to update tokens in session", {
        error: error.message,
        userId: session.twitchTokens.user?.id,
      });
      return false;
    }
  }

  /**
   * Get tokens from cache (fallback method)
   * @param {String} userId - User ID (optional)
   * @returns {Promise<Object|null>} Token data or null
   */
  static async getTokensFromCache(userId = null) {
    const storageMethod = config.twitch.tokenStorage.method;

    // Try based on configured method
    if (storageMethod === "session" || storageMethod === "hybrid") {
      if (userId) {
        const cachedTokens = tokenCache.getTokensByUserId(userId);
        if (cachedTokens) {
          return cachedTokens;
        }
      } else {
        const cachedTokens = tokenCache.getLatestTokens();
        if (cachedTokens) {
          return cachedTokens;
        }
      }
    }

    if (storageMethod === "file" || storageMethod === "hybrid") {
      return await fileTokenStorage.getTokens();
    }

    return null;
  }

  /**
   * Check if cache has valid tokens
   * @returns {Promise<Boolean>} True if valid tokens exist in cache
   */
  static async cacheHasValidTokens() {
    const storageMethod = config.twitch.tokenStorage.method;

    if (storageMethod === "session" || storageMethod === "hybrid") {
      if (tokenCache.hasValidTokens()) {
        return true;
      }
    }

    if (storageMethod === "file" || storageMethod === "hybrid") {
      return await fileTokenStorage.hasValidTokens();
    }

    return false;
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  static async getCacheStats() {
    const cacheStats = tokenCache.getStats();
    const fileStats = await fileTokenStorage.getStats();

    return {
      memory: cacheStats,
      file: fileStats,
    };
  }
}

module.exports = TokenService;
