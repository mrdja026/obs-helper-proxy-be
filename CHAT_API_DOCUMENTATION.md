# Twitch Chat API Documentation

This document describes the API endpoints for integrating Twitch chat functionality into your backend proxy using Twurple (@twurple packages).

## Overview

The chat API allows you to:

- Connect to Twitch chat as a broadcaster or bot using @twurple/chat
- Receive real-time chat messages via WebSocket
- Send messages to chat using @twurple/api
- Manage chat connections
- Handle errors and rate limits

## Authentication

All chat API endpoints require authentication via the Twitch OAuth flow. You must first authenticate with Twitch using the `/api/twitch/auth` endpoint to obtain the necessary tokens with `chat:read` and `chat:edit` scopes.

## Configuration

The chat functionality can be configured using the following environment variables:

| Variable                         | Description                                                       | Default                             |
| -------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `TWITCH_CHAT_TYPE`               | Connection type: "broadcaster" or "bot"                           | "broadcaster"                       |
| `TWITCH_CHANNEL_NAME`            | Channel name to connect to (if different from authenticated user) | (uses authenticated user's channel) |
| `TWITCH_BOT_USERNAME`            | Bot username (when using bot connection type)                     | (required for bot type)             |
| `TWITCH_BOT_OAUTH_TOKEN`         | Bot OAuth token (when using bot connection type)                  | (required for bot type)             |
| `TWITCH_CHAT_RECONNECT_ATTEMPTS` | Maximum reconnection attempts                                     | 5                                   |
| `TWITCH_CHAT_RECONNECT_DELAY`    | Delay between reconnection attempts (ms)                          | 2000                                |
| `TWITCH_CHAT_ENABLE_LOGGING`     | Enable chat logging                                               | true                                |

## API Endpoints

### Connect to Chat

**POST** `/api/chat/connect`

Initialize a connection to Twitch chat.

#### Request Body

```json
{
  "connectionType": "broadcaster" // optional, "broadcaster" or "bot"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "channel": "channel_name",
    "username": "username",
    "connectionType": "broadcaster",
    "status": {
      "connected": true,
      "channel": "channel_name",
      "username": "username",
      "connectionType": "broadcaster",
      "lastConnected": "2023-10-13T11:00:00.000Z",
      "reconnectAttempts": 0
    }
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Invalid or expired tokens. Please authenticate again."
}
```

### Disconnect from Chat

**POST** `/api/chat/disconnect`

Terminate the chat connection.

#### Response

```json
{
  "success": true,
  "message": "Disconnected from chat"
}
```

### Send Message to Chat

**POST** `/api/chat/send`

Send a message to the connected chat channel.

#### Request Body

```json
{
  "message": "Hello, chat!",
  "channel": "channel_name",
  "replyToMessageId": "optional_message_id" // optional
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "messageId": "message_uuid",
    "message": "Hello, chat!",
    "channel": "channel_name",
    "timestamp": "2023-10-13T11:00:00.000Z"
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Invalid message: Message is required and must be a string"
}
```

### Get Chat Connection Status

**GET** `/api/chat/status`

Get the current status of the chat connection.

#### Response

```json
{
  "success": true,
  "data": {
    "connected": true,
    "channel": "channel_name",
    "username": "username",
    "connectionType": "broadcaster",
    "lastConnected": "2023-10-13T11:00:00.000Z",
    "reconnectAttempts": 0
  }
}
```

### Get Token Information

**GET** `/api/chat/tokens`

Get information about the current stored tokens.

#### Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "username",
      "displayName": "Display Name"
    },
    "scopes": ["user:read:email", "chat:read", "chat:edit"],
    "expiresAt": "2023-10-13T12:00:00.000Z",
    "tokenType": "bearer"
  }
}
```

### Refresh Chat Connection

**POST** `/api/chat/refresh`

Disconnect and reconnect to chat.

#### Request Body

```json
{
  "connectionType": "broadcaster" // optional
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "channel": "channel_name",
    "username": "username",
    "connectionType": "broadcaster",
    "status": {
      "connected": true,
      "channel": "channel_name",
      "username": "username",
      "connectionType": "broadcaster",
      "lastConnected": "2023-10-13T11:00:00.000Z",
      "reconnectAttempts": 0
    }
  }
}
```

## WebSocket Events

Chat events are broadcast to connected WebSocket clients. The WebSocket endpoint is the same as your existing WebSocket connection.

### Chat Message Event

**Event Type**: `chatMessage`

Emitted when a new message is received in chat.

#### Event Data

```json
{
  "type": "chatMessage",
  "data": {
    "id": "message_uuid",
    "text": "Hello, world!",
    "channel": "channel_name",
    "user": {
      "id": "user_id",
      "username": "username",
      "displayName": "Display Name",
      "color": "#FF0000",
      "badges": [
        {
          "id": "moderator",
          "version": "1"
        }
      ],
      "isMod": true,
      "isSubscriber": false,
      "isVip": false
    },
    "timestamp": "2023-10-13T11:00:00.000Z",
    "isAction": false,
    "isHighlighted": false,
    "emotes": [
      {
        "id": "emote_id",
        "name": "Kappa",
        "position": 0,
        "start": 7,
        "end": 11
      }
    ]
  }
}
```

### Chat Connection Status Event

**Event Type**: `chatConnectionStatus`

Emitted when the chat connection status changes.

#### Event Data

```json
{
  "type": "chatConnectionStatus",
  "data": {
    "connected": true,
    "channel": "channel_name",
    "username": "username",
    "connectionType": "broadcaster",
    "lastConnected": "2023-10-13T11:00:00.000Z",
    "lastDisconnected": null,
    "reconnectAttempts": 0,
    "error": null
  }
}
```

### Chat Error Event

**Event Type**: `chatError`

Emitted when an error occurs in the chat service.

#### Event Data

```json
{
  "type": "chatError",
  "data": {
    "source": "chat",
    "message": "Failed to connect: Invalid token",
    "timestamp": "2023-10-13T11:00:00.000Z"
  }
}
```

### Chat Sent Message Event

**Event Type**: `chatSentMessage`

Emitted when a message is successfully sent to chat.

#### Event Data

```json
{
  "type": "chatSentMessage",
  "data": {
    "success": true,
    "messageId": "message_uuid",
    "message": "Hello, chat!",
    "channel": "channel_name",
    "timestamp": "2023-10-13T11:00:00.000Z"
  }
}
```

## Error Handling

The API handles various error scenarios:

1. **Authentication Errors**: Returned with 401 status when tokens are invalid or expired
2. **Validation Errors**: Returned with 400 status for invalid request data
3. **Connection Errors**: Returned with 500 status for connection failures
4. **Rate Limiting**: Handled by the underlying Twurple library, errors are broadcast via WebSocket

## Usage Examples

### Connecting to Chat

```javascript
// First, authenticate with Twitch
window.location.href = "/api/twitch/auth";

// After authentication, connect to chat
fetch("/api/chat/connect", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    // Include session cookie automatically
  },
  body: JSON.stringify({
    connectionType: "broadcaster",
  }),
})
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      console.log("Connected to chat:", data.data);
    } else {
      console.error("Connection failed:", data.error);
    }
  });
```

### Sending a Message

```javascript
fetch("/api/chat/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "Hello, chat!",
    channel: "your_channel_name",
  }),
})
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      console.log("Message sent:", data.data);
    } else {
      console.error("Send failed:", data.error);
    }
  });
```

### Listening to Chat Messages via WebSocket

```javascript
const ws = new WebSocket("ws://localhost:3001");

ws.onopen = () => {
  console.log("Connected to WebSocket");
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case "chatMessage":
      console.log("New chat message:", message.data);
      // Display message in your overlay
      break;
    case "chatConnectionStatus":
      console.log("Chat status changed:", message.data);
      break;
    case "chatError":
      console.error("Chat error:", message.data);
      break;
  }
};
```

## Rate Limits

Twitch imposes rate limits on chat messages:

- **Moderators**: 100 messages per 30 seconds
- **Regular users**: 20 messages per 30 seconds

The service will automatically handle rate limiting and emit errors via WebSocket when limits are exceeded.

## Troubleshooting

### Common Issues

1. **"Invalid or expired tokens"**: Re-authenticate with Twitch using `/api/twitch/auth`
2. **"Not connected to chat"**: Ensure you've called `/api/chat/connect` before sending messages
3. **Connection failures**: Check your network connection and Twitch service status
4. **Missing scopes**: Ensure your OAuth flow includes `chat:read` and `chat:edit` scopes

### Debug Mode

Enable debug logging by setting `TWITCH_CHAT_ENABLE_LOGGING=true` in your environment variables. This will provide detailed logs of chat operations.
