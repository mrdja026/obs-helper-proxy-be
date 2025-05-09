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