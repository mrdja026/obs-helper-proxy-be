/**
 * Data Transfer Objects for Twitch Chat functionality
 */

/**
 * Chat message structure
 */
class ChatMessage {
  constructor(data = {}) {
    this.id = data.id || "";
    this.text = data.text || "";
    this.channel = data.channel || "";
    this.user = {
      id: data.user?.id || "",
      username: data.user?.username || "",
      displayName: data.user?.displayName || data.user?.username || "",
      color: data.user?.color || "",
      badges: data.user?.badges || [],
      isMod: data.user?.isMod || false,
      isSubscriber: data.user?.isSubscriber || false,
      isVip: data.user?.isVip || false,
    };
    this.timestamp = data.timestamp || new Date().toISOString();
    this.isAction = data.isAction || false;
    this.isHighlighted = data.isHighlighted || false;
    this.emotes = data.emotes || [];
  }

  /**
   * Validate chat message structure
   * @returns {Object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    if (!this.text || typeof this.text !== "string") {
      errors.push("Message text is required and must be a string");
    }

    if (!this.user.username || typeof this.user.username !== "string") {
      errors.push("User username is required and must be a string");
    }

    if (!this.channel || typeof this.channel !== "string") {
      errors.push("Channel is required and must be a string");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a ChatMessage from Twurple chat message
   * @param {Object} twurpleMessage - Message from Twurple chat client
   * @param {String} channel - Channel name
   * @returns {ChatMessage} Formatted chat message
   */
  static fromTwurpleMessage(twurpleMessage, channel) {
    if (!twurpleMessage) {
      return new ChatMessage();
    }

    const emotes = [];
    if (twurpleMessage.emotes) {
      twurpleMessage.emotes.forEach((emote) => {
        emotes.push({
          id: emote.id,
          name: emote.name,
          position: emote.position,
          start: emote.start,
          end: emote.end,
        });
      });
    }

    const badges = [];
    if (twurpleMessage.userInfo.badges) {
      twurpleMessage.userInfo.badges.forEach((badge) => {
        badges.push({
          id: badge.id,
          version: badge.version,
        });
      });
    }

    return new ChatMessage({
      id: twurpleMessage.id,
      text: twurpleMessage.content.value,
      channel: channel,
      user: {
        id: twurpleMessage.userInfo.userId,
        username: twurpleMessage.userInfo.userName,
        displayName: twurpleMessage.userInfo.displayName,
        color: twurpleMessage.userInfo.color,
        badges: badges,
        isMod: twurpleMessage.userInfo.isMod,
        isSubscriber: twurpleMessage.userInfo.isSubscriber,
        isVip: twurpleMessage.userInfo.isVip,
      },
      timestamp: twurpleMessage.date?.toISOString() || new Date().toISOString(),
      isAction: twurpleMessage.isAction,
      isHighlighted: twurpleMessage.isHighlighted,
      emotes: emotes,
    });
  }
}

/**
 * Send message request structure
 */
class SendMessageRequest {
  constructor(data = {}) {
    this.message = data.message || "";
    this.channel = data.channel || "";
    this.replyToMessageId = data.replyToMessageId || null;
  }

  /**
   * Validate send message request
   * @returns {Object} Validation result with isValid and errors
   */
  validate() {
    const errors = [];

    if (!this.message || typeof this.message !== "string") {
      errors.push("Message is required and must be a string");
    } else if (this.message.length > 500) {
      errors.push("Message must be 500 characters or less");
    }

    if (!this.channel || typeof this.channel !== "string") {
      errors.push("Channel is required and must be a string");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Send message response structure
 */
class SendMessageResponse {
  constructor(data = {}) {
    this.success = data.success || false;
    this.messageId = data.messageId || "";
    this.message = data.message || "";
    this.channel = data.channel || "";
    this.error = data.error || null;
    this.timestamp = data.timestamp || new Date().toISOString();
  }
}

/**
 * Chat connection status structure
 */
class ChatConnectionStatus {
  constructor(data = {}) {
    this.connected = data.connected || false;
    this.channel = data.channel || "";
    this.username = data.username || "";
    this.connectionType = data.connectionType || ""; // "broadcaster" or "bot"
    this.lastConnected = data.lastConnected || null;
    this.lastDisconnected = data.lastDisconnected || null;
    this.reconnectAttempts = data.reconnectAttempts || 0;
    this.error = data.error || null;
  }
}

/**
 * Chat event types for WebSocket communication
 */
const ChatEventTypes = {
  MESSAGE: "chatMessage",
  CONNECTION_STATUS: "chatConnectionStatus",
  ERROR: "chatError",
  SENT_MESSAGE: "chatSentMessage",
};

module.exports = {
  ChatMessage,
  SendMessageRequest,
  SendMessageResponse,
  ChatConnectionStatus,
  ChatEventTypes,
};
