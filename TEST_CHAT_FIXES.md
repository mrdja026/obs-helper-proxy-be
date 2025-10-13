# Testing Chat Fixes

This guide will help you test the fixes for the authentication and chat issues.

## What Was Fixed

1. **Token Cache Service**: Created an in-memory cache that stores tokens even when the session isn't available
2. **Dual Authentication**: The system now checks both session and cache for authentication
3. **Logging Issues**: Fixed all `[object Object]` logging with proper stringification
4. **Enhanced Debugging**: Added detailed logging with emojis to easily track chat events

## Testing Steps

### 1. Start the Server

```bash
npm start
```

### 2. Authenticate with Twitch

Visit: `http://localhost:3001/api/twitch/auth`

After authentication, you should see logs like:

```
info: Tokens stored successfully in session and cache {userId: '87201773', username: 'ketchupadmirer'}
```

### 3. Test Session and Cache Status

Open your browser console and run:

```javascript
fetch("/api/test/session")
  .then((response) => response.json())
  .then((data) => console.log(data));
```

You should see:

- `isAuthenticated: true`
- `areTokensValid: true`
- `hasCacheTokens: true`
- `cacheStats` showing valid tokens

### 4. Test Chat Connection with curl (Now Works!)

```bash
curl -X POST http://localhost:3001/api/chat/connect \
  -H "Content-Type: application/json" \
  -d '{"connectionType": "broadcaster"}'
```

You should get a successful response:

```json
{
  "success": true,
  "data": {
    "channel": "ketchupadmirer",
    "username": "ketchupadmirer",
    "connectionType": "broadcaster",
    "status": {
      "connected": true,
      "channel": "ketchupadmirer",
      "username": "ketchupadmirer",
      "connectionType": "broadcaster",
      "lastConnected": "2023-10-13T12:00:00.000Z",
      "reconnectAttempts": 0
    }
  }
}
```

In your server logs, you should see:

```
info: 🔗 Chat connect request received {userId: '87201773', username: 'ketchupadmirer', fromCache: true}
info: Using cached tokens for chat initialization {userId: '87201773', username: 'ketchupadmirer'}
info: 🎯 Chat connection established - ready to receive and send messages
info: 🟢 Connected to Twitch chat {channelName: 'ketchupadmirer', connectedAs: 'ketchupadmirer'}
```

### 5. Test Sending a Message

```bash
curl -X POST http://localhost:3001/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Test message from API!", "channel": "ketchupadmirer"}'
```

You should see:

```json
{
  "success": true,
  "data": {
    "messageId": "message-uuid",
    "message": "Test message from API!",
    "channel": "ketchupadmirer",
    "timestamp": "2023-10-13T12:00:00.000Z"
  }
}
```

And in logs:

```
info: 📤 Chat send message request received {userId: '87201773', username: 'ketchupadmirer', fromCache: true}
info: ✅ Message sent to chat {messageId: 'message-uuid', channel: 'ketchupadmirer'}
```

### 6. Test Receiving Messages

#### Option A: WebSocket in Browser Console

```javascript
const ws = new WebSocket("ws://localhost:3001");
ws.onopen = () => console.log("WebSocket connected");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("WebSocket message:", data);
};
```

#### Option B: Watch Server Logs

Type a message in your Twitch channel. You should see:

```
info: 📨 New chat message received {
  id: 'msg-uuid',
  channel: 'ketchupadmirer',
  user: {
    username: 'viewer',
    displayName: 'Viewer',
    color: '#FF0000',
    isMod: false,
    isSubscriber: false,
    isVip: false
  },
  message: 'Hello, streamer!',
  timestamp: '2023-10-13T12:00:00.000Z'
}
info: 📡 Chat message broadcasted to 1 WebSocket clients
```

### 7. Test Chat Status

```bash
curl http://localhost:3001/api/chat/status
```

### 8. Test Disconnect

```bash
curl -X POST http://localhost:3001/api/chat/disconnect
```

## Expected Log Messages

When everything is working, you'll see these emoji-prefixed logs:

### Connection Flow:

- 🔗 Chat connect request received
- 🎯 Chat connection established
- 🟢 Connected to Twitch chat
- 📡 Chat connection status broadcasted

### Message Flow:

- 📤 Chat send message request received
- ✅ Message sent to chat
- 📨 New chat message received
- 📡 Chat message broadcasted

### Disconnection:

- 🔌 Chat disconnect request received
- 🔌 Disconnected from Twitch chat

### Errors:

- ❌ Failed to initialize/connect/send
- 🔄 Attempting to reconnect
- 🔴 Reconnection failed

## Troubleshooting

### If curl still says "Authentication required":

1. Check if you have valid cached tokens:
   ```javascript
   fetch("/api/test/session")
     .then((r) => r.json())
     .then(console.log);
   ```
2. If no cache tokens, re-authenticate with Twitch

### If no messages are received:

1. Check if chat is connected:
   ```bash
   curl http://localhost:3001/api/chat/status
   ```
2. Verify you're using the correct channel name (lowercase, no spaces)
3. Check if your Twitch application has the correct scopes

### If you see [object Object] in logs:

This should be fixed now, but if you still see it, restart the server to ensure all changes are loaded.

## Key Improvements

1. **curl now works** - You can test API endpoints without browser session
2. **Better logging** - Clear emoji indicators for all events
3. **Token persistence** - Tokens survive even if session expires
4. **Fallback authentication** - System tries cache when session fails
5. **Detailed debugging** - Every step is logged with context

The chat system should now work reliably both in the browser and with API tools like curl!
