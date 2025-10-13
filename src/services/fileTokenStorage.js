const fs = require("fs").promises;
const path = require("path");
const logger = require("../utils/logger");

class FileTokenStorage {
  constructor() {
    this.tokenFilePath = path.join(process.cwd(), "twitch-tokens.json");
    this.tokens = null;
    this.lastRead = null;
    this.readInterval = 5000; // Re-read file every 5 seconds to catch external changes
  }

  /**
   * Store tokens to file
   * @param {Object} tokens - Token object
   * @param {Object} user - User information
   */
  async storeTokens(tokens, user) {
    try {
      const tokenData = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
        scope: tokens.scope || [],
        tokenType: tokens.tokenType || "bearer",
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        },
        storedAt: new Date().toISOString(),
      };

      await fs.writeFile(
        this.tokenFilePath,
        JSON.stringify(tokenData, null, 2)
      );
      this.tokens = tokenData;
      this.lastRead = Date.now();

      logger.info("Tokens stored to file", {
        userId: user.id,
        username: user.username,
        expiresAt: tokenData.expiresAt,
        filePath: this.tokenFilePath,
      });

      return true;
    } catch (error) {
      logger.error("Failed to store tokens to file", {
        error: error.message,
        filePath: this.tokenFilePath,
      });
      return false;
    }
  }

  /**
   * Get tokens from file
   * @returns {Object|null} Token object or null if not found/expired
   */
  async getTokens() {
    try {
      // If we have recently read tokens, return them
      if (
        this.tokens &&
        this.lastRead &&
        Date.now() - this.lastRead < this.readInterval
      ) {
        return this.isTokenValid(this.tokens) ? this.tokens : null;
      }

      // Try to read from file
      const fileContent = await fs.readFile(this.tokenFilePath, "utf8");
      const tokenData = JSON.parse(fileContent);

      this.tokens = tokenData;
      this.lastRead = Date.now();

      if (this.isTokenValid(tokenData)) {
        logger.debug("Retrieved valid tokens from file", {
          userId: tokenData.user?.id,
          username: tokenData.user?.username,
          expiresAt: tokenData.expiresAt,
        });
        return tokenData;
      } else {
        logger.warn("Tokens in file are expired or invalid", {
          userId: tokenData.user?.id,
          expiresAt: tokenData.expiresAt,
        });
        return null;
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.error("Failed to read tokens from file", {
          error: error.message,
          filePath: this.tokenFilePath,
        });
      }
      return null;
    }
  }

  /**
   * Check if token is valid and not expired
   * @param {Object} tokenData - Token data
   * @returns {Boolean} True if valid
   */
  isTokenValid(tokenData) {
    if (!tokenData || !tokenData.expiresAt || !tokenData.accessToken) {
      return false;
    }

    return new Date() < new Date(tokenData.expiresAt);
  }

  /**
   * Get access token from file
   * @returns {String|null} Access token or null
   */
  async getAccessToken() {
    const tokens = await this.getTokens();
    return tokens ? tokens.accessToken : null;
  }

  /**
   * Get refresh token from file
   * @returns {String|null} Refresh token or null
   */
  async getRefreshToken() {
    const tokens = await this.getTokens();
    return tokens ? tokens.refreshToken : null;
  }

  /**
   * Get user information from file
   * @returns {Object|null} User information or null
   */
  async getUser() {
    const tokens = await this.getTokens();
    return tokens ? tokens.user : null;
  }

  /**
   * Clear tokens from file
   */
  async clearTokens() {
    try {
      await fs.unlink(this.tokenFilePath);
      this.tokens = null;
      this.lastRead = null;

      logger.info("Tokens file deleted", {
        filePath: this.tokenFilePath,
      });

      return true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.error("Failed to delete tokens file", {
          error: error.message,
          filePath: this.tokenFilePath,
        });
      }
      return false;
    }
  }

  /**
   * Check if tokens exist and are valid
   * @returns {Boolean} True if valid tokens exist
   */
  async hasValidTokens() {
    const tokens = await this.getTokens();
    return tokens !== null;
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  async getStats() {
    try {
      const tokens = await this.getTokens();
      const fileExists = await fs
        .access(this.tokenFilePath)
        .then(() => true)
        .catch(() => false);

      return {
        hasFile: fileExists,
        hasValidTokens: tokens !== null,
        filePath: this.tokenFilePath,
        lastRead: this.lastRead,
        userId: tokens?.user?.id || null,
        username: tokens?.user?.username || null,
        expiresAt: tokens?.expiresAt || null,
      };
    } catch (error) {
      return {
        hasFile: false,
        hasValidTokens: false,
        filePath: this.tokenFilePath,
        error: error.message,
      };
    }
  }
}

// Singleton instance
const fileTokenStorage = new FileTokenStorage();

module.exports = fileTokenStorage;
