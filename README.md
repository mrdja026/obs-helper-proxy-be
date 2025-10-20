# OBS Backend Proxy

A Node.js backend proxy that serves as a bridge between your Expo app and OBS Studio, using the obs-websocket-js library.

## Prerequisites

- Node.js (v16 or higher)
- OBS Studio with WebSocket plugin installed
- npm or yarn package manager

## Setup

1. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

## API Endpoints

- `POST /connect` - Connect to OBS
- `GET /scenes` - List all scenes
- `GET /scene/current` - Get current scene
- `POST /scene/change` - Change scene
- `WS /events` - WebSocket endpoint for scene change events
- `GET /mic/status` - Get mute state for the configured mic input
- `POST /mic/start` - Unmute the mic (begin push-to-talk)
- `POST /mic/stop` - Mute the mic (end push-to-talk)
- `POST /mic/toggle` - Toggle the mic mute state

### Push-to-talk controls

These endpoints depend on the OBS input defined by `OBS_MIC_INPUT_NAME` (defaults to `Mic`). Optionally set `OBS_MIC_SCENE_NAME` if you want to document which scene houses the source.

Example requests:

```bash
# Get current mute state (optional inputName query)
curl "http://localhost:3001/api/obs/mic/status?inputName=Mic"

# Unmute the mic while a key is held down
curl -X POST http://localhost:3001/api/obs/mic/start \
  -H "Content-Type: application/json" \
  -d '{"inputName":"Mic"}'

# Re-mute when the key is released
curl -X POST http://localhost:3001/api/obs/mic/stop \
  -H "Content-Type: application/json" \
  -d '{"inputName":"Mic"}'

# Toggle from any client (responds with the new state)
curl -X POST http://localhost:3001/api/obs/mic/toggle \
  -H "Content-Type: application/json" \
  -d '{"inputName":"Mic"}'
```

## Development

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm test` - Run tests

## Project Structure

```
backend-proxy/
├── src/
│   ├── server.js
│   ├── config/
│   │   └── config.js
│   ├── services/
│   │   └── obsConnection.js
│   ├── routes/
│   │   └── api.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validation.js
│   └── utils/
│       └── logger.js
├── package.json
└── README.md
```

## Development: CORS and Session for Twitch Auth

This backend is configured to support a frontend at http://localhost:8080 making credentialed cross-origin requests to the backend at http://localhost:3001.

What’s configured

- CORS
  - Allowed origins include http://localhost:8080.
  - Credentials are enabled so cookies can be sent/received cross-origin.
  - Methods include GET, POST, PUT, PATCH, DELETE, OPTIONS.
  - See [`src/config/config.js`](src/config/config.js) under the cors section.
- Preflight handling
  - The server responds to OPTIONS preflight for all routes.
  - Applied via app.options("\*", cors(config.cors)) in [`src/server.js`](src/server.js).
- Session cookie for cross-origin
  - sameSite: "none" to allow cross-site cookie usage.
  - secure: false for localhost development (use true when you enable HTTPS).
  - Configured in the express-session cookie block in [`src/server.js`](src/server.js).

Frontend requirements

- Always use credentialed requests from the browser when calling the API:
  - Example:
    fetch("http://localhost:3001/api/twitch/status", {
    credentials: "include"
    }).then(r => r.json()).then(console.log);
- Ensure your frontend dev server runs on http://localhost:8080.

Verification steps

1. Restart the backend dev server.
2. From the browser console at http://localhost:8080, run:
   fetch("http://localhost:3001/api/twitch/status", { credentials: "include" })
   .then(r => [r.status, r.headers.get("access-control-allow-origin"), r.headers.get("access-control-allow-credentials")])
   .then(console.log);
   Expected result: [200, "http://localhost:8080", "true"]
3. Confirm that the JSON returns without CORS/network errors.

Troubleshooting

- Cookie blocked due to SameSite
  - The session cookie must be SameSite=None for cross-origin usage. This is already set.
- Cookie blocked due to Secure requirement
  - Browsers generally require Secure=true with SameSite=None. On plain HTTP localhost this may be blocked in some environments.
  - Options:
    - Enable HTTPS locally for the backend, then set cookie.secure = true in [`src/server.js`](src/server.js).
    - Or configure your frontend dev server to proxy /api to http://localhost:3001 so both appear under the same origin (no cross-origin cookies needed).
- CSP warnings on the frontend
  - CSP headers emitted by the backend do not control the separate frontend served at 8080. Any CSP-related messages in the browser are unrelated to API CORS and can be addressed within the frontend project.

Checklist for moving to production

- Serve both frontend and backend over HTTPS.
- Set cookie.secure = true in [`src/server.js`](src/server.js).
- Keep SameSite = "none" if using cross-site embedding, or switch to "lax"/"strict" if same-site.
- Restrict cors.origin in [`src/config/config.js`](src/config/config.js) to your exact production origins.

## Twitch OAuth Integration (Helix API)

This backend supports Twitch authentication using Passport with a custom OAuth2 strategy configured for Twitch’s Helix API.

### Architecture

- **Passport + passport-oauth2**: Generic OAuth2 strategy pointed at Twitch Helix endpoints.
- **express-session**: Stores user session with SameSite=lax for localhost dev (SameSite=none + Secure in production).
- **CORS**: Allows http://localhost:8080 with credentials: true for cross-origin cookie sharing.
- **Frontend flow**: Frontend redirects to backend /api/twitch/auth; after consent, Twitch redirects to backend /api/twitch/auth/callback; backend redirects frontend to ?auth=success or ?auth=error.

### Environment Variables

Add to `.env`:

```
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_CALLBACK_URL=http://localhost:3001/api/twitch/auth/callback
```

In the Twitch Developer Console, set OAuth Redirect URLs to exactly: `http://localhost:3001/api/twitch/auth/callback`.

### Key Implementation Details

- **Strategy**: `src/middleware/twitchAuth.js` configures OAuth2 with authorizationURL, tokenURL, and a custom verify callback that fetches the user profile from Helix /users.
- **Session handling**: `src/server.js` uses express-session with cookie.sameSite=lax for localhost; change to none+secure for cross-origin production.
- **Routes**:
  - GET /api/twitch/auth — initiates OAuth flow (Passport redirects to Twitch).
  - GET /api/twitch/auth/callback — handles Twitch redirect, exchanges code for token, fetches profile, creates session, then redirects frontend to ?auth=success or ?auth=error.
  - GET /api/twitch/status — returns {authenticated: true/false, user: ...} based on session.
  - GET /api/twitch/auth/logout — clears session.

### Challenges and Fixes

1. **Deprecated Kraken API**

   - Initial attempt used passport-twitch (Kraken), which returns 404.
   - Fix: Switched to passport-oauth2 with Helix endpoints.

2. **CORS and credentialed cookies**

   - Frontend at 8080 calling backend at 3001 required ACAO and ACAC headers.
   - Fix: Updated CORS config in `src/config/config.js` to include origin http://localhost:8080 and credentials: true; added global OPTIONS handler.

3. **OAuth state validation failure**

   - After 2FA, Passport reported “Unable to verify authorization request state.”
   - Root cause: Session cookie SameSite=none was not persisting across the Twitch redirect on localhost.
   - Fix: Changed session cookie SameSite to “lax” for localhost development. In production with cross-origin, use SameSite=none + secure:true.

4. **Frontend post-login detection**
   - After successful callback, the frontend needed to refresh its auth state.
   - Fix: Backend redirects to http://localhost:8080/?auth=success; Index.tsx detects this URL param, clears it, and calls /api/twitch/status to update UI.

### Production Checklist

- Serve both frontend and backend over HTTPS.
- Set session cookie.secure = true and SameSite=none if cross-origin.
- Restrict CORS origins to your production frontend.
- Ensure TWITCH_CALLBACK_URL and Twitch console redirect URI match your production backend URL.
- Consider rotating refresh tokens and storing user data in a persistent store instead of in-memory session.

### Testing the Flow

1. Click “Login with Twitch” on the frontend.
2. Approve on Twitch (including 2FA if enabled).
3. You should be redirected back to the frontend with ?auth=success.
4. The Login button should disappear; /api/twitch/status should return authenticated:true.
5. To test failure, interrupt the flow or mismatch the redirect URI; you should be redirected to ?auth=error.
