# Chat Debugging Guide

This guide will help you troubleshoot issues with the Twitch chat integration.

## Common Issues and Solutions

### 1. "Authentication required" Error with curl

**Problem**: When using curl to test the chat endpoints, you get "Authentication required" even though you authenticated in your browser.

**Solution**: The curl command doesn't include the session cookie from your browser. You have two options:

#### Option A: Use browser developer console

Open your browser's developer console (F12) and run:

```javascript
// Check session status
fetch("/api/test/session")
  .then((response) => response.json())
  .then((data) => console.log(data));

// Connect to chat
fetch("/api/chat/connect", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    connectionType: "broadcaster",
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

#### Option B: Extract and use session cookie

1. After authenticating, open browser developer tools
2. Go to Application/Storage → Cookies → http://localhost:3001
3. Copy the `connect.sid` cookie value
4. Use it with curl:

```bash
curl -X POST http://localhost:3001/api/chat/connect \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_id_here" \
  -d '{"connectionType": "broadcaster"}'
```

### 2. No chat messages appearing

**Problem**: You've connected to chat but don't see any messages when people type in your channel.

**Debugging Steps**:

1. **Check session and tokens**:

```bash
curl http://localhost:3001/api/test/session
```

Or in browser console:

```javascript
fetch("/api/test/session")
  .then((response) => response.json())
  .then((data) => console.log(data));
```

Look for:

- `isAuthenticated: true`
- `areTokensValid: true`
- `tokens.scopes` includes `chat:read` and `chat:edit`

2. **Check chat connection status**:

```bash
curl http://localhost:3001/api/test/chat
```

Or in browser console:

```javascript
fetch("/api/test/chat")
  .then((response) => response.json())
  .then((data) => console.log(data));
```

3. **Check WebSocket connection**:
   Open browser console and connect to WebSocket:

```javascript
const ws = new WebSocket("ws://localhost:3001");
ws.onopen = () => console.log("WebSocket connected");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("WebSocket message:", data);
};
```

4. **Verify channel name**:
   Make sure you're connecting to the correct channel. Check your `.env` file:

```env
TWITCH_CHANNEL_NAME=your_exact_channel_name
```

If not set, it will use your authenticated username.

### 3. "[object Object]" in logs

**Problem**: You see `[object Object]` in the console logs instead of meaningful information.

**Solution**: This has been fixed in the latest code. The logging now properly handles object serialization.

### 4. Token expiration

**Problem**: Chat was working but suddenly stopped.

**Solution**: Tokens expire after 1 hour. You need to re-authenticate:

1. Visit `http://localhost:3001/api/twitch/auth`
2. Complete the OAuth flow
3. Try connecting to chat again

## Testing Flow

Follow these steps to test the chat functionality:

### 1. Start the server

```bash
npm start
```

### 2. Authenticate with Twitch

Visit: `http://localhost:3001/api/twitch/auth`

### 3. Check session status

In browser console:

```javascript
fetch("/api/test/session")
  .then((response) => response.json())
  .then((data) => console.log(data));
```

You should see something like:

```json
{
  "sessionId": "your_session_id",
  "isAuthenticated": true,
  "user": {
    "id": "87201773",
    "username": "ketchupadmirer",
    "displayName": "KetchupAdmirer"
  },
  "tokens": {
    "user": {
      "id": "87201773",
      "username": "ketchupadmirer",
      "displayName": "KetchupAdmirer"
    },
    "scopes": ["user:read:email", "chat:read", "chat:edit"],
    "expiresAt": "2025-10-13T12:42:23.782Z",
    "tokenType": "bearer"
  },
  "areTokensValid": true
}
```

### 4. Connect to chat

```javascript
fetch("/api/chat/connect", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    connectionType: "broadcaster",
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

### 5. Connect WebSocket

```javascript
const ws = new WebSocket("ws://localhost:3001");
ws.onopen = () => console.log("WebSocket connected");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("WebSocket message:", data);
};
```

### 6. Test with a message

Have someone type in your Twitch channel, or send a test message:

```javascript
fetch("/api/chat/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "Test message from overlay!",
    channel: "your_channel_name",
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

## Expected Logs

When everything is working, you should see logs like:

```
info: 🔗 Chat connect request received { userId: '87201773', connectionType: 'broadcaster' }
info: 🎯 Chat connection established - ready to receive and send messages
info: 🟢 Chat client connected successfully
info: 📡 Chat connection status broadcasted to 1 WebSocket clients
```

When someone types in chat:

```
info: 📨 New chat message received {
  id: 'msg123',
  channel: 'yourchannel',
  user: { username: 'viewer', displayName: 'Viewer', color: '#FF0000' },
  message: 'Hello, streamer!',
  timestamp: '2023-10-13T11:00:00.000Z'
}
info: 📡 Chat message broadcasted to 1 WebSocket clients
```

## Getting Help

If you're still having issues:

1. Check the server logs for any error messages
2. Verify your Twitch application settings:
   - Redirect URI matches `http://localhost:3001/api/twitch/auth/callback`
   - OAuth scopes include `chat:read` and `chat:edit`
3. Make sure your channel name is correct (lowercase, no spaces)
4. Try restarting the server after making configuration changes
