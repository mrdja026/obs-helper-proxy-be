# Frontend Integration Guide

## Overview

This guide explains how to integrate your Expo frontend with the OBS Backend Proxy to receive real-time scene change events and display the appropriate components.

## Architecture

```
┌─────────────────┐    WebSocket    ┌─────────────────┐    HTTP/WS    ┌──────────────┐
│   Expo Frontend │ ◄──────────────► │  Backend Proxy  │ ◄─────────────► │  OBS Studio  │
│                 │                  │                 │                │              │
│ - Live.tsx      │                  │ - REST API      │                │ - Live Scene │
│ - BeRightBack.tsx │                │ - WebSocket     │                │ - BRB Scene  │
│ - Pause.tsx     │                  │ - Event Broadcasting │          │ - Pause Scene│
└─────────────────┘                  └─────────────────┘                └──────────────┘
```

## WebSocket Connection

### 1. WebSocket Service for Frontend

Create a WebSocket service in your Expo app:

```javascript
// services/websocketService.js
import { EventEmitter } from "events";

class WebSocketService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.isConnecting = false;
  }

  connect(url = "ws://localhost:3001") {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.isConnecting = false;
        this.emit("disconnected");
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.isConnecting = false;
        this.emit("error", error);
      };
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case "connectionStatus":
        this.emit("connectionStatus", message.data);
        break;
      case "sceneChanged":
        this.emit("sceneChanged", message.data);
        break;
      case "obsConnectionStatus":
        this.emit("obsConnectionStatus", message.data);
        break;
      case "obsError":
        this.emit("obsError", message.data);
        break;
      default:
        console.log("Unknown message type:", message.type);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );

      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error("Max reconnection attempts reached");
      this.emit("maxReconnectAttemptsReached");
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
```

### 2. Scene Manager

Create a scene manager to handle scene state:

```javascript
// services/sceneManager.js
import { EventEmitter } from "events";
import websocketService from "./websocketService";

class SceneManager extends EventEmitter {
  constructor() {
    super();
    this.currentScene = null;
    this.previousScene = null;
    this.isConnected = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    websocketService.on("sceneChanged", (data) => {
      this.previousScene = this.currentScene;
      this.currentScene = data.sceneName;
      console.log(
        `Scene changed from ${this.previousScene} to ${this.currentScene}`
      );
      this.emit("sceneChanged", {
        current: this.currentScene,
        previous: this.previousScene,
        timestamp: data.timestamp,
      });
    });

    websocketService.on("connectionStatus", (data) => {
      this.isConnected = data.connected;
      this.emit("connectionStatus", data);
    });

    websocketService.on("obsConnectionStatus", (data) => {
      this.emit("obsConnectionStatus", data);
    });

    websocketService.on("error", (error) => {
      this.emit("error", error);
    });
  }

  getCurrentScene() {
    return this.currentScene;
  }

  getPreviousScene() {
    return this.previousScene;
  }

  isWebSocketConnected() {
    return this.isConnected;
  }

  connect() {
    websocketService.connect();
  }

  disconnect() {
    websocketService.disconnect();
  }
}

export default new SceneManager();
```

### 3. React Hook for Scene Management

Create a custom hook for React components:

```javascript
// hooks/useSceneManager.js
import { useState, useEffect } from "react";
import sceneManager from "../services/sceneManager";

export const useSceneManager = () => {
  const [currentScene, setCurrentScene] = useState(null);
  const [previousScene, setPreviousScene] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [obsConnected, setObsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Set up event listeners
    const handleSceneChanged = (data) => {
      setCurrentScene(data.current);
      setPreviousScene(data.previous);
    };

    const handleConnectionStatus = (data) => {
      setIsConnected(data.connected);
    };

    const handleObsConnectionStatus = (data) => {
      setObsConnected(data.connected);
    };

    const handleError = (error) => {
      setError(error);
    };

    sceneManager.on("sceneChanged", handleSceneChanged);
    sceneManager.on("connectionStatus", handleConnectionStatus);
    sceneManager.on("obsConnectionStatus", handleObsConnectionStatus);
    sceneManager.on("error", handleError);

    // Connect to WebSocket
    sceneManager.connect();

    // Cleanup
    return () => {
      sceneManager.off("sceneChanged", handleSceneChanged);
      sceneManager.off("connectionStatus", handleConnectionStatus);
      sceneManager.off("obsConnectionStatus", handleObsConnectionStatus);
      sceneManager.off("error", handleError);
    };
  }, []);

  return {
    currentScene,
    previousScene,
    isConnected,
    obsConnected,
    error,
  };
};
```

### 4. Main App Component

Update your main App.tsx to handle scene changes:

```typescript
// App.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSceneManager } from "./hooks/useSceneManager";
import Live from "./client/App"; // Your Live component
import BeRightBack from "./client/pages/BeRightBack";
import Pause from "./client/pages/Pause";

const App: React.FC = () => {
  const { currentScene, isConnected, obsConnected, error } = useSceneManager();

  const renderCurrentScene = () => {
    switch (currentScene) {
      case "Live":
        return <Live />;
      case "BRB":
        return <BeRightBack />;
      case "Pause":
        return <Pause />;
      default:
        return (
          <View style={styles.defaultScene}>
            <Text style={styles.defaultText}>No active scene</Text>
            <Text style={styles.subText}>
              Current scene: {currentScene || "None"}
            </Text>
          </View>
        );
    }
  };

  const renderConnectionStatus = () => {
    if (!isConnected) {
      return (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>🔴 Disconnected from backend</Text>
        </View>
      );
    }

    if (!obsConnected) {
      return (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            🟡 Backend connected, OBS not connected
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>🟢 All systems connected</Text>
      </View>
    );
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Connection Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderConnectionStatus()}
      {renderCurrentScene()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  statusBar: {
    backgroundColor: "#333",
    padding: 8,
    alignItems: "center",
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
  },
  defaultScene: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  defaultText: {
    color: "#fff",
    fontSize: 24,
    marginBottom: 10,
  },
  subText: {
    color: "#888",
    fontSize: 16,
  },
  errorText: {
    color: "#ff4444",
    fontSize: 18,
    textAlign: "center",
    marginTop: 50,
  },
});

export default App;
```

## Testing the Integration

### 1. Start the Backend

```bash
# In backend directory
npm run dev
```

### 2. Start Your Expo App

```bash
# In frontend directory
npm start
# or
expo start
```

### 3. Test Scene Changes

Use the curl commands from `CURL_COMMANDS.md`:

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

### 4. Verify Frontend Updates

Your Expo app should:

- Display the connection status at the top
- Show the appropriate component based on the current scene
- Update immediately when scenes change
- Handle connection errors gracefully

## Alignment Instructions

### 1. WebSocket URL Configuration

Make sure your WebSocket URL matches your backend configuration:

```javascript
// In development
const wsUrl = "ws://localhost:3001";

// In production (update with your server IP)
const wsUrl = "ws://192.168.0.234:3001";
```

### 2. Scene Name Consistency

Ensure scene names match exactly between:

- Backend mock/real OBS scenes
- Frontend scene names in the switch statement
- Curl command scene names

### 3. Error Handling

Implement proper error handling for:

- WebSocket connection failures
- Backend server unavailability
- OBS connection issues
- Invalid scene names

### 4. Performance Considerations

- Debounce rapid scene changes if needed
- Implement loading states during transitions
- Cache scene data to reduce re-renders
- Use React.memo for scene components

## Troubleshooting

### Common Issues

1. **WebSocket Connection Fails**:

   - Check if backend is running on correct port
   - Verify firewall settings
   - Ensure correct WebSocket URL

2. **Scene Changes Not Detected**:

   - Check WebSocket messages in browser console
   - Verify scene names match exactly
   - Check event listener setup

3. **Component Not Updating**:

   - Verify React hook is properly set up
   - Check state updates in useEffect
   - Ensure components are exported correctly

4. **Connection Status Issues**:
   - Check backend connection status endpoint
   - Verify WebSocket message handling
   - Check error event listeners

### Debug Tools

1. **Browser DevTools**:

   - Network tab for WebSocket connections
   - Console for logging
   - React DevTools for component state

2. **WebSocket Testing**:

   ```bash
   # Test WebSocket directly
   wscat -c ws://localhost:3001
   ```

3. **Backend Logs**:
   - Check backend console for errors
   - Verify WebSocket connection logs
   - Monitor scene change events

## Production Considerations

1. **Security**:

   - Use WSS (WebSocket Secure) in production
   - Implement authentication if needed
   - Validate incoming messages

2. **Performance**:

   - Implement connection pooling
   - Add heartbeat/ping-pong mechanism
   - Optimize reconnection strategy

3. **Reliability**:

   - Add offline support
   - Implement local caching
   - Add retry mechanisms

4. **Monitoring**:
   - Track connection metrics
   - Monitor scene change frequency
   - Log errors for debugging
