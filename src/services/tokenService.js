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
  static async getTokens(session, options = {}) {
    const allowExpired = !!options.allowExpired;

    // First try session
    if (session && session.twitchTokens) {
      const tokens = session.twitchTokens;
      const expired = this.isTokenExpired(tokens);

      if (!expired) {
        return tokens;
      }

      logger.warn("Access token in session has expired", {
        userId: tokens.user?.id,
        expiredAt: tokens.expiresAt,
      });

      if (allowExpired && this.hasRefreshToken(tokens)) {
        return tokens;
      }
    }

    // Fallback based on configured method
    const storageMethod = config.twitch.tokenStorage.method;

    if (storageMethod === "file" || storageMethod === "hybrid") {
      const fileTokens = await fileTokenStorage.getTokens({ allowExpired });
      if (fileTokens) {
        if (this.isTokenExpired(fileTokens)) {
          if (allowExpired && this.hasRefreshToken(fileTokens)) {
            logger.warn("Using expired tokens from file storage (allowExpired=true)", {
              userId: fileTokens.user?.id,
              username: fileTokens.user?.username,
              expiresAt: fileTokens.expiresAt,
            });
            return fileTokens;
          }
        } else {
          logger.info("Using tokens from file storage", {
            userId: fileTokens.user?.id,
            username: fileTokens.user?.username,
          });
          return fileTokens;
        }
      }
    }

    if (storageMethod === "session" || storageMethod === "hybrid") {
      const cachedTokens = tokenCache.getLatestTokens();
      if (cachedTokens) {
        if (!this.isTokenExpired(cachedTokens)) {
          logger.info("Using tokens from memory cache", {
            userId: cachedTokens.user?.id,
            username: cachedTokens.user?.username,
          });
          return cachedTokens;
        }
        if (allowExpired && this.hasRefreshToken(cachedTokens)) {
          logger.warn("Using expired tokens from memory cache (allowExpired=true)", {
            userId: cachedTokens.user?.id,
            username: cachedTokens.user?.username,
          });
          return cachedTokens;
        }
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
    const tokens = await this.getTokens(session, { allowExpired: true });
    return tokens ? tokens.refreshToken : null;
  }

  /**
   * Get user information from tokens
   * @param {Object} session - Express session object
   * @returns {Promise<Object|null>} User information or null if not found
   */
  static async getUserFromTokens(session) {
    const tokens = await this.getTokens(session, { allowExpired: true });
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
   * Determine whether a token payload is already expired
   * @param {Object} tokens
   * @returns {Boolean}
   */
  static isTokenExpired(tokens) {
    if (!tokens || !tokens.expiresAt) {
      return false;
    }

    const expiresAt =
      tokens.expiresAt instanceof Date
        ? tokens.expiresAt.getTime()
        : new Date(tokens.expiresAt).getTime();

    if (!Number.isFinite(expiresAt)) {
      return false;
    }

    return Date.now() >= expiresAt;
  }

  /**
   * Milliseconds remaining until expiry (negative when already expired)
   * @param {Object} tokens
   * @returns {Number|null}
   */
  static msUntilExpiry(tokens) {
    if (!tokens || !tokens.expiresAt) {
      return null;
    }

    const expiresAt =
      tokens.expiresAt instanceof Date
        ? tokens.expiresAt.getTime()
        : new Date(tokens.expiresAt).getTime();

    if (!Number.isFinite(expiresAt)) {
      return null;
    }

    return expiresAt - Date.now();
  }

  /**
   * Whether the payload contains a refresh token we can use
   * @param {Object} tokens
   * @returns {Boolean}
   */
  static hasRefreshToken(tokens) {
    return !!(tokens && tokens.refreshToken);
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
    const tokens = await this.getTokens(null, { allowExpired: true });
    if (!tokens) {
      return false;
    }

    if (!this.isTokenExpired(tokens)) {
      return true;
    }

    if (!this.hasRefreshToken(tokens)) {
      return false;
    }

    const bootstrapSession = {
      id: "token-service-bootstrap",
      twitchTokens: null,
    };

    const refreshed = await this.refreshWithStoredTokens(bootstrapSession);
    return !!(refreshed && refreshed.ok);
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

  /**
   * Refresh Twitch tokens using stored refresh token (session preferred, file fallback)
   * @param {Object} session - Express session object
   * @returns {Promise<{ok:boolean, expiresAt?:string}>}
   */
  static async refreshTokens(session) {
    try {
      const config = require("../config/config");
      const fetch = (await import("node-fetch")).default;

      // Prefer session refresh token, fallback to file
      const current = await this.getTokens(session, { allowExpired: true });
      const refreshToken = current?.refreshToken;
      if (!refreshToken) {
        logger.warn("No Twitch refresh token available for refresh");
        return { ok: false };
      }

      const params = new URLSearchParams();
      params.set("grant_type", "refresh_token");
      params.set("refresh_token", refreshToken);
      params.set(
        "client_id",
        config.twitch.clientId || process.env.TWITCH_CLIENT_ID || ""
      );
      params.set(
        "client_secret",
        config.twitch.clientSecret || process.env.TWITCH_CLIENT_SECRET || ""
      );

      const resp = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        logger.error("Twitch refresh failed", {
          status: resp.status,
          body: text,
        });
        return { ok: false };
      }

      const body = await resp.json();
      const newAccess = body.access_token;
      const newRefresh = body.refresh_token || refreshToken;
      const expiresIn = body.expires_in || 3600;
      const scope = Array.isArray(body.scope)
        ? body.scope
        : current?.scope || [];
      const tokenType = body.token_type || current?.tokenType || "bearer";

      // Update session and file
      await this.updateTokens(session, {
        accessToken: newAccess,
        refreshToken: newRefresh,
        expiresIn,
        scope,
        tokenType,
      });

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      return { ok: true, expiresAt };
    } catch (error) {
      logger.error("Unexpected error during Twitch token refresh", {
        error: error.message,
      });
      return { ok: false };
    }
  }

  /**
   * Refresh using stored tokens (session preferred, file fallback). If the session
   * does not yet contain twitchTokens, seed it from stored tokens to allow update.
   * @param {Object} session - Express session object
   * @returns {Promise<{ok:boolean, expiresAt?:string}>}
   */
  static async refreshWithStoredTokens(session) {
    try {
      const tokens = await this.getTokens(session, { allowExpired: true });
      if (!tokens || !tokens.refreshToken) {
        logger.warn("refreshWithStoredTokens: no tokens or refresh token");
        return { ok: false };
      }

      // Seed session tokens if missing so updateTokens() can persist
      if (!session.twitchTokens) {
        session.twitchTokens = {
          accessToken: tokens.accessToken || null,
          refreshToken: tokens.refreshToken,
          // force immediate refresh semantics
          expiresAt: new Date(0),
          scope: tokens.scope || [],
          tokenType: tokens.tokenType || "bearer",
          user: tokens.user || null,
        };
      }

      return await this.refreshTokens(session);
    } catch (e) {
      logger.error("refreshWithStoredTokens failed", { error: e.message });
      return { ok: false };
    }
  }
}

const AUTO_REFRESH_INTERVAL_MS = Number(
  process.env.TWITCH_TOKEN_AUTO_REFRESH_INTERVAL_MS || 120000
);
const AUTO_REFRESH_THRESHOLD_MS = Number(
  process.env.TWITCH_TOKEN_AUTO_REFRESH_THRESHOLD_MS || 5 * 60 * 1000
);
const shouldAutoRefresh =
  AUTO_REFRESH_INTERVAL_MS > 0 &&
  (config.twitch.tokenStorage.method === "file" ||
    config.twitch.tokenStorage.method === "hybrid");

if (shouldAutoRefresh) {
  const autoRefreshSession = {
    id: "token-service-auto-refresh",
    twitchTokens: null,
    save(callback) {
      if (typeof callback === "function") {
        callback();
      }
    },
  };

  let autoRefreshRunning = false;

  const runAutoRefresh = async () => {
    if (autoRefreshRunning) {
      return;
    }
    autoRefreshRunning = true;
    try {
      const tokens = await TokenService.getTokens(autoRefreshSession, {
        allowExpired: true,
      });
      if (!tokens || !TokenService.hasRefreshToken(tokens)) {
        return;
      }

      const msUntilExpiry = TokenService.msUntilExpiry(tokens);
      if (msUntilExpiry === null) {
        return;
      }

      if (msUntilExpiry > AUTO_REFRESH_THRESHOLD_MS) {
        return;
      }

      const result = await TokenService.refreshWithStoredTokens(
        autoRefreshSession
      );
      if (result?.ok) {
        logger.info("Auto-refreshed Twitch access token", {
          expiresAt: result.expiresAt || null,
        });
      } else {
        logger.warn("Auto refresh attempt for Twitch tokens did not succeed");
      }
    } catch (error) {
      logger.error("Auto refresh loop encountered an error", {
        error: error.message,
      });
    } finally {
      autoRefreshRunning = false;
    }
  };

  const interval = setInterval(runAutoRefresh, AUTO_REFRESH_INTERVAL_MS);
  if (typeof interval.unref === "function") {
    interval.unref();
  }

  runAutoRefresh().catch(() => {});
}

module.exports = TokenService;
