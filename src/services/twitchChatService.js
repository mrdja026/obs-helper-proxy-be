const { ChatClient } = require("@twurple/chat");
const { ApiClient } = require("@twurple/api");
const { RefreshingAuthProvider } = require("@twurple/auth");
const logger = require("../utils/logger");
const config = require("../config/config");
const TokenService = require("./tokenService");
const songQueue = require("./songQueue");
const {
  ChatMessage,
  SendMessageRequest,
  SendMessageResponse,
  ChatConnectionStatus,
  ChatEventTypes,
} = require("../dto/chatDto");

class TwitchChatService {
  constructor() {
    this.chatClient = null;
    this.apiClient = null;
    this.isConnected = false;
    this.connectionStatus = new ChatConnectionStatus();
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.eventHandlers = new Map();
  }

  /**
   * Initialize the chat service with tokens from session
   * @param {Object} session - Express session object
   * @param {String} connectionType - "broadcaster" or "bot"
   * @returns {Promise<Object>} Initialization result
   */
  async initialize(
    session,
    connectionType = config.twitch.chat.connectionType
  ) {
    // Initialize user variable outside try block to make it accessible in catch
    let user = null;

    try {
      // Get tokens from session or cache
      let tokens = TokenService.getTokens(session);
      user = TokenService.getUserFromTokens(session);

      // Fallback to cache if session doesn't have tokens
      if (!tokens) {
        tokens = await TokenService.getTokensFromCache();
        if (tokens) {
          user = tokens.user;
          logger.info("Using cached tokens for chat initialization", {
            userId: user?.id,
            username: user?.username,
          });
        }
      }

      if (!tokens) {
        throw new Error("No valid tokens found in session or cache");
      }

      if (!user) {
        throw new Error("No user information found in tokens");
      }

      // Determine channel name
      const channelName = config.twitch.chat.channelName || user.username;
      if (!channelName) {
        throw new Error("Channel name is required");
      }

      // Get current tokens for auth provider
      const currentTokens = await TokenService.getTokens(session);

      // Create auth provider for token management
      const authProvider = new RefreshingAuthProvider({
        clientId: config.twitch.clientId,
        clientSecret: config.twitch.clientSecret,
        onRefresh: async (newTokenData) => {
          logger.info("Token refreshed", {
            userId: user.id,
            expiresAt: new Date(Date.now() + newTokenData.expiresIn * 1000),
          });

          // Update tokens in storage
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

      // Add the user token to the auth provider
      await authProvider.addUserForToken(
        {
          accessToken: currentTokens.accessToken,
          refreshToken: currentTokens.refreshToken,
          expiresIn: Math.floor(
            (new Date(currentTokens.expiresAt) - new Date()) / 1000
          ),
          scope: currentTokens.scope,
          tokenType: currentTokens.tokenType,
        },
        ["chat"]
      );

      // Create API client
      this.apiClient = new ApiClient({ authProvider });

      // Create chat client
      this.chatClient = new ChatClient({
        authProvider,
        logger: {
          enabled: config.twitch.chat.enableLogging,
          level: config.twitch.chat.enableLogging ? "info" : "none",
        },
      });

      // Set up event handlers
      this.setupEventHandlers(channelName, connectionType, user);

      // Connect to chat
      await this.connect(channelName, user);

      // Update connection status
      this.connectionStatus = new ChatConnectionStatus({
        connected: true,
        channel: channelName,
        username: user.username,
        connectionType: connectionType,
        lastConnected: new Date().toISOString(),
        reconnectAttempts: 0,
      });

      // Emit connection status event
      this.emitEvent(ChatEventTypes.CONNECTION_STATUS, this.connectionStatus);

      logger.info("Twitch chat service initialized successfully", {
        channelName,
        username: user.username,
        connectionType,
      });

      logger.info(
        "🎯 Chat connection established - ready to receive and send messages",
        {
          channel: channelName,
          connectedAs: user.username,
          connectionType,
        }
      );

      return {
        success: true,
        channel: channelName,
        username: user.username,
        connectionType,
      };
    } catch (error) {
      logger.error("❌ Failed to initialize Twitch chat service", {
        error: error.message,
        stack: error.stack,
        userId: user?.id,
        username: user?.username,
        connectionType,
      });

      this.connectionStatus = new ChatConnectionStatus({
        connected: false,
        error: error.message,
        lastDisconnected: new Date().toISOString(),
      });

      this.emitEvent(ChatEventTypes.CONNECTION_STATUS, this.connectionStatus);
      this.emitEvent(ChatEventTypes.ERROR, { message: error.message });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Connect to chat
   * @param {String} channelName - Channel to connect to
   * @param {Object} user - User information
   * @returns {Promise<void>}
   */
  async connect(channelName, user) {
    if (!this.chatClient) {
      throw new Error("Chat client not initialized");
    }

    try {
      await this.chatClient.connect();
      await this.chatClient.join(channelName);
      this.isConnected = true;
      logger.info("🟢 Connected to Twitch chat", {
        channelName,
        connectedAs: user.username,
      });
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from chat
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.chatClient && this.isConnected) {
      try {
        this.chatClient.quit();
        logger.info("🔌 Disconnected from Twitch chat");
      } catch (error) {
        logger.error("Error disconnecting from chat", {
          error: error.message,
          channel: this.connectionStatus.channel,
        });
      }
    }

    this.isConnected = false;
    this.connectionStatus.connected = false;
    this.connectionStatus.lastDisconnected = new Date().toISOString();
    this.emitEvent(ChatEventTypes.CONNECTION_STATUS, this.connectionStatus);
  }

  /**
   * Send a message to chat
   * @param {SendMessageRequest} messageRequest - Message to send
   * @returns {Promise<SendMessageResponse>} Send result
   */
  async sendMessage(messageRequest) {
    const response = new SendMessageResponse({
      message: messageRequest.message,
      channel: messageRequest.channel,
    });

    try {
      // Validate request
      const validation = messageRequest.validate();
      if (!validation.isValid) {
        throw new Error(`Invalid message: ${validation.errors.join(", ")}`);
      }

      if (!this.isConnected || !this.chatClient) {
        throw new Error("Not connected to chat");
      }

      // Send message (Twurple version in use doesn't support reply())
      await this.chatClient.say(messageRequest.channel, messageRequest.message);

      response.success = true;
      const generatedMessageId =
        messageRequest.replyToMessageId ||
        `sent-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
      response.messageId = generatedMessageId;
      response.timestamp = new Date().toISOString();

      logger.info("Chat message sent", {
        messageId: generatedMessageId,
        channel: messageRequest.channel,
        message: messageRequest.message,
        messageLength: messageRequest.message.length,
        replyTo: messageRequest.replyToMessageId || null,
      });

      // Emit event for sent message
      this.emitEvent(ChatEventTypes.SENT_MESSAGE, response);

      return response;
    } catch (error) {
      response.success = false;
      response.error = error.message;

      logger.error("❌ Failed to send message to chat", {
        error: error.message,
        channel: messageRequest.channel,
        messageLength: messageRequest.message?.length || 0,
        messagePreview:
          messageRequest.message?.substring(0, 50) +
          (messageRequest.message?.length > 50 ? "..." : ""),
      });

      this.emitEvent(ChatEventTypes.ERROR, { message: error.message });

      return response;
    }
  }

  /**
   * Set up event handlers for chat client
   * @param {String} channelName - Channel name
   * @param {String} connectionType - Connection type
   * @param {Object} user - User information
   */
  setupEventHandlers(channelName, connectionType, user) {
    if (!this.chatClient) return;

    // Handle incoming messages
    this.chatClient.onMessage((channel, user, message, msg) => {
      const chatMessage = ChatMessage.fromTwurpleMessage(msg, channel);
      const validation = chatMessage.validate();

      if (validation.isValid) {
        // Log incoming message with full details
        logger.info("📨 New chat message received", {
          id: chatMessage.id,
          channel: channel,
          user: {
            username: chatMessage.user.username,
            displayName: chatMessage.user.displayName,
            color: chatMessage.user.color,
            isMod: chatMessage.user.isMod,
            isSubscriber: chatMessage.user.isSubscriber,
            isVip: chatMessage.user.isVip,
          },
          message: chatMessage.text,
          timestamp: chatMessage.timestamp,
          isAction: chatMessage.isAction,
          isHighlighted: chatMessage.isHighlighted,
          emoteCount: chatMessage.emotes.length,
        });

        this.emitEvent(ChatEventTypes.MESSAGE, chatMessage);

        // Command parsing
        try {
          const text = (chatMessage.text || "").trim();
          const isAdmin =
            Boolean(chatMessage.user.isMod) ||
            /\bbroadcaster\b/i.test(
              (chatMessage.user.badges || []).map((b) => b.id).join(" ")
            );

          // !song <title>
          if (text.toLowerCase().startsWith("!song ")) {
            const title = text.slice(6).trim();
            const result = songQueue.addSong({
              title,
              requestedBy: chatMessage.user.username,
            });
            if (!result.ok) {
              let reply = "";
              if (result.error === "full") {
                reply = "Queue full. Try again once the queue is empty.";
              } else if (result.error === "invalid_title") {
                reply = "Please provide a valid song title.";
              } else {
                reply = "Could not add song.";
              }
              this.sendMessage(
                new SendMessageRequest({
                  channel: channelName,
                  message: reply,
                  replyToMessageId: chatMessage.id,
                })
              );
            } else {
              const reply = `Added to queue at position ${result.position}: ${result.item.title} (by ${chatMessage.user.username})`;
              this.sendMessage(
                new SendMessageRequest({
                  channel: channelName,
                  message: reply,
                  replyToMessageId: chatMessage.id,
                })
              );
            }
            return;
          }

          // !skip
          if (text.toLowerCase() === "!skip") {
            if (!isAdmin) return;
            const result = songQueue.skip();
            let reply = "";
            if (!result.ok) {
              reply = "Queue is empty.";
            } else {
              reply = `Skipped: ${result.item.title}`;
            }
            this.sendMessage(
              new SendMessageRequest({
                channel: channelName,
                message: reply,
                replyToMessageId: chatMessage.id,
              })
            );
            return;
          }

          // !remove <index>
          if (/^!remove\s+\d+$/i.test(text)) {
            if (!isAdmin) return;
            const idx = Number(text.split(/\s+/)[1]);
            const result = songQueue.removeByIndex(idx);
            let reply = "";
            if (!result.ok) {
              reply = `No song at index ${idx}`;
            } else {
              reply = `Removed #${idx}: ${result.item.title}`;
            }
            this.sendMessage(
              new SendMessageRequest({
                channel: channelName,
                message: reply,
                replyToMessageId: chatMessage.id,
              })
            );
            return;
          }

          // !clearqueue
          if (text.toLowerCase() === "!clearqueue") {
            if (!isAdmin) return;
            const result = songQueue.clear();
            const reply = "Queue cleared.";
            this.sendMessage(
              new SendMessageRequest({
                channel: channelName,
                message: reply,
                replyToMessageId: chatMessage.id,
              })
            );
            return;
          }
        } catch (e) {
          logger.error("Command handling error", { error: e.message });
        }
      } else {
        logger.warn("Received invalid chat message", {
          errors: validation.errors,
          message: message.substring(0, 50),
        });
      }
    });

    // Handle connection established
    this.chatClient.onConnect(() => {
      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.connectionStatus = new ChatConnectionStatus({
        connected: true,
        channel: channelName,
        username: user.username,
        connectionType: connectionType,
        lastConnected: new Date().toISOString(),
        reconnectAttempts: 0,
      });

      this.emitEvent(ChatEventTypes.CONNECTION_STATUS, this.connectionStatus);
      logger.info("🟢 Chat client connected successfully", {
        channel: channelName,
        username: user.username,
        connectionType: connectionType,
      });
    });

    // Handle authentication failures (Twurple v7)
    this.chatClient.onAuthenticationFailure((text, retryCount) => {
      const errorMessage = text || "Authentication failed";

      logger.error("Chat authentication failed", {
        error: errorMessage,
        retryCount,
        channel: channelName,
        username: user.username,
        connectionType: connectionType,
      });

      this.isConnected = false;
      this.connectionStatus.connected = false;
      this.connectionStatus.error = errorMessage;
      this.connectionStatus.lastDisconnected = new Date().toISOString();

      this.emitEvent(ChatEventTypes.CONNECTION_STATUS, this.connectionStatus);
      this.emitEvent(ChatEventTypes.ERROR, { message: errorMessage });

      // Attempt reconnection
      this.attemptReconnect();
    });

    // Handle disconnection
    this.chatClient.onDisconnect((manually, reason) => {
      this.isConnected = false;
      logger.warn("🟡 Chat client disconnected", {
        manually: manually,
        reason: reason || "Unknown reason",
        channel: channelName,
        username: user.username,
        connectionType: connectionType,
      });

      this.connectionStatus.connected = false;
      this.connectionStatus.lastDisconnected = new Date().toISOString();

      this.emitEvent(ChatEventTypes.CONNECTION_STATUS, this.connectionStatus);

      // Attempt reconnection if not manual
      if (!manually) {
        this.attemptReconnect();
      }
    });
  }

  /**
   * Attempt to reconnect to chat
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= config.twitch.chat.reconnectAttempts) {
      logger.error("❌ Maximum reconnection attempts reached, giving up", {
        maxAttempts: config.twitch.chat.reconnectAttempts,
        totalAttempts: this.reconnectAttempts,
      });
      this.emitEvent(ChatEventTypes.ERROR, {
        message: "Failed to reconnect after maximum attempts",
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = config.twitch.chat.reconnectDelay * this.reconnectAttempts;

    logger.info(
      `🔄 Attempting to reconnect to chat (${this.reconnectAttempts}/${config.twitch.chat.reconnectAttempts}) in ${delay}ms`,
      {
        attempt: this.reconnectAttempts,
        maxAttempts: config.twitch.chat.reconnectAttempts,
        delay: delay,
      }
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.chatClient) {
          await this.chatClient.reconnect();
          logger.info("🟢 Successfully reconnected to chat", {
            attempt: this.reconnectAttempts,
          });
        }
      } catch (error) {
        logger.error("🔴 Reconnection failed", {
          error: error.message,
          attempt: this.reconnectAttempts,
        });
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Get current connection status
   * @returns {ChatConnectionStatus} Current status
   */
  getConnectionStatus() {
    return this.connectionStatus;
  }

  /**
   * Register event handler
   * @param {String} eventType - Event type from ChatEventTypes
   * @param {Function} handler - Event handler function
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  /**
   * Remove event handler
   * @param {String} eventType - Event type from ChatEventTypes
   * @param {Function} handler - Event handler function to remove
   */
  off(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all registered handlers
   * @param {String} eventType - Event type from ChatEventTypes
   * @param {*} data - Event data
   */
  emitEvent(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      this.eventHandlers.get(eventType).forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error("Error in chat event handler", {
            eventType,
            error: error.message,
            stack: error.stack,
          });
        }
      });
    }
  }
}

// Singleton instance
const twitchChatService = new TwitchChatService();

module.exports = twitchChatService;
