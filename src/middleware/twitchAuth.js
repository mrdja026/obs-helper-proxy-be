const passport = require("passport");
const OAuth2Strategy = require("passport-oauth2").Strategy;
const logger = require("../utils/logger");
const TokenService = require("../services/tokenService");
const config = require("../config/config");

// Configure Twitch OAuth2 Strategy (Helix)
passport.use(
  "twitch",
  new OAuth2Strategy(
    {
      authorizationURL: "https://id.twitch.tv/oauth2/authorize",
      tokenURL: "https://id.twitch.tv/oauth2/token",
      clientID: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
      callbackURL:
        process.env.TWITCH_CALLBACK_URL ||
        "http://localhost:3001/api/twitch/auth/callback",
      scope: config.twitch.scopes, // Use scopes from config
      state: true, // Enable CSRF protection via state parameter
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        logger.info(
          "Twitch OAuth2 verify callback: received accessToken, fetching user profile..."
        );
        // Validate required environment variables
        if (
          !process.env.TWITCH_CLIENT_ID ||
          !process.env.TWITCH_CLIENT_SECRET
        ) {
          const error = new Error("Twitch client credentials not configured");
          logger.error("Twitch authentication error: " + error.message);
          return done(error, null);
        }

        // Fetch user profile from Helix /users endpoint
        const fetch = (await import("node-fetch")).default;
        logger.info(
          "Fetching user profile from Helix /users with Bearer token..."
        );
        const usersResponse = await fetch("https://api.twitch.tv/helix/users", {
          headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            Authorization: `Bearer ${accessToken}`,
          },
        });
        logger.info("Helix /users response status:", usersResponse.status);
        if (!usersResponse.ok) {
          const errBody = await usersResponse.text();
          logger.error(
            "Failed to fetch user profile from Twitch Helix. Status:",
            usersResponse.status,
            "Body:",
            errBody
          );
          throw new Error(
            `Failed to fetch user profile: ${usersResponse.status} ${errBody}`
          );
        }
        const usersData = await usersResponse.json();
        logger.info(
          "Helix /users response data:",
          JSON.stringify(usersData, null, 2)
        );
        if (!usersData.data || usersData.data.length === 0) {
          throw new Error("No user data returned from Twitch Helix");
        }
        const twitchUser = usersData.data[0];

        // Normalize profile to match expected shape
        const normalizedProfile = {
          id: twitchUser.id,
          username: twitchUser.login,
          displayName: twitchUser.display_name,
          email: twitchUser.email,
          profileImageUrl: twitchUser.profile_image_url,
          provider: "twitch",
          _raw: JSON.stringify(twitchUser),
          _json: twitchUser,
        };

        logger.info(
          "Twitch authentication successful for user: " +
            normalizedProfile.id +
            " (" +
            normalizedProfile.displayName +
            ")"
        );

        // Store tokens in the profile for session storage
        normalizedProfile.tokens = {
          accessToken,
          refreshToken,
          expiresIn: 3600, // Default expiration, will be updated by token service
          scope: config.twitch.scopes,
          tokenType: "bearer",
        };

        return done(null, normalizedProfile);
      } catch (error) {
        logger.error("Error in Twitch authentication:", error);
        return done(error, null);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user, done) => {
  if (user && user.id) {
    done(null, user.id);
  } else {
    done(new Error("Invalid user object for serialization"));
  }
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  // In production, fetch the full user by ID from your data store
  if (id) {
    done(null, { id });
  } else {
    done(new Error("Invalid user ID for deserialization"));
  }
});

// Passport initialization and session are configured in the Express app (server.js)

module.exports = passport;
