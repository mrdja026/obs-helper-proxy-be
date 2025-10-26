const EventEmitter = require("events");
const { ApiClient } = require("@twurple/api");
const { RefreshingAuthProvider } = require("@twurple/auth");
const logger = require("../utils/logger");
const config = require("../config/config");
const TokenService = require("./tokenService");

let EventSubWsListener;
try {
  ({ EventSubWsListener } = require("@twurple/eventsub-ws"));
} catch (e) {
  EventSubWsListener = null;
}

class TwitchEventSubService extends EventEmitter {
  constructor() {
    super();
    this.authProvider = null;
    this.apiClient = null;
    this.listener = null;
    this.started = false;
  }

  async initialize(session = null) {
    if (!EventSubWsListener) {
      logger.warn(
        "@twurple/eventsub-ws is not installed. Skipping EventSub initialization."
      );
      return { success: false, error: "eventsub_not_installed" };
    }

    try {
      const tokens = await TokenService.getTokens(session);
      const user = (await TokenService.getUserFromTokens(session)) || tokens?.user;
      if (!tokens || !user) {
        throw new Error("Missing tokens or user for EventSub initialization");
      }

      const currentTokens = tokens;
      this.authProvider = new RefreshingAuthProvider({
        clientId: config.twitch.clientId,
        clientSecret: config.twitch.clientSecret,
        onRefresh: async (newTokenData) => {
          await TokenService.updateTokens(session, {
            accessToken: newTokenData.accessToken,
            refreshToken:
              newTokenData.refreshToken || currentTokens.refreshToken,
            expiresIn: newTokenData.expiresIn,
            scope: newTokenData.scope || currentTokens.scope,
            tokenType: newTokenData.tokenType || currentTokens.tokenType,
          });
        },
      });

      await this.authProvider.addUserForToken(
        {
          accessToken: currentTokens.accessToken,
          refreshToken: currentTokens.refreshToken,
          expiresIn: Math.max(
            1,
            Math.floor((new Date(currentTokens.expiresAt) - new Date()) / 1000)
          ),
          scope: currentTokens.scope,
          tokenType: currentTokens.tokenType,
        },
        [
          "channel:read:subscriptions",
          "moderator:read:followers",
          "chat:read",
          "chat:edit",
        ]
      );

      this.apiClient = new ApiClient({ authProvider: this.authProvider });

      // Create WS listener
      this.listener = new EventSubWsListener({ apiClient: this.apiClient });

      // Resolve broadcaster & moderator IDs from stored tokens
      const broadcasterId = user?.id;
      const moderatorId = broadcasterId; // self-moderation is allowed
      if (!broadcasterId) {
        throw new Error("Unable to resolve broadcaster ID for EventSub");
      }

      // Subscriptions
      await this.listener.start();

      await this.listener.subscribeToChannelFollowEvents(
        { broadcaster: broadcasterId, moderator: moderatorId },
        (e) => {
          const data = {
            displayName: e.userDisplayName,
            userId: e.userId,
            eventAt: new Date().toISOString(),
          };
          this.emit("twitchFollow", data);
          logger.info("EventSub follow", data);
        }
      );

      await this.listener.subscribeToChannelSubscriptionEvents(
        broadcasterId,
        (e) => {
          const data = {
            displayName: e.userDisplayName,
            userId: e.userId,
            tier: e.tier,
            isGift: !!e.isGift,
            months: e.months || 0,
            eventAt: new Date().toISOString(),
          };
          this.emit("twitchSubscribe", data);
          logger.info("EventSub subscribe", data);
        }
      );

      this.started = true;
      logger.info("Twitch EventSub WS initialized and subscriptions active");
      return { success: true };
    } catch (error) {
      logger.error("Failed to initialize EventSub WS", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async shutdown() {
    try {
      if (this.listener) {
        await this.listener.stop();
      }
    } catch {}
    this.started = false;
  }
}

module.exports = new TwitchEventSubService();
