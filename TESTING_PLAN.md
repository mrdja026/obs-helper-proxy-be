# OBS Backend Testing Plan

## Overview

This document outlines a comprehensive testing plan for the OBS Backend Proxy API, focusing on testing scene changes without requiring an actual OBS Studio connection. The plan includes curl commands to test all API endpoints and WebSocket functionality.

## Prerequisites

1. Node.js installed (v16 or higher)
2. Backend dependencies installed (`npm install`)
3. A WebSocket client tool (like `wscat` or a browser WebSocket client)
4. curl installed (usually comes with most operating systems)

## Backend Architecture Summary

The backend has the following key components:

1. **REST API Endpoints** (port 3001):

   - `/api/obs/connect` - Connect to OBS
   - `/api/obs/scenes` - List all scenes
   - `/api/obs/scene/current` - Get current scene
   - `/api/obs/scene/change` - Change scene
   - `/api/obs/status` - Get connection status

2. **WebSocket Server** (same port):

   - Broadcasts scene change events to connected clients
   - Handles connection status updates
   - Error broadcasting

3. **Scene Management**:
   - Three scenes to test: "Live", "BRB", "Pause"
   - Scene changes trigger WebSocket events

## Testing Strategy

### Phase 1: Basic API Testing

#### 1.1 Start the Backend Server

```bash
# Navigate to the backend directory
cd backend_proxy_obs_helper

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The server should start on port 3001 (as configured in .env).

#### 1.2 Test Server Health

```bash
curl -X GET http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123.456
}
```

#### 1.3 Test OBS Connection Status

```bash
curl -X GET http://localhost:3001/api/obs/status
```

Expected response (when not connected):

```json
{
  "connected": false,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Phase 2: Scene Management Testing

#### 2.1 Mock OBS Connection

Since we're testing without OBS, we need to modify the obsConnection.js to allow testing without a real connection. We'll create a test mode that simulates scene changes.

#### 2.2 Test Scene Change API

The following curl commands will test scene changes:

**Change to "Live" scene:**

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Live"}'
```

**Change to "BRB" scene:**

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "BRB"}'
```

**Change to "Pause" scene:**

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Pause"}'
```

Expected response for successful scene change:

```json
{
  "status": "success",
  "message": "Changed to scene: Live",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### 2.3 Test Get Current Scene

```bash
curl -X GET http://localhost:3001/api/obs/scene/current
```

Expected response:

```json
{
  "sceneName": "Live",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### 2.4 Test Get All Scenes

```bash
curl -X GET http://localhost:3001/api/obs/scenes
```

Expected response:

```json
{
  "scenes": [
    {
      "sceneName": "Live",
      "sceneIndex": 0
    },
    {
      "sceneName": "BRB",
      "sceneIndex": 1
    },
    {
      "sceneName": "Pause",
      "sceneIndex": 2
    }
  ]
}
```

### Phase 3: WebSocket Testing

#### 3.1 Connect to WebSocket

Using `wscat` (install with `npm install -g wscat`):

```bash
wscat -c ws://localhost:3001
```

Or use a browser WebSocket client with the URL: `ws://localhost:3001`

#### 3.2 Expected WebSocket Messages

When you connect, you should receive:

```json
{
  "type": "connectionStatus",
  "data": {
    "connected": false
  }
}
```

When you change scenes via the API, you should receive:

```json
{
  "type": "sceneChanged",
  "data": {
    "sceneName": "Live",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Phase 4: Error Handling Testing

#### 4.1 Test Invalid Scene Name

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "InvalidScene"}'
```

Expected response (when connected to OBS):

```json
{
  "error": "Failed to change scene: Scene not found"
}
```

#### 4.2 Test Missing Scene Name

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:

```json
{
  "error": "Scene name is required"
}
```

#### 4.3 Test Without OBS Connection

When not connected to OBS, scene change requests should return:

```json
{
  "error": "Not connected to OBS. Please connect first."
}
```

## Testing Workflow

### Complete Testing Sequence

1. **Start the backend server**

   ```bash
   npm run dev
   ```

2. **Open a WebSocket connection** (in a separate terminal)

   ```bash
   wscat -c ws://localhost:3001
   ```

3. **Test the sequence of scene changes**:

   ```bash
   # Change to Live
   curl -X POST http://localhost:3001/api/obs/scene/change \
     -H "Content-Type: application/json" \
     -d '{"sceneName": "Live"}'

   # Wait for WebSocket message, then change to BRB
   curl -X POST http://localhost:3001/api/obs/scene/change \
     -H "Content-Type: application/json" \
     -d '{"sceneName": "BRB"}'

   # Wait for WebSocket message, then change to Pause
   curl -X POST http://localhost:3001/api/obs/scene/change \
     -H "Content-Type: application/json" \
     -d '{"sceneName": "Pause"}'
   ```

4. **Verify current scene**:

   ```bash
   curl -X GET http://localhost:3001/api/obs/scene/current
   ```

5. **Check all available scenes**:
   ```bash
   curl -X GET http://localhost:3001/api/obs/scenes
   ```

## Frontend Integration Testing

### Testing with Frontend

1. **Start your frontend application** (Expo app)
2. **Ensure it's configured to connect to** `ws://localhost:3001`
3. **Test scene changes** using the curl commands above
4. **Verify the frontend UI updates** when receiving WebSocket events

### Expected Frontend Behavior

- When scene changes to "Live", the Live component should be displayed
- When scene changes to "BRB", the BeRightBack component should be displayed
- When scene changes to "Pause", the Pause component should be displayed

## Mock Mode Implementation

To test without OBS Studio, you may need to implement a mock mode in the obsConnection.js service. This would involve:

1. Adding a `mockMode` flag to the OBSConnectionManager
2. Modifying the `changeScene` method to work without OBS connection
3. Simulating scene list and current scene responses

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the PORT in .env file
2. **CORS errors**: Ensure your frontend URL is in the CORS origins list in config.js
3. **WebSocket connection fails**: Check if the server is running and the port is correct
4. **Scene changes not working**: Verify the scene names match exactly with OBS scenes

### Debug Mode

Enable debug logging by setting the LOG_LEVEL environment variable:

```bash
LOG_LEVEL=debug npm run dev
```

## Next Steps

1. Implement the mock mode for testing without OBS
2. Create automated test scripts
3. Add integration tests with the frontend
4. Performance testing with multiple WebSocket clients
