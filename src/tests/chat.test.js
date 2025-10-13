const TokenService = require("../services/tokenService");
const {
  ChatMessage,
  SendMessageRequest,
  SendMessageResponse,
  ChatConnectionStatus,
} = require("../dto/chatDto");

describe("Chat Service Tests", () => {
  describe("TokenService", () => {
    let mockSession;

    beforeEach(() => {
      mockSession = {};
    });

    test("should store tokens in session", () => {
      const tokens = {
        accessToken: "test_access_token",
        refreshToken: "test_refresh_token",
        expiresIn: 3600,
        scope: ["chat:read", "chat:edit"],
        tokenType: "bearer",
      };

      const user = {
        id: "12345",
        username: "testuser",
        displayName: "Test User",
      };

      const result = TokenService.storeTokens(mockSession, tokens, user);

      expect(result).toBe(true);
      expect(mockSession.twitchTokens).toBeDefined();
      expect(mockSession.twitchTokens.accessToken).toBe(tokens.accessToken);
      expect(mockSession.twitchTokens.user).toEqual(user);
    });

    test("should retrieve tokens from session", () => {
      const tokens = {
        accessToken: "test_access_token",
        refreshToken: "test_refresh_token",
        expiresIn: 3600,
        scope: ["chat:read", "chat:edit"],
        tokenType: "bearer",
      };

      const user = {
        id: "12345",
        username: "testuser",
        displayName: "Test User",
      };

      TokenService.storeTokens(mockSession, tokens, user);
      const retrievedTokens = TokenService.getTokens(mockSession);

      expect(retrievedTokens).toBeDefined();
      expect(retrievedTokens.accessToken).toBe(tokens.accessToken);
      expect(retrievedTokens.user).toEqual(user);
    });

    test("should return null for invalid session", () => {
      const tokens = TokenService.getTokens(null);
      expect(tokens).toBeNull();
    });

    test("should validate tokens correctly", () => {
      const tokens = {
        accessToken: "test_access_token",
        refreshToken: "test_refresh_token",
        expiresIn: 3600,
        scope: ["chat:read", "chat:edit"],
        tokenType: "bearer",
      };

      const user = {
        id: "12345",
        username: "testuser",
        displayName: "Test User",
      };

      TokenService.storeTokens(mockSession, tokens, user);
      const isValid = TokenService.areTokensValid(mockSession);

      expect(isValid).toBe(true);
    });

    test("should clear tokens from session", () => {
      const tokens = {
        accessToken: "test_access_token",
        refreshToken: "test_refresh_token",
        expiresIn: 3600,
        scope: ["chat:read", "chat:edit"],
        tokenType: "bearer",
      };

      const user = {
        id: "12345",
        username: "testuser",
        displayName: "Test User",
      };

      TokenService.storeTokens(mockSession, tokens, user);
      TokenService.clearTokens(mockSession);

      expect(mockSession.twitchTokens).toBeUndefined();
    });
  });

  describe("Chat DTOs", () => {
    describe("ChatMessage", () => {
      test("should create a valid chat message", () => {
        const messageData = {
          id: "msg123",
          text: "Hello, world!",
          channel: "testchannel",
          user: {
            id: "user123",
            username: "testuser",
            displayName: "Test User",
            color: "#FF0000",
          },
        };

        const message = new ChatMessage(messageData);

        expect(message.id).toBe("msg123");
        expect(message.text).toBe("Hello, world!");
        expect(message.channel).toBe("testchannel");
        expect(message.user.username).toBe("testuser");
      });

      test("should validate chat message correctly", () => {
        const messageData = {
          id: "msg123",
          text: "Hello, world!",
          channel: "testchannel",
          user: {
            id: "user123",
            username: "testuser",
            displayName: "Test User",
          },
        };

        const message = new ChatMessage(messageData);
        const validation = message.validate();

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      test("should fail validation for invalid message", () => {
        const messageData = {
          id: "msg123",
          text: "",
          channel: "testchannel",
          user: {
            id: "user123",
            username: "",
            displayName: "Test User",
          },
        };

        const message = new ChatMessage(messageData);
        const validation = message.validate();

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });
    });

    describe("SendMessageRequest", () => {
      test("should create a valid send message request", () => {
        const requestData = {
          message: "Hello, chat!",
          channel: "testchannel",
          replyToMessageId: "msg123",
        };

        const request = new SendMessageRequest(requestData);

        expect(request.message).toBe("Hello, chat!");
        expect(request.channel).toBe("testchannel");
        expect(request.replyToMessageId).toBe("msg123");
      });

      test("should validate send message request correctly", () => {
        const requestData = {
          message: "Hello, chat!",
          channel: "testchannel",
        };

        const request = new SendMessageRequest(requestData);
        const validation = request.validate();

        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      test("should fail validation for empty message", () => {
        const requestData = {
          message: "",
          channel: "testchannel",
        };

        const request = new SendMessageRequest(requestData);
        const validation = request.validate();

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
      });

      test("should fail validation for message too long", () => {
        const requestData = {
          message: "a".repeat(501), // 501 characters
          channel: "testchannel",
        };

        const request = new SendMessageRequest(requestData);
        const validation = request.validate();

        expect(validation.isValid).toBe(false);
        expect(validation.errors).toContain(
          "Message must be 500 characters or less"
        );
      });
    });

    describe("SendMessageResponse", () => {
      test("should create a send message response", () => {
        const responseData = {
          success: true,
          messageId: "msg123",
          message: "Hello, chat!",
          channel: "testchannel",
        };

        const response = new SendMessageResponse(responseData);

        expect(response.success).toBe(true);
        expect(response.messageId).toBe("msg123");
        expect(response.message).toBe("Hello, chat!");
        expect(response.channel).toBe("testchannel");
      });

      test("should create a failed send message response", () => {
        const responseData = {
          success: false,
          error: "Rate limit exceeded",
        };

        const response = new SendMessageResponse(responseData);

        expect(response.success).toBe(false);
        expect(response.error).toBe("Rate limit exceeded");
      });
    });

    describe("ChatConnectionStatus", () => {
      test("should create connection status", () => {
        const statusData = {
          connected: true,
          channel: "testchannel",
          username: "testuser",
          connectionType: "broadcaster",
          lastConnected: new Date().toISOString(),
        };

        const status = new ChatConnectionStatus(statusData);

        expect(status.connected).toBe(true);
        expect(status.channel).toBe("testchannel");
        expect(status.username).toBe("testuser");
        expect(status.connectionType).toBe("broadcaster");
      });

      test("should create default connection status", () => {
        const status = new ChatConnectionStatus();

        expect(status.connected).toBe(false);
        expect(status.channel).toBe("");
        expect(status.username).toBe("");
        expect(status.connectionType).toBe("");
      });
    });
  });
});
