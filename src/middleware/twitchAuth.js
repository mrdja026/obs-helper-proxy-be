const passport = require('passport');
const TwitchStrategy = require('passport-twitch').Strategy;
const logger = require('../utils/logger');

// Configure Twitch Strategy
passport.use(new TwitchStrategy({
    clientID: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    callbackURL: process.env.TWITCH_CALLBACK_URL || "http://localhost:3000/api/twitch/auth/callback",
    scope: ['user:read:email'] // Adjust scopes as needed
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Validate required environment variables
        if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
            const error = new Error('Twitch client credentials not configured');
            logger.error('Twitch authentication error:', error.message);
            return done(error, null);
        }

        // Here you would typically:
        // 1. Check if user exists in your database
        // 2. Create new user if doesn't exist
        // 3. Return user object
        logger.info('Twitch authentication successful for user:', profile.id);
        return done(null, profile);
    } catch (error) {
        logger.error('Error in Twitch authentication:', error);
        return done(error, null);
    }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
    if (user && user.id) {
        done(null, user.id);
    } else {
        done(new Error('Invalid user object for serialization'));
    }
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
    // Here you would typically fetch user from database by ID
    // For now, we'll just pass the id
    if (id) {
        done(null, { id });
    } else {
        done(new Error('Invalid user ID for deserialization'));
    }
});

// Error handling middleware for Passport
passport.initialize();
passport.session();

module.exports = passport;