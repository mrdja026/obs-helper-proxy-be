# Token Storage Guide

This guide explains the different token storage methods available for the Twitch chat integration and how to configure them.

## Overview

The backend supports three different token storage methods to handle authentication tokens:

1. **Session Storage** - Traditional session-based storage (default for web browsers)
2. **File Storage** - Persistent file-based storage (ideal for OBS and API usage)
3. **Hybrid Storage** - Combines both methods for maximum compatibility

## Configuration

Add the following environment variables to your `.env` file:

```env
# Token storage method: "session", "file", or "hybrid"
TWITCH_TOKEN_STORAGE_METHOD=file

# File path for token storage (only used when method is "file" or "hybrid")
TWITCH_TOKEN_FILE_PATH=twitch-tokens.json
```

## Storage Methods

### 1. Session Storage (`TWITCH_TOKEN_STORAGE_METHOD=session`)

Stores tokens in the Express session memory.

**Pros:**

- Standard web authentication flow
- Automatic cleanup when session expires
- Secure (tokens not written to disk)

**Cons:**

- Lost when server restarts
- Doesn't work with curl/API tools
- Session must be maintained

**Use Case:**
Traditional web applications where users authenticate through a browser.

### 2. File Storage (`TWITCH_TOKEN_STORAGE_METHOD=file`)

Stores tokens in a JSON file on the server disk.

**Pros:**

- Persistent across server restarts
- Works with curl and API tools
- Perfect for OBS overlay integration
- Simple and reliable

**Cons:**

- Tokens stored on disk (consider security implications)
- File access permissions need to be configured
- Single user per token file

**Use Case:**
OBS overlays, API integrations, or single-user setups where persistence is important.

### 3. Hybrid Storage (`TWITCH_TOKEN_STORAGE_METHOD=hybrid`)

Uses both session and file storage for maximum compatibility.

**Pros:**

- Works with both browsers and API tools
- Persistent file storage with session fallback
- Most flexible option

**Cons:**

- More complex storage management
- Tokens stored in multiple locations

**Use Case:**
Mixed environments where both browser and API access is needed.

## File Storage Details

When using file storage, tokens are saved in a JSON file with the following structure:

```json
{
  "accessToken": "xxxxxxxxxxxxxxxxxxxxxxxxxx",
  "refreshToken": "xxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expiresAt": "2023-10-13T13:45:19.518Z",
  "scope": ["user:read:email", "chat:read", "chat:edit"],
  "tokenType": "bearer",
  "user": {
    "id": "87201773",
    "username": "ketchupadmirer",
    "displayName": "KetchupAdmirer"
  },
  "storedAt": "2023-10-13T12:45:19.518Z"
}
```

### Security Considerations

- The token file contains sensitive authentication data
- Ensure proper file permissions are set
- The file is automatically added to `.gitignore`
- Consider encrypting the file in production environments
- Delete the file if tokens are compromised

## Migration Guide

### Switching from Session to File Storage

1. Update your `.env` file:

   ```env
   TWITCH_TOKEN_STORAGE_METHOD=file
   TWITCH_TOKEN_FILE_PATH=twitch-tokens.json
   ```

2. Restart the server

3. Re-authenticate with Twitch:

   ```bash
   # Open in browser
   http://localhost:3001/api/twitch/auth
   ```

4. Tokens will now be stored in `twitch-tokens.json`

### Switching from File to Session Storage

1. Update your `.env` file:

   ```env
   TWITCH_TOKEN_STORAGE_METHOD=session
   ```

2. (Optional) Delete the token file:

   ```bash
   rm twitch-tokens.json
   ```

3. Restart the server

4. Re-authenticate through the browser

## Testing with Different Storage Methods

### Testing File Storage with curl

1. Set storage method to `file` in `.env`
2. Authenticate through browser to create the token file
3. Test with curl:

   ```bash
   curl -X POST http://localhost:3001/api/chat/connect \
     -H "Content-Type: application/json" \
     -d '{"connectionType": "broadcaster"}'

   curl -X POST http://localhost:3001/api/chat/send \
     -H "Content-Type: application/json" \
     -d '{"message": "Test from API!", "channel": "ketchupadmirer"}'
   ```

### Testing Session Storage

1. Set storage method to `session` in `.env`
2. Use browser to authenticate
3. Use browser session cookies for API calls

### Testing Hybrid Storage

1. Set storage method to `hybrid` in `.env`
2. Authenticate through browser
3. Both browser sessions and curl API calls will work

## Troubleshooting

### "Authentication failed" Errors

1. Check your storage method configuration
2. Verify the token file exists and is readable (for file storage)
3. Check token expiration in the file
4. Ensure proper file permissions

### Token File Issues

1. **File not found**: Re-authenticate to create the file
2. **Permission denied**: Check file permissions
3. **Invalid JSON**: Delete the file and re-authenticate
4. **Expired tokens**: Re-authenticate to refresh tokens

### Session Issues

1. **Session lost**: Re-authenticate in browser
2. **Multiple sessions**: Clear browser cookies and re-authenticate
3. **Server restart**: Sessions are lost, re-authenticate

## Best Practices

1. **For OBS overlays**: Use file storage for persistence
2. **For web applications**: Use session storage for security
3. **For development**: Use hybrid storage for flexibility
4. **For production**: Use appropriate security measures for file storage
5. **Regular cleanup**: Remove expired tokens from file storage
6. **Backup tokens**: Keep a secure backup of the token file if needed

## API Endpoints for Token Management

### Get Token Status

```bash
curl http://localhost:3001/api/chat/tokens
```

### Clear Tokens

```bash
# For session storage
curl -X POST http://localhost:3001/api/twitch/auth/logout

# For file storage, delete the file manually
rm twitch-tokens.json
```

### Check Storage Statistics

```bash
curl http://localhost:3001/api/test/cache-stats
```

This endpoint shows detailed information about the current storage method and token status.
