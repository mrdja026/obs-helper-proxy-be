# Twitch Chat Integration - Quick Start Guide

This guide will help you quickly set up and use the new Twitch chat functionality in your backend using Twurple (@twurple packages).

## Prerequisites

1. Make sure you have your Twitch Client ID and Client Secret configured in your `.env` file
2. Your Twitch application should have the correct redirect URI configured

## Installation

1. Install the new dependencies:

```bash
npm install
```

2. Update your `.env` file with the chat configuration:

```env
TWITCH_CHAT_TYPE=broadcaster
TWITCH_CHANNEL_NAME=your_channel_name  # Optional, defaults to authenticated user
TWITCH_CHAT_RECONNECT_ATTEMPTS=5
TWITCH_CHAT_RECONNECT_DELAY=2000
TWITCH_CHAT_ENABLE_LOGGING=true
```

## Basic Usage

### 1. Authenticate with Twitch

First, authenticate your application with Twitch to get the necessary tokens:

```javascript
// Redirect user to Twitch for authentication
window.location.href = "/api/twitch/auth";
```

After authentication, you'll be redirected back to your application with the tokens stored in the session.

### 2. Connect to Chat

Once authenticated, connect to the chat:

```javascript
fetch("/api/chat/connect", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    connectionType: "broadcaster", // or 'bot'
  }),
})
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      console.log("Connected to chat:", data.data.channel);
    } else {
      console.error("Connection failed:", data.error);
    }
  });
```

### 3. Set Up WebSocket to Receive Messages

Connect to the WebSocket to receive real-time chat messages:

```javascript
const ws = new WebSocket("ws://localhost:3001");

ws.onopen = () => {
  console.log("Connected to WebSocket");
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case "chatMessage":
      // Display message in your overlay
      displayChatMessage(message.data);
      break;
    case "chatConnectionStatus":
      console.log("Chat status:", message.data.connected);
      break;
    case "chatError":
      console.error("Chat error:", message.data.message);
      break;
  }
};

function displayChatMessage(chatMessage) {
  // Create a chat message element
  const messageElement = document.createElement("div");
  messageElement.innerHTML = `
    <span style="color: ${chatMessage.user.color}">
      ${chatMessage.user.displayName}:
    </span>
    ${chatMessage.text}
  `;

  // Add to your chat display
  document.getElementById("chat-container").appendChild(messageElement);
}
```

### 4. Send Messages to Chat

Send messages from your backend:

```javascript
fetch("/api/chat/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "Hello from my overlay!",
    channel: "your_channel_name",
  }),
})
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      console.log("Message sent:", data.data.messageId);
    } else {
      console.error("Send failed:", data.error);
    }
  });
```

## Example Integration with Frontend

Here's a complete example of how to integrate with a React component:

```jsx
import React, { useState, useEffect } from "react";

const ChatOverlay = () => {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const websocket = new WebSocket("ws://localhost:3001");

    websocket.onopen = () => {
      console.log("WebSocket connected");
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "chatMessage") {
        setMessages((prev) => [...prev, data.data]);
      } else if (data.type === "chatConnectionStatus") {
        setIsConnected(data.data.connected);
      }
    };

    return () => {
      websocket.close();
    };
  }, []);

  const connectToChat = async () => {
    try {
      const response = await fetch("/api/chat/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectionType: "broadcaster",
        }),
      });

      const data = await response.json();
      if (data.success) {
        console.log("Connected to chat");
      }
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const sendMessage = async (text) => {
    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          channel: "your_channel_name",
        }),
      });

      const data = await response.json();
      if (data.success) {
        console.log("Message sent");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div>
      <div>
        <button onClick={connectToChat} disabled={isConnected}>
          {isConnected ? "Connected" : "Connect to Chat"}
        </button>
      </div>

      <div
        style={{ height: "300px", overflowY: "auto", border: "1px solid #ccc" }}
      >
        {messages.map((msg, index) => (
          <div key={index}>
            <span style={{ color: msg.user.color }}>
              {msg.user.displayName}:
            </span>{" "}
            {msg.text}
          </div>
        ))}
      </div>

      <div>
        <input
          type="text"
          placeholder="Type a message..."
          onKeyPress={(e) => {
            if (e.key === "Enter" && e.target.value.trim()) {
              sendMessage(e.target.value);
              e.target.value = "";
            }
          }}
        />
      </div>
    </div>
  );
};

export default ChatOverlay;
```

## Bot Account Setup

To use a bot account instead of the broadcaster account:

1. Create a separate Twitch application for your bot or use the same application
2. Authenticate your bot account separately and store the bot OAuth token
3. Update your `.env` file:

```env
TWITCH_CHAT_TYPE=bot
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_BOT_OAUTH_TOKEN=oauth:your_bot_oauth_token
```

## Troubleshooting

### Common Issues

1. **"Invalid or expired tokens"**

   - Re-authenticate with Twitch using `/api/twitch/auth`
   - Check that your OAuth application includes the required scopes

2. **"Not connected to chat"**

   - Make sure you've called `/api/chat/connect` before sending messages
   - Check the connection status via `/api/chat/status`

3. **WebSocket connection issues**

   - Ensure your WebSocket URL is correct (`ws://localhost:3001`)
   - Check that your firewall isn't blocking the connection

4. **Missing chat messages**
   - Verify you're authenticated with the correct scopes (`chat:read`)
   - Check that you're connected to the correct channel

### Debug Mode

Enable debug logging to see detailed information about chat operations:

```env
TWITCH_CHAT_ENABLE_LOGGING=true
LOG_LEVEL=debug
```

## Next Steps

1. Customize the chat message display in your overlay
2. Add moderation features (timeout, ban commands)
3. Implement chat commands for your overlay
4. Add user highlighting for subscribers, VIPs, etc.
5. Create a dashboard to manage chat settings

For more detailed information, see the [Chat API Documentation](CHAT_API_DOCUMENTATION.md).
