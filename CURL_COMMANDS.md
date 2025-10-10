# OBS Backend API - Curl Commands Reference

## Quick Setup

1. Start the backend server:

   ```bash
   npm run dev
   ```

2. Open a WebSocket connection in another terminal:
   ```bash
   wscat -c ws://localhost:3001
   ```

## API Endpoints

### 1. Health Check

```bash
curl -X GET http://localhost:3001/api/health
```

### 2. OBS Connection Status

```bash
curl -X GET http://localhost:3001/api/obs/status
```

### 3. Connect to OBS (Mock Mode)

```bash
curl -X POST http://localhost:3001/api/obs/connect \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 4. Connect to OBS (Real Mode - requires credentials)

```bash
curl -X POST http://localhost:3001/api/obs/connect \
  -H "Content-Type: application/json" \
  -d '{"host": "ws://127.0.0.1:4456", "password": "your_password"}'
```

### 5. Get All Scenes

```bash
curl -X GET http://localhost:3001/api/obs/scenes
```

### 6. Get Current Scene

```bash
curl -X GET http://localhost:3001/api/obs/scene/current
```

### 7. Change Scene - Live

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Live"}'
```

### 8. Change Scene - BRB

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "BRB"}'
```

### 9. Change Scene - Pause

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Pause"}'
```

## Testing Sequence

### Complete Test Workflow

```bash
# 1. Check server health
curl -X GET http://localhost:3001/api/health

# 2. Check OBS status
curl -X GET http://localhost:3001/api/obs/status

# 3. Connect to OBS (mock mode)
curl -X POST http://localhost:3001/api/obs/connect \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Get all available scenes
curl -X GET http://localhost:3001/api/obs/scenes

# 5. Change to Live scene
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Live"}'

# 6. Check current scene
curl -X GET http://localhost:3001/api/obs/scene/current

# 7. Change to BRB scene
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "BRB"}'

# 8. Change to Pause scene
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Pause"}'
```

## Error Testing

### Test Invalid Scene Name

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "InvalidScene"}'
```

### Test Missing Scene Name

```bash
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test Without Connection

```bash
# First disconnect if connected
# Then try to change scene
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Live"}'
```

## WebSocket Testing

### Connect with wscat

```bash
wscat -c ws://localhost:3001
```

### Expected WebSocket Messages

1. **On Connection**:

   ```json
   {
     "type": "connectionStatus",
     "data": {
       "connected": true,
       "mockMode": true
     }
   }
   ```

2. **On Scene Change to Live**:

   ```json
   {
     "type": "sceneChanged",
     "data": {
       "sceneName": "Live",
       "previousSceneName": "BRB",
       "timestamp": "2024-01-01T12:00:00.000Z"
     }
   }
   ```

3. **On Scene Change to BRB**:

   ```json
   {
     "type": "sceneChanged",
     "data": {
       "sceneName": "BRB",
       "previousSceneName": "Live",
       "timestamp": "2024-01-01T12:00:00.000Z"
     }
   }
   ```

4. **On Scene Change to Pause**:
   ```json
   {
     "type": "sceneChanged",
     "data": {
       "sceneName": "Pause",
       "previousSceneName": "BRB",
       "timestamp": "2024-01-01T12:00:00.000Z"
     }
   }
   ```

## Batch Testing Script

Create a test script `test_api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "=== OBS Backend API Test ==="
echo

# Health check
echo "1. Health Check:"
curl -s -X GET $BASE_URL/health | jq .
echo

# OBS Status
echo "2. OBS Status:"
curl -s -X GET $BASE_URL/obs/status | jq .
echo

# Connect to OBS
echo "3. Connect to OBS:"
curl -s -X POST $BASE_URL/obs/connect \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
echo

# Get scenes
echo "4. Get All Scenes:"
curl -s -X GET $BASE_URL/obs/scenes | jq .
echo

# Test scene changes
echo "5. Change to Live Scene:"
curl -s -X POST $BASE_URL/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Live"}' | jq .
echo

echo "6. Get Current Scene:"
curl -s -X GET $BASE_URL/obs/scene/current | jq .
echo

echo "7. Change to BRB Scene:"
curl -s -X POST $BASE_URL/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "BRB"}' | jq .
echo

echo "8. Change to Pause Scene:"
curl -s -X POST $BASE_URL/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Pause"}' | jq .
echo

echo "=== Test Complete ==="
```

Make it executable:

```bash
chmod +x test_api.sh
./test_api.sh
```

## Tips

1. **Install jq** for pretty JSON output:

   - macOS: `brew install jq`
   - Ubuntu: `sudo apt-get install jq`
   - Windows: Download from https://stedolan.github.io/jq/download/

2. **Use -v flag** with curl for verbose output:

   ```bash
   curl -v -X GET http://localhost:3001/api/health
   ```

3. **Save responses** to files:

   ```bash
   curl -X GET http://localhost:3001/api/health > response.json
   ```

4. **Test with different data formats**:
   ```bash
   # Test with form data
   curl -X POST http://localhost:3001/api/obs/scene/change \
     -d "sceneName=Live" \
     -H "Content-Type: application/x-www-form-urlencoded"
   ```

## Troubleshooting

1. **Connection refused**: Ensure the server is running on port 3001
2. **CORS errors**: Check that your frontend URL is in the CORS origins
3. **Invalid JSON**: Use a JSON validator to check your request body
4. **WebSocket issues**: Check that the server is running and the port is correct
