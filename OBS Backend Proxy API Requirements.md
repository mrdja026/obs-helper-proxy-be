<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

## OBS Backend Proxy API Requirements

### Overview

Info about the frontend APP it is written in expo for cross platform without having hardware. It uses react native and expo to build UI
Screens are allreday there

This Node.js backend will serve as a proxy between your Expo app and OBS Studio, using the [obs-websocket-js][^1][^3][^6] library to communicate with OBS. It will expose a simple HTTP or WebSocket API for the following features:

- Connect to OBS via a "connect" endpoint (with password support)
- List available scenes
- Get the current scene
- Change the active scene
- Trigger scene change events (notify frontend on scene switch)

---

### Functional Requirements

#### 1. **Connect to OBS**

- **Endpoint:** `POST /connect`
- **Request Body:**
    - `host` (string, required) - OBS WebSocket host (e.g., `ws://127.0.0.1:4455`)
    - `password` (string, required) - OBS WebSocket password
- **Response:**
    - Success/failure message
    - Connection details (e.g., OBS version, negotiated RPC version)
- **Behavior:** Establishes and maintains a persistent connection to OBS. If already connected, returns current status.


#### 2. **List Scenes**

- **Endpoint:** `GET /scenes`
- **Response:**
    - Array of scene objects (at minimum: `sceneName`, `isCurrent`)
- **Behavior:** Returns the list of available scenes in OBS.


#### 3. **Get Current Scene**

- **Endpoint:** `GET /scene/current`
- **Response:**
    - Object with current scene details (`sceneName`, etc.)
- **Behavior:** Returns the currently active scene.


#### 4. **Change Scene**

- **Endpoint:** `POST /scene/change`
- **Request Body:**
    - `sceneName` (string, required) - Name of the scene to switch to
- **Response:**
    - Success/failure message
- **Behavior:** Switches OBS to the specified scene.


#### 5. **Scene Change Events**

- **Endpoint:** WebSocket or Server-Sent Events (SSE) endpoint, e.g., `/events`
- **Behavior:** Emits a message/event to connected clients whenever the active scene changes in OBS.

---

### Non-Functional Requirements

- **Authentication:** (Optional) Protect endpoints with a simple API key or token.
- **Error Handling:** Return clear error messages for connection failures, invalid scene names, etc.
- **Single Connection:** Maintain a single persistent connection to OBS per backend instance.
- **Reconnect Logic:** Attempt to reconnect to OBS if the connection drops.
- **Logging:** Log all connection attempts, errors, and scene changes.

---

### Example API Structure

| Endpoint | Method | Description |
| :-- | :-- | :-- |
| `/connect` | POST | Connect to OBS with password |
| `/scenes` | GET | List all scenes |
| `/scene/current` | GET | Get currently active scene |
| `/scene/change` | POST | Change to specified scene |
| `/events` | WS/SSE | Receive scene change notifications |


---

### Dependencies

- Node.js (v16+ recommended)
- `obs-websocket-js` npm package
- Express (for HTTP API)
- ws or express-ws (for WebSocket events)

---

### References

- [obs-websocket-js GitHub][^1]
- [Node.js OBS WebSocket guide][^3][^5][^6]

---

**[^1]: https://github.com/obs-websocket-community-projects/obs-websocket-js**
**[^3]: https://alecjeay.hashnode.dev/getting-started-with-the-obs-websocket-using-nodejs**
**[^5]: https://alecjeay.hashnode.dev/obs-websocket-using-nodejs-continued**
**[^6]: https://ndiesslin.com/blog/OBS-websocket/**

---

You can feed this requirements document to Cursor, Replit, or any AI code generator to scaffold your backend proxy API.

<div style="text-align: center">⁂</div>

[^1]: https://github.com/obs-websocket-community-projects/obs-websocket-js

[^2]: https://www.videosdk.live/developer-hub/websocket/obs-websocket

[^3]: https://alecjeay.hashnode.dev/getting-started-with-the-obs-websocket-using-nodejs

[^4]: https://stackoverflow.com/questions/23686379/how-to-make-websockets-to-go-through-a-proxy-in-node-js

[^5]: https://alecjeay.hashnode.dev/obs-websocket-using-nodejs-continued

[^6]: https://ndiesslin.com/blog/OBS-websocket/

[^7]: https://obsproject.com/forum/threads/obs-websocket-connect-webpage-example-needed.168128/

[^8]: https://github.com/orgs/obs-websocket-community-projects/repositories

[^9]: https://socket.dev/npm/package/obs-websocket-js/diff/5.0.0-alpha.0

[^10]: https://www.npmjs.com/search?q=keywords%3Awebsocket+manager

