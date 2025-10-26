const fs = require("fs").promises;
const path = require("path");
const logger = require("../utils/logger");
const config = require("../config/config");

class SpotifyFileTokenStorage {
  constructor() {
    const filePath =
      (config.spotify &&
        config.spotify.tokenStorage &&
        config.spotify.tokenStorage.filePath) ||
      "spotify-tokens.json";
    this.tokenFilePath = path.join(process.cwd(), filePath);
    this.tokens = null;
    this.lastRead = null;
    this.readInterval = 5000;
  }

  async storeTokens(tokens, user) {
    try {
      const tokenData = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
        scope: tokens.scope || [],
        tokenType: tokens.tokenType || "bearer",
        user: user || null,
        storedAt: new Date().toISOString(),
      };
      await fs.writeFile(
        this.tokenFilePath,
        JSON.stringify(tokenData, null, 2)
      );
      this.tokens = tokenData;
      this.lastRead = Date.now();
      logger.info("Spotify tokens stored to file", {
        filePath: this.tokenFilePath,
      });
      return true;
    } catch (error) {
      logger.error("Failed to store Spotify tokens to file", {
        error: error.message,
        filePath: this.tokenFilePath,
      });
      return false;
    }
  }

  async clearTokens() {
    try {
      //fucked up shit happens here
      await fs.unlink(this.tokenFilePath).catch((error) => {
        console.error("UNLINKING FILE FAILED", { cause: error.cause });
      });
      this.tokens = null;
      this.lastRead = Date.now();
      logger.info("Spotify tokens cleared from file", {
        filePath: this.tokenFilePath,
      });
      return true;
    } catch (error) {
      logger.error("Failed to clear Spotify tokens file", {
        error: error.message,
        filePath: this.tokenFilePath,
      });
      return false;
    }
  }

  async getTokens() {
    try {
      if (
        this.tokens &&
        this.lastRead &&
        Date.now() - this.lastRead < this.readInterval
      ) {
        // Return tokens even if expired; callers (spotifyService) handle refresh
        return this.tokens;
      }
      const fileContent = await fs.readFile(this.tokenFilePath, "utf8");
      const tokenData = JSON.parse(fileContent);
      this.tokens = tokenData;
      this.lastRead = Date.now();
      // Return tokens even if expired; callers (spotifyService) handle refresh
      return tokenData;
    } catch (error) {
      return null;
    }
  }

  isTokenValid(tokenData) {
    if (!tokenData || !tokenData.expiresAt || !tokenData.accessToken)
      return false;
    return new Date() < new Date(tokenData.expiresAt);
  }

  async getAccessToken() {
    const tokens = await this.getTokens();
    return tokens ? tokens.accessToken : null;
  }

  async getRefreshToken() {
    const tokens = await this.getTokens();
    return tokens ? tokens.refreshToken : null;
  }
}

module.exports = new SpotifyFileTokenStorage();
