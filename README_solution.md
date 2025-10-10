# Twitch Integration Implementation Plan for OBS Helper

## Overview

This document outlines a comprehensive plan to integrate Twitch follower and subscriber events into the existing OBS helper backend proxy. The implementation will extend the current architecture to support real-time Twitch events that can be consumed by the Expo frontend UI.

## Prerequisites

### Twitch Application Setup

Before implementing any of the following phases, you must:

1. **Create a Twitch Application**:

   - Go to [Twitch Developer Console](https://dev.twitch.tv/console)
   - Create a new application
   - Obtain Client ID and Client Secret
   - Set OAuth Redirect URI (e.g., `http://localhost:3000/api/twitch/auth/callback`)
   - Generate a Webhook Secret for EventSub

2. **Client-Side Authentication Page**:

   - Your Expo app must include an admin/authentication page
   - This page should be displayed when the user is not authenticated with Twitch
   - Handle the OAuth flow initiation and callback processing
   - Store authentication tokens securely on the device

3. **Authentication Flow**:
   ```
   User opens app → Check auth status → Not authenticated →
   Show admin page → Click "Connect to Twitch" →
   Redirect to Twitch → User authorizes →
   Twitch redirects back → Exchange code for tokens →
   Store tokens locally → Show main interface
   ```

**Note**: Even though all data will be stored locally, a Twitch application is required for API access and EventSub webhooks. The Twitch application only provides API credentials - all processing and storage remains local.

## Current Architecture Analysis

The existing OBS helper has:

- WebSocket connection management to OBS Studio
- Event-driven architecture with broadcasting capabilities
- REST API endpoints for OBS operations
- Secure middleware and error handling

## Implementation Plan

### Phase 1: Twitch Platform Integration

#### 1.1 Dependencies and Configuration

- [ ] Add required npm packages:
  - `twitch` - Official Twitch SDK
  - `twitch-auth` - Authentication handling
  - `twitch-eventsub` - EventSub WebSocket for real-time events
  - `dotenv` - Environment variable management (already installed)
- [ ] Update `package.json` with new dependencies
- [ ] Add Twitch configuration to `src/config/config.js`:
  ```javascript
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    redirectUri: process.env.TWITCH_REDIRECT_URI,
    scopes: ['user:read:followers', 'channel:read:subscriptions', 'bits:read']
  }
  ```

#### 1.2 Twitch Authentication Service

- [ ] Create `src/services/twitchAuth.js`:
  - OAuth 2.0 flow implementation
  - Token storage and refresh logic
  - User authentication state management
- [ ] Create `src/utils/tokenStorage.js`:
  - Secure token storage mechanism
  - Token expiration handling
  - Refresh token management

#### 1.3 Twitch API Service

- [ ] Create `src/services/twitchService.js`:
  - Initialize Twitch client with authentication
  - Implement rate limiting
  - Error handling for API failures
  - Methods for:
    - `getChannelInfo()`
    - `getFollowers()`
    - `getSubscribers()`
    - `validateTokens()`

### Phase 2: Event System Extension

#### 2.1 Twitch Event Handler

- [ ] Create `src/services/twitchEventHandler.js`:
  - EventSub WebSocket connection management
  - Event subscription management
  - Event parsing and normalization
  - Reconnection logic for EventSub

#### 2.2 Extend OBS Connection Manager

- [ ] Modify `src/services/obsConnection.js`:
  - Add Twitch event types to event handler system
  - Integrate Twitch service initialization
  - Add event correlation between OBS and Twitch events

#### 2.3 Extend WebSocket Service

- [ ] Modify `src/services/websocket.js`:
  - Add Twitch event broadcasting
  - New message types:
    - `followerReceived`
    - `subscriberReceived`
    - `subscriptionGifted`
    - `cheerReceived`
  - Event filtering and prioritization

#### 2.4 Event Types and Data Structures

- [ ] Define standardized event formats:

  ```javascript
  // Follower Event
  {
    type: 'followerReceived',
    data: {
      userId: 'string',
      userName: 'string',
      userDisplayName: 'string',
      userProfileImageUrl: 'string',
      followedAt: 'ISO8601 timestamp',
      message: 'string (optional)'
    },
    timestamp: 'ISO8601 timestamp'
  }

  // Subscriber Event
  {
    type: 'subscriberReceived',
    data: {
      userId: 'string',
      userName: 'string',
      userDisplayName: 'string',
      userProfileImageUrl: 'string',
      subscribedAt: 'ISO8601 timestamp',
      tier: 'number (1000, 2000, 3000)',
      isGift: 'boolean',
      message: 'string (optional)'
    },
    timestamp: 'ISO8601 timestamp'
  }
  ```

### Phase 3: API Extensions

#### 3.1 Authentication Routes

- [ ] Create `src/routes/twitchAuth.js`:
  - `GET /api/twitch/auth/url` - Get authorization URL
  - `POST /api/twitch/auth/callback` - Handle OAuth callback
  - `POST /api/twitch/auth/refresh` - Refresh access token
  - `GET /api/twitch/auth/status` - Check authentication status
  - `DELETE /api/twitch/auth/revoke` - Revoke authentication

#### 3.2 Twitch Configuration Routes

- [ ] Create `src/routes/twitchConfig.js`:
  - `GET /api/twitch/config` - Get current configuration
  - `PUT /api/twitch/config` - Update configuration
  - `POST /api/twitch/config/test` - Test connection

#### 3.3 Event Management Routes

- [ ] Create `src/routes/twitchEvents.js`:
  - `GET /api/twitch/events` - Get recent events
  - `POST /api/twitch/events/subscribe` - Subscribe to event types
  - `DELETE /api/twitch/events/unsubscribe` - Unsubscribe from event types
  - `GET /api/twitch/events/stats` - Get event statistics

#### 3.4 Update Main API Router

- [ ] Modify `src/routes/api.js`:
  - Include new Twitch routes
  - Add middleware for Twitch authentication

### Phase 4: UI Integration Support

#### 4.1 WebSocket Client Extensions

- [ ] Document WebSocket message formats for frontend
- [ ] Create connection management guidelines
- [ ] Define reconnection strategies for frontend

#### 4.2 Frontend Integration Points

- [ ] Document API endpoints for frontend consumption
- [ ] Create authentication flow documentation
- [ ] Define error handling patterns

#### 4.3 Testing and Validation

- [ ] Create test scenarios for:
  - Authentication flow
  - Event reception and broadcasting
  - Error handling
  - Rate limiting
  - Reconnection logic

## Implementation Details

### File Structure Changes

```
src/
├── config/
│   └── config.js (modified)
├── middleware/
│   ├── twitchAuth.js (new)
│   └── rateLimit.js (new)
├── routes/
│   ├── api.js (modified)
│   ├── twitchAuth.js (new)
│   ├── twitchConfig.js (new)
│   └── twitchEvents.js (new)
├── services/
│   ├── obsConnection.js (modified)
│   ├── websocket.js (modified)
│   ├── twitchAuth.js (new)
│   ├── twitchService.js (new)
│   └── twitchEventHandler.js (new)
└── utils/
    ├── errors.js (modified)
    ├── tokenStorage.js (new)
    └── twitchRateLimit.js (new)
```

### Environment Variables

Add to `.env` file:

```
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/api/twitch/auth/callback
TWITCH_WEBHOOK_SECRET=your_webhook_secret
```

### Security Considerations

1. **Token Security**

   - Encrypt stored tokens
   - Implement token rotation
   - Secure token transmission

2. **Rate Limiting**

   - Implement Twitch API rate limits
   - Add request queuing for high-volume events
   - Monitor and alert on rate limit breaches

3. **Webhook Security**
   - Verify webhook signatures
   - Implement IP whitelisting
   - Use HTTPS for all endpoints

### Error Handling

1. **Twitch API Errors**

   - Token expiration handling
   - Rate limit exceeded responses
   - Network connectivity issues

2. **EventSub Errors**

   - WebSocket disconnection handling
   - Event subscription failures
   - Message parsing errors

3. **Integration Errors**
   - OBS connection failures
   - WebSocket client disconnections
   - Cross-service communication failures

### Performance Considerations

1. **Event Processing**

   - Implement event queuing for high-volume periods
   - Add event prioritization
   - Batch processing for non-critical events

2. **Memory Management**

   - Limit event history storage
   - Implement cleanup for old events
   - Monitor memory usage patterns

3. **Scalability**
   - Design for horizontal scaling
   - Implement connection pooling
   - Add monitoring and metrics

## Testing Strategy

### Unit Tests

- [ ] Test all new service methods
- [ ] Test authentication flows
- [ ] Test event parsing and formatting
- [ ] Test error handling scenarios

### Integration Tests

- [ ] Test Twitch API integration
- [ ] Test EventSub WebSocket connection
- [ ] Test event broadcasting to clients
- [ ] Test end-to-end event flow

### Load Tests

- [ ] Test performance under high event volume
- [ ] Test WebSocket connection limits
- [ ] Test rate limiting effectiveness

## Deployment Considerations

### Environment Setup

- [ ] Configure Twitch application
- [ ] Set up environment variables
- [ ] Configure webhook endpoints
- [ ] Set up monitoring and logging

### Monitoring

- [ ] Add metrics for Twitch API calls
- [ ] Monitor EventSub connection status
- [ ] Track event processing performance
- [ ] Alert on authentication failures

## Timeline Estimate

- **Phase 1**: 2-3 days
- **Phase 2**: 3-4 days
- **Phase 3**: 2-3 days
- **Phase 4**: 1-2 days
- **Testing and Documentation**: 2-3 days

**Total Estimated Time**: 10-15 days

## Risks and Mitigations

### Technical Risks

1. **Twitch API Changes**
   - Mitigation: Use official SDK, monitor API updates
2. **Rate Limiting**
   - Mitigation: Implement robust rate limiting, add queuing
3. **EventSub Reliability**
   - Mitigation: Implement reconnection logic, add fallback polling

### Operational Risks

1. **Token Management**
   - Mitigation: Automated refresh, secure storage
2. **Scalability**
   - Mitigation: Design for horizontal scaling from start
3. **Downtime**
   - Mitigation: Implement health checks, monitoring

## Success Criteria

1. Successfully receive and broadcast follower events
2. Successfully receive and broadcast subscriber events
3. Maintain stable EventSub connection
4. Handle authentication and token refresh automatically
5. Provide reliable event delivery to frontend clients
6. Implement proper error handling and recovery
7. Meet performance requirements under normal load

## Next Steps

1. Review and approve this implementation plan
2. Set up Twitch developer application
3. Begin Phase 1 implementation
4. Regular progress reviews and plan adjustments
