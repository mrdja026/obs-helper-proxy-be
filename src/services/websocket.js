const WebSocket = require("ws");
const logger = require("../utils/logger");
const config = require("../config/config");
const twitchChatService = require("./twitchChatService");
const { ChatEventTypes } = require("../dto/chatDto");

// Conditionally require the appropriate connection service
const obsConnection = config.mockMode
  ? require("./obsConnectionMock")
  : require("./obsConnection");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Using Map to store client metadata
    this.heartbeatInterval = null;
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      lastActivity: null,
    };
  }

  setup(server) {
    this.wss = new WebSocket.Server({
      server,
      perMessageDeflate: false, // Disable compression for better performance
    });

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Set up OBS event handlers
    this.setupOBSEventHandlers();

    // Set up chat event handlers
    this.setupChatEventHandlers();

    // Start heartbeat
    this.startHeartbeat();

    logger.info(
      `WebSocket server is running in ${
        config.mockMode ? "Mock" : "Normal"
      } mode`,
      {
        port: config.port,
        heartbeatInterval: config.websocket.heartbeatInterval,
      }
    );
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
      connectedAt: new Date().toISOString(),
      lastPing: new Date().toISOString(),
      messageCount: 0,
    };

    this.clients.set(clientId, clientInfo);
    this.stats.totalConnections++;
    this.stats.activeConnections++;
    this.stats.lastActivity = new Date().toISOString();

    logger.info(`New WebSocket client connected`, {
      clientId,
      ip: clientInfo.ip,
      totalClients: this.clients.size,
    });

    // Send initial connection status
    this.sendToClient(clientId, {
      type: "connectionStatus",
      data: {
        connected: obsConnection.isConnected(),
        mockMode: config.mockMode,
        clientId: clientId,
        serverTime: new Date().toISOString(),
      },
    });

    ws.on("close", (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    ws.on("error", (error) => {
      this.handleError(clientId, error);
    });

    ws.on("message", (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on("pong", () => {
      this.handlePong(clientId);
    });
  }

  generateClientId() {
    return (
      "client_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now()
    );
  }

  handleDisconnection(clientId, code, reason) {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      this.clients.delete(clientId);
      this.stats.activeConnections--;
      this.stats.lastActivity = new Date().toISOString();

      logger.info(`WebSocket client disconnected`, {
        clientId,
        code,
        reason: reason.toString(),
        duration: Date.now() - new Date(clientInfo.connectedAt).getTime(),
        totalClients: this.clients.size,
      });
    }
  }

  handleError(clientId, error) {
    this.stats.errors++;
    logger.error(`WebSocket client error`, {
      clientId,
      error: error.message,
      stack: error.stack,
    });
  }

  handleMessage(clientId, data) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) return;

    try {
      clientInfo.messageCount++;
      this.stats.messagesReceived++;
      this.stats.lastActivity = new Date().toISOString();

      const message = JSON.parse(data.toString());

      if (config.logging.enableWebSocketLogs) {
        logger.debug(`WebSocket message received`, {
          clientId,
          type: message.type,
          messageCount: clientInfo.messageCount,
        });
      }

      // Handle different message types
      switch (message.type) {
        case "ping":
          this.sendToClient(clientId, {
            type: "pong",
            data: {
              timestamp: new Date().toISOString(),
            },
          });
          break;
        case "getStatus":
          this.sendToClient(clientId, {
            type: "statusResponse",
            data: {
              connected: obsConnection.isConnected(),
              mockMode: config.mockMode,
              serverStats: this.stats,
            },
          });
          break;
        default:
          logger.warn(`Unknown message type`, {
            clientId,
            messageType: message.type,
          });
      }
    } catch (error) {
      logger.error(`Error parsing WebSocket message`, {
        clientId,
        error: error.message,
        data: data.toString(),
      });
    }
  }

  handlePong(clientId) {
    const clientInfo = this.clients.get(clientId);
    if (clientInfo) {
      clientInfo.lastPing = new Date().toISOString();
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((clientInfo, clientId) => {
        if (clientInfo.ws.readyState === WebSocket.OPEN) {
          clientInfo.ws.ping();
        } else {
          // Remove dead connections
          this.clients.delete(clientId);
          this.stats.activeConnections--;
        }
      });
    }, config.websocket.heartbeatInterval);
  }

  setupOBSEventHandlers() {
    // Handle scene changes
    obsConnection.addEventHandler("sceneChanged", (data) => {
      const message = {
        type: "sceneChanged",
        data: {
          sceneName: data.sceneName,
          previousSceneName: data.previousSceneName,
          sceneIndex: data.sceneIndex,
          previousSceneIndex: data.previousSceneIndex,
          timestamp: new Date().toISOString(),
        },
      };

      this.broadcast(message);

      logger.info(`Scene change event broadcasted`, {
        sceneName: data.sceneName,
        previousSceneName: data.previousSceneName,
        clientCount: this.clients.size,
      });
    });

    // Handle connection status changes
    obsConnection.addEventHandler("connectionStatus", (data) => {
      const message = {
        type: "obsConnectionStatus",
        data: {
          connected: data.connected,
          host: data.host,
          mockMode: config.mockMode,
          timestamp: new Date().toISOString(),
        },
      };

      this.broadcast(message);

      logger.info(`OBS connection status broadcasted`, {
        connected: data.connected,
        host: data.host,
        clientCount: this.clients.size,
      });
    });

    // Handle errors
    obsConnection.addEventHandler("error", (error) => {
      const message = {
        type: "obsError",
        data: {
          message: error.message,
          name: error.name,
          timestamp: new Date().toISOString(),
        },
      };

      this.broadcast(message);

      logger.error(`OBS error broadcasted`, {
        error: error.message,
        clientCount: this.clients.size,
      });
    });
  }

  setupChatEventHandlers() {
    // Handle chat messages
    twitchChatService.on(ChatEventTypes.MESSAGE, (message) => {
      const wsMessage = {
        type: ChatEventTypes.MESSAGE,
        data: message,
      };

      this.broadcast(wsMessage);

      logger.info(
        `📡 Chat message broadcasted to ${this.clients.size} WebSocket clients`,
        {
          messageId: message.id || "unknown",
          username: message.user?.username || "unknown",
          displayName: message.user?.displayName || "Unknown",
          channel: message.channel || "unknown",
          message: message.text
            ? message.text.substring(0, 50) +
              (message.text.length > 50 ? "..." : "")
            : "",
          clientCount: this.clients.size,
        }
      );
    });

    // Handle chat connection status changes
    twitchChatService.on(ChatEventTypes.CONNECTION_STATUS, (status) => {
      const wsMessage = {
        type: ChatEventTypes.CONNECTION_STATUS,
        data: status,
      };

      this.broadcast(wsMessage);

      logger.info(
        `📡 Chat connection status broadcasted to ${this.clients.size} WebSocket clients`,
        {
          connected: status.connected,
          channel: status.channel || "unknown",
          username: status.username || "unknown",
          clientCount: this.clients.size,
        }
      );
    });

    // Handle chat errors
    twitchChatService.on(ChatEventTypes.ERROR, (error) => {
      const wsMessage = {
        type: ChatEventTypes.ERROR,
        data: {
          source: "chat",
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      };

      this.broadcast(wsMessage);

      logger.error(
        `📡 Chat error broadcasted to ${this.clients.size} WebSocket clients`,
        {
          error: error.message || "Unknown error",
          clientCount: this.clients.size,
        }
      );
    });

    // Handle sent chat messages
    twitchChatService.on(ChatEventTypes.SENT_MESSAGE, (message) => {
      const wsMessage = {
        type: ChatEventTypes.SENT_MESSAGE,
        data: message,
      };

      this.broadcast(wsMessage);

      logger.info(
        `📡 Sent chat message broadcasted to ${this.clients.size} WebSocket clients`,
        {
          messageId: message.messageId,
          success: message.success,
          channel: message.channel,
          message:
            message.message?.substring(0, 50) +
            (message.message?.length > 50 ? "..." : ""),
          clientCount: this.clients.size,
        }
      );
    });
  }

  broadcast(message, excludeClientId = null) {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((clientInfo, clientId) => {
      if (
        clientInfo.ws.readyState === WebSocket.OPEN &&
        clientId !== excludeClientId
      ) {
        try {
          clientInfo.ws.send(messageStr);
          sentCount++;
          clientInfo.messageCount++;
        } catch (error) {
          logger.error(`Error sending message to client`, {
            clientId,
            error: error.message,
          });
          // Remove problematic client
          this.clients.delete(clientId);
          this.stats.activeConnections--;
        }
      }
    });

    this.stats.messagesSent += sentCount;
    this.stats.lastActivity = new Date().toISOString();

    if (config.logging.enableWebSocketLogs) {
      logger.debug(`Message broadcasted`, {
        messageType: message.type,
        sentCount,
        totalClients: this.clients.size,
      });
    }
  }

  sendToClient(clientId, message) {
    const clientInfo = this.clients.get(clientId);
    if (!clientInfo) {
      logger.warn(`Attempted to send message to non-existent client`, {
        clientId,
      });
      return false;
    }

    if (clientInfo.ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        clientInfo.ws.send(messageStr);
        clientInfo.messageCount++;
        this.stats.messagesSent++;
        this.stats.lastActivity = new Date().toISOString();
        return true;
      } catch (error) {
        logger.error(`Error sending message to client`, {
          clientId,
          error: error.message,
        });
        // Remove problematic client
        this.clients.delete(clientId);
        this.stats.activeConnections--;
        return false;
      }
    }

    return false;
  }

  getStats() {
    return {
      ...this.stats,
      activeConnections: this.clients.size,
      clients: Array.from(this.clients.values()).map((client) => ({
        id: client.id,
        ip: client.ip,
        connectedAt: client.connectedAt,
        messageCount: client.messageCount,
        lastPing: client.lastPing,
      })),
    };
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    this.clients.forEach((clientInfo, clientId) => {
      try {
        clientInfo.ws.close(1001, "Server shutdown");
      } catch (error) {
        logger.error(`Error closing client connection`, {
          clientId,
          error: error.message,
        });
      }
    });

    this.clients.clear();
    this.stats.activeConnections = 0;

    logger.info("WebSocket service shutdown complete");
  }
}

const websocketService = new WebSocketService();

module.exports = {
  setupWebSocket: (server) => websocketService.setup(server),
};
