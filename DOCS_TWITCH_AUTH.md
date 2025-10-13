# Twitch OAuth Authentication Implementation

This document outlines the implementation of Twitch OAuth authentication using Passport.js in the OBS Backend Proxy application.

## Overview

The implementation provides Twitch OAuth authentication for users to connect their Twitch accounts to the OBS backend proxy. This allows users to authenticate with their Twitch credentials and access protected endpoints.

## Setup Instructions

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
TWITCH_CLIENT_ID=your_twitch_client_id_here
TWITCH_CLIENT_SECRET=your_twitch_client_secret_here
TWITCH_CALLBACK_URL=http://localhost:3001/api/twitch/auth/callback
```

### 2. API Endpoints

The following endpoints are available for Twitch authentication:

- `GET /api/twitch/auth` - Initiate Twitch OAuth authentication
- `GET /api/twitch/auth/callback` - Handle Twitch OAuth callback
- `GET /api/twitch/auth/logout` - Logout user
- `GET /api/twitch/profile` - Get authenticated user profile (protected route)
- `GET /api/twitch/status` - Check authentication status

## Implementation Details

### Authentication Flow

1. User visits `/api/twitch/auth`
2. User is redirected to Twitch OAuth page
3. User authorizes the application
4. Twitch redirects back to `/api/twitch/auth/callback`
5. Callback handler validates authentication and sets session
6. User is redirected to dashboard or appropriate page

### Middleware

The implementation includes:

- `twitchAuth.js` - Passport.js configuration for Twitch strategy
- `auth.js` - Authentication middleware for protected routes

### Protected Routes

Routes that require authentication:

- `/api/twitch/profile` - Returns authenticated user information

## Usage Examples

### Initiating Authentication

```bash
curl http://localhost:3001/api/twitch/auth
```

### Checking Authentication Status

```bash
curl http://localhost:3001/api/twitch/status
```

### Getting User Profile (Authenticated)

```bash
curl http://localhost:3001/api/twitch/profile
```

## Error Handling

The implementation includes comprehensive error handling:

- Invalid client credentials
- Authentication failures
- Session management errors
- Missing environment variables

## Security Considerations

- All authentication flows use HTTPS in production
- Session management follows security best practices
- OAuth scopes are limited to necessary permissions
- Error messages don't expose sensitive information

## Testing

To test the implementation:

1. Start the server with `npm run dev`
2. Add your Twitch client credentials to `.env`
3. Visit `http://localhost:3001/api/twitch/auth` to initiate authentication
4. Complete the OAuth flow
5. Verify authentication status with `http://localhost:3001/api/twitch/status`
