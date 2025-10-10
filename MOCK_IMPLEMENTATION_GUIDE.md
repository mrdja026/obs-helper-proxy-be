# Mock Mode Implementation Guide

## Overview

This guide provides instructions for implementing a mock mode in the OBS Backend Proxy to enable testing without requiring an actual OBS Studio connection.

## Implementation Steps

### 1. Create Mock OBS Connection Service

Create a new file `src/services/obsConnectionMock.js` with the following content:

```javascript
const logger = require("../utils/logger");
const { OBSConnectionError } = require("../utils/errors");

class MockOBSConnectionManager {
  constructor() {
    this.connected = false;
    this.mockScenes = [
      { sceneName: "Live", sceneIndex: 0 },
      { sceneName: "BRB", sceneIndex: 1 },
      { sceneName: "Pause", sceneIndex: 2 },
    ];
    this.currentSceneIndex = 0;
    this.eventHandlers = new Map();
  }

  async connect(host = "mock://localhost:4456", password = "mock_password") {
    try {
      if (this.connected) {
        return {
          status: "already_connected",
          message: "Already connected to OBS (Mock)",
        };
      }

      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.connected = true;
      logger.info("Successfully connected to OBS (Mock Mode)");

      return {
        status: "connected",
        message: "Successfully connected to OBS (Mock Mode)",
        version: {
          version: "30.0.0",
          obsVersion: "30.0.0",
          obsWebSocketVersion: "5.0.0",
          platform: "mock",
          platformDescription: "Mock platform for testing",
        },
      };
    } catch (error) {
      logger.error("Failed to connect to OBS (Mock):", error);
      throw new OBSConnectionError(
        `Failed to connect to OBS (Mock): ${error.message}`
      );
    }
  }

  async disconnect() {
    try {
      if (!this.connected) {
        return { status: "not_connected", message: "Not connected to OBS" };
      }

      this.connected = false;
      logger.info("Successfully disconnected from OBS (Mock Mode)");

      return {
        status: "disconnected",
        message: "Successfully disconnected from OBS (Mock Mode)",
      };
    } catch (error) {
      logger.error("Error disconnecting from OBS (Mock):", error);
      throw new OBSConnectionError(
        `Error disconnecting from OBS (Mock): ${error.message}`
      );
    }
  }

  // Event handling methods
  addEventHandler(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  removeEventHandler(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }
  }

  notifyEventHandlers(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // OBS operation methods
  async getScenes() {
    try {
      return this.mockScenes;
    } catch (error) {
      logger.error("Error getting scenes (Mock):", error);
      throw new OBSConnectionError(
        `Failed to get scenes (Mock): ${error.message}`
      );
    }
  }

  async getCurrentScene() {
    try {
      const currentScene = this.mockScenes[this.currentSceneIndex];
      return {
        sceneName: currentScene.sceneName,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error getting current scene (Mock):", error);
      throw new OBSConnectionError(
        `Failed to get current scene (Mock): ${error.message}`
      );
    }
  }

  async changeScene(sceneName) {
    try {
      // Find the scene index
      const sceneIndex = this.mockScenes.findIndex(
        (scene) => scene.sceneName === sceneName
      );

      if (sceneIndex === -1) {
        throw new OBSConnectionError(`Scene '${sceneName}' not found`);
      }

      const previousSceneIndex = this.currentSceneIndex;
      this.currentSceneIndex = sceneIndex;

      // Simulate scene change delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Notify event handlers about the scene change
      this.notifyEventHandlers("sceneChanged", {
        sceneName: sceneName,
        previousSceneName: this.mockScenes[previousSceneIndex].sceneName,
      });

      logger.info(`Scene changed to: ${sceneName} (Mock)`);

      return {
        status: "success",
        message: `Changed to scene: ${sceneName}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error changing scene (Mock):", error);
      throw new OBSConnectionError(
        `Failed to change scene (Mock): ${error.message}`
      );
    }
  }

  isConnected() {
    return this.connected;
  }
}

// Create a singleton instance
const mockObsConnection = new MockOBSConnectionManager();

module.exports = mockObsConnection;
```

### 2. Update Configuration

Add a mock mode flag to `src/config/config.js`:

```javascript
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  mockMode: process.env.MOCK_MODE === "true" || false, // Add this line
  obs: {
    host: process.env.OBS_WS_HOST || "ws://127.0.0.1:4456",
    password: process.env.OBS_WS_PASSWORD,
  },
  cors: {
    origin: [
      "http://localhost:8081",
      "http://192.168.0.234:8081",
      "exp://192.168.0.234:8081",
    ],
    methods: ["GET", "POST"],
  },
};
```

### 3. Update OBS Routes

Modify `src/routes/obs.js` to use the mock connection when in mock mode:

```javascript
const express = require("express");
const router = express.Router();
const config = require("../config/config");

// Conditionally require the appropriate connection service
const obsConnection = config.mockMode
  ? require("../services/obsConnectionMock")
  : require("../services/obsConnection");

const { ValidationError, OBSConnectionError } = require("../utils/errors");
const logger = require("../utils/logger");

// Middleware to check OBS connection
const checkOBSConnection = (req, res, next) => {
  if (!obsConnection.isConnected()) {
    return next(
      new OBSConnectionError("Not connected to OBS. Please connect first.")
    );
  }
  next();
};

// Connect to OBS
router.post("/connect", async (req, res, next) => {
  try {
    const { host, password } = req.body;

    // For mock mode, use default values if not provided
    const connectHost = config.mockMode ? undefined : host || config.obs.host;
    const connectPassword = config.mockMode
      ? undefined
      : password || config.obs.password;

    if (!config.mockMode && (!host || !password)) {
      throw new ValidationError("Host and password are required");
    }

    const result = await obsConnection.connect(connectHost, connectPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get all scenes
router.get("/scenes", checkOBSConnection, async (req, res, next) => {
  try {
    const scenes = await obsConnection.getScenes();
    res.json({ scenes });
  } catch (error) {
    next(error);
  }
});

// Get current scene
router.get("/scene/current", checkOBSConnection, async (req, res, next) => {
  try {
    const currentScene = await obsConnection.getCurrentScene();
    res.json(currentScene);
  } catch (error) {
    next(error);
  }
});

// Change scene
router.post("/scene/change", checkOBSConnection, async (req, res, next) => {
  try {
    const { sceneName } = req.body;

    if (!sceneName) {
      throw new ValidationError("Scene name is required");
    }

    const result = await obsConnection.changeScene(sceneName);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get connection status
router.get("/status", (req, res) => {
  res.json({
    connected: obsConnection.isConnected(),
    mockMode: config.mockMode,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
```

### 4. Update WebSocket Service

Modify `src/services/websocket.js` to work with both real and mock connections:

```javascript
const WebSocket = require("ws");
const logger = require("../utils/logger");
const config = require("../config/config");

// Conditionally require the appropriate connection service
const obsConnection = config.mockMode
  ? require("./obsConnectionMock")
  : require("./obsConnection");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  setup(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws) => {
      this.handleConnection(ws);
    });

    // Set up OBS event handlers
    this.setupOBSEventHandlers();

    logger.info(
      `WebSocket server is running in ${
        config.mockMode ? "Mock" : "Normal"
      } mode`
    );
  }

  handleConnection(ws) {
    this.clients.add(ws);
    logger.info(
      `New WebSocket client connected. Total clients: ${this.clients.size}`
    );

    // Send initial connection status
    this.sendToClient(ws, {
      type: "connectionStatus",
      data: {
        connected: obsConnection.isConnected(),
        mockMode: config.mockMode,
      },
    });

    ws.on("close", () => {
      this.clients.delete(ws);
      logger.info(
        `WebSocket client disconnected. Total clients: ${this.clients.size}`
      );
    });

    ws.on("error", (error) => {
      logger.error("WebSocket client error:", error);
      this.clients.delete(ws);
    });
  }

  setupOBSEventHandlers() {
    // Handle scene changes
    obsConnection.addEventHandler("sceneChanged", (data) => {
      this.broadcast({
        type: "sceneChanged",
        data: {
          sceneName: data.sceneName,
          previousSceneName: data.previousSceneName,
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Handle connection status changes
    obsConnection.addEventHandler("connectionStatus", (data) => {
      this.broadcast({
        type: "obsConnectionStatus",
        data: {
          connected: data.connected,
          mockMode: config.mockMode,
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Handle errors
    obsConnection.addEventHandler("error", (error) => {
      this.broadcast({
        type: "obsError",
        data: {
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  broadcast(message) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  sendToClient(client, message) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

const websocketService = new WebSocketService();

module.exports = {
  setupWebSocket: (server) => websocketService.setup(server),
};
```

### 5. Update Environment Variables

Add the mock mode flag to your `.env` file:

```bash
PORT=3001
OBS_WS_HOST=ws://127.0.0.1:4456
OBS_WS_PASSWORD=smederevo026
MOCK_MODE=true
```

## Testing with Mock Mode

### Start the Server in Mock Mode

```bash
# Ensure MOCK_MODE=true in your .env file
npm run dev
```

### Test the Mock Connection

1. **Connect to Mock OBS**:

   ```bash
   curl -X POST http://localhost:3001/api/obs/connect \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

2. **Check Connection Status**:

   ```bash
   curl -X GET http://localhost:3001/api/obs/status
   ```

3. **Test Scene Changes**:

   ```bash
   # Change to Live scene
   curl -X POST http://localhost:3001/api/obs/scene/change \
     -H "Content-Type: application/json" \
     -d '{"sceneName": "Live"}'

   # Change to BRB scene
   curl -X POST http://localhost:3001/api/obs/scene/change \
     -H "Content-Type: application/json" \
     -d '{"sceneName": "BRB"}'

   # Change to Pause scene
   curl -X POST http://localhost:3001/api/obs/scene/change \
     -H "Content-Type: application/json" \
     -d '{"sceneName": "Pause"}'
   ```

4. **Test WebSocket Events**:

   ```bash
   # Connect with wscat
   wscat -c ws://localhost:3001

   # You should see scene change events when you execute the curl commands above
   ```

## Switching Between Mock and Real Mode

### To Use Mock Mode:

1. Set `MOCK_MODE=true` in `.env`
2. Restart the server
3. No OBS Studio required

### To Use Real OBS:

1. Set `MOCK_MODE=false` or remove the line from `.env`
2. Ensure OBS Studio is running with WebSocket server enabled
3. Restart the server
4. Connect with actual OBS credentials

## Benefits of Mock Mode

1. **No OBS Dependency**: Test without running OBS Studio
2. **Faster Testing**: No connection delays
3. **CI/CD Friendly**: Can be used in automated testing
4. **Consistent Behavior**: Predictable responses for testing
5. **Frontend Development**: Frontend can be developed independently

## Limitations

1. **No Real OBS Features**: Only simulates basic scene operations
2. **No Audio/Video**: Doesn't handle actual media
3. **Limited Events**: Only implements scene change events
4. **Static Scene List**: Scenes are hardcoded in the mock

## Extending the Mock

To add more features to the mock mode:

1. **Add more scenes** to the `mockScenes` array
2. **Implement additional OBS methods** in the mock service
3. **Add more event types** for comprehensive testing
4. **Simulate errors** for error handling testing
5. **Add timing delays** to simulate real-world latency
