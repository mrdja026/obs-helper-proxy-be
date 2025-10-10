# Complete Frontend-Backend Integration Workflow

## Overview

This document provides a comprehensive guide for integrating the OBS Backend Proxy with the Expo frontend, including setup, testing, and deployment procedures.

## Architecture Overview

```
┌─────────────────┐    WebSocket     ┌─────────────────┐    HTTP/WS    ┌──────────────┐
│   Expo Frontend │ ◄──────────────► │  Backend Proxy  │ ◄─────────────► │  OBS Studio  │
│                 │                  │                 │                │              │
│ - React Hooks   │                  │ - Express API   │                │ - Scenes     │
│ - Scene Manager │                  │ - WebSocket     │                │ - Events     │
│ - State Mgmt    │                  │ - Mock Mode     │                │              │
└─────────────────┘                  └─────────────────┘                └──────────────┘
```

## Prerequisites

### Backend Requirements

- Node.js (v16 or higher)
- npm or yarn
- WebSocket enabled browser/client

### Frontend Requirements

- React 18+
- TypeScript
- WebSocket support

### Optional (Real OBS Mode)

- OBS Studio with WebSocket plugin
- OBS running on accessible network

## Setup Instructions

### 1. Backend Setup

#### 1.1 Install Dependencies

```bash
cd backend_proxy_obs_helper
npm install
```

#### 1.2 Configure Environment

Create/update `.env` file:

```bash
PORT=3001
OBS_WS_HOST=ws://127.0.0.1:4456
OBS_WS_PASSWORD=your_obs_password
MOCK_MODE=true
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_RECONNECT_ATTEMPTS=5
WS_RECONNECT_INTERVAL=3000
LOG_LEVEL=info
WS_ENABLE_LOGS=true
```

#### 1.3 Start Backend Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 2. Frontend Setup

#### 2.1 Install Dependencies

```bash
cd ketchup-overlay/client
npm install
```

#### 2.2 Configure WebSocket URL

Update the WebSocket service if needed:

```typescript
// In client/services/websocketService.ts
private url: string = 'ws://localhost:3001'; // Update to your server URL
```

#### 2.3 Update App Component

Replace your main App.tsx with AppWithScenes.tsx or integrate the scene management hooks into your existing app.

#### 2.4 Start Frontend

```bash
npm run dev
# or
expo start
```

## Testing Workflow

### Phase 1: Backend Testing

#### 1.1 Health Check

```bash
curl -X GET http://localhost:3001/api/health
```

#### 1.2 Connect to Mock OBS

```bash
curl -X POST http://localhost:3001/api/obs/connect \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 1.3 Test Scene Changes

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

#### 1.4 Test WebSocket Events

```bash
# Connect with wscat
wscat -c ws://localhost:3001

# You should see scene change events when executing the curl commands above
```

### Phase 2: Frontend Testing

#### 2.1 WebSocket Connection

Open your frontend app and check:

- Connection status indicator shows green
- No error messages
- WebSocket connection established

#### 2.2 Scene Change Reception

1. Execute scene change curl commands
2. Verify frontend updates to correct scene
3. Check scene transition animations
4. Verify scene history tracking

#### 2.3 Error Handling

1. Stop backend server
2. Verify frontend shows disconnected status
3. Restart backend
4. Verify automatic reconnection

### Phase 3: Integration Testing

#### 3.1 End-to-End Flow

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
npm run dev

# Terminal 3: Test with curl
curl -X POST http://localhost:3001/api/obs/scene/change \
  -H "Content-Type: application/json" \
  -d '{"sceneName": "Live"}'

# Terminal 4: Monitor WebSocket
wscat -c ws://localhost:3001
```

#### 3.2 Automated Testing

```bash
# Run backend tests
npm test

# Run frontend tests (if configured)
npm run test
```

## Development Workflow

### 1. Feature Development

#### Adding New Scenes

1. Update mock scenes in `src/services/obsConnectionMock.js`
2. Add scene component in frontend
3. Update scene router in `AppWithScenes.tsx`
4. Test with curl commands

#### Adding New WebSocket Events

1. Add event handler in backend WebSocket service
2. Add message type in frontend WebSocket service
3. Update scene manager to handle new events
4. Add React hooks if needed

### 2. Debugging

#### Backend Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Check logs
tail -f combined.log
```

#### Frontend Debugging

- Open browser developer tools
- Check Console tab for WebSocket messages
- Monitor Network tab for WebSocket frames
- Use React DevTools for state inspection

### 3. Performance Monitoring

#### Backend Metrics

- Connection count
- Message throughput
- Error rates
- Memory usage

#### Frontend Metrics

- WebSocket latency
- Reconnection frequency
- Scene transition performance
- Component render times

## Production Deployment

### 1. Backend Deployment

#### 1.1 Environment Configuration

```bash
# Production .env
PORT=3001
OBS_WS_HOST=ws://your-obs-server:4456
OBS_WS_PASSWORD=secure_password
MOCK_MODE=false
LOG_LEVEL=warn
WS_ENABLE_LOGS=false
```

#### 1.2 Process Management

```bash
# Using PM2
npm install -g pm2
pm2 start src/server.js --name "obs-backend"
pm2 save
pm2 startup
```

#### 1.3 SSL/TLS Configuration

- Use HTTPS for API endpoints
- Use WSS for WebSocket connections
- Configure proper certificates

### 2. Frontend Deployment

#### 2.1 Build for Production

```bash
npm run build
```

#### 2.2 Update WebSocket URL

```typescript
// Production WebSocket URL
private url: string = 'wss://your-domain.com:3001';
```

#### 2.3 Deploy to Hosting

- Deploy to Vercel, Netlify, or your preferred host
- Ensure WebSocket support is available
- Configure CORS properly

## Troubleshooting Guide

### Common Issues

#### 1. WebSocket Connection Fails

**Symptoms**: Frontend shows disconnected status
**Solutions**:

- Check if backend is running
- Verify port configuration
- Check firewall settings
- Ensure WebSocket URL is correct

#### 2. Scene Changes Not Detected

**Symptoms**: Frontend doesn't update when scenes change
**Solutions**:

- Verify WebSocket connection is active
- Check message format in browser console
- Ensure event listeners are properly set up
- Check for JavaScript errors

#### 3. High Memory Usage

**Symptoms**: Memory usage increases over time
**Solutions**:

- Check for memory leaks in event listeners
- Ensure proper cleanup on component unmount
- Monitor WebSocket connection count
- Implement connection pooling

#### 4. Frequent Disconnections

**Symptoms**: WebSocket connections drop frequently
**Solutions**:

- Check network stability
- Adjust heartbeat interval
- Implement exponential backoff for reconnections
- Check server load

### Debug Commands

#### Backend

```bash
# Check process status
pm2 status
pm2 logs obs-backend

# Test API directly
curl -v http://localhost:3001/api/health

# Monitor WebSocket
wscat -c ws://localhost:3001
```

#### Frontend

```bash
# Check build
npm run build

# Test WebSocket in browser
# Open developer tools -> Network -> WS tab
```

## Monitoring and Maintenance

### 1. Health Checks

#### Backend Health Endpoint

```bash
curl http://localhost:3001/api/health
```

#### WebSocket Health

- Monitor connection count
- Track message rates
- Check error rates

### 2. Logging

#### Backend Logs

- Connection events
- Scene changes
- Error messages
- Performance metrics

#### Frontend Logs

- WebSocket events
- Scene transitions
- User interactions
- Error reports

### 3. Alerts

#### Set up alerts for:

- High error rates
- Connection failures
- Memory usage thresholds
- Unusual activity patterns

## Security Considerations

### 1. Authentication

- Implement API key authentication
- Use JWT for WebSocket connections
- Rate limit API endpoints

### 2. Data Validation

- Validate all incoming data
- Sanitize user inputs
- Implement proper error handling

### 3. Network Security

- Use HTTPS/WSS in production
- Implement CORS properly
- Configure firewall rules

## Best Practices

### 1. Code Organization

- Separate concerns (services, hooks, components)
- Use TypeScript for type safety
- Implement proper error boundaries
- Follow consistent naming conventions

### 2. Performance

- Implement lazy loading for components
- Use React.memo for expensive renders
- Optimize WebSocket message handling
- Implement proper caching strategies

### 3. Testing

- Write unit tests for all services
- Implement integration tests
- Test error scenarios
- Use automated testing in CI/CD

### 4. Documentation

- Keep API documentation updated
- Document configuration options
- Provide troubleshooting guides
- Maintain change logs

## Conclusion

This integration workflow provides a complete solution for connecting your Expo frontend with the OBS Backend Proxy. The system is designed to be:

- **Scalable**: Handles multiple concurrent connections
- **Reliable**: Includes proper error handling and reconnection logic
- **Testable**: Comprehensive testing suite included
- **Maintainable**: Well-organized code with proper documentation
- **Secure**: Implements security best practices

Follow this guide for successful deployment and operation of your OBS scene management system.
