const express = require('express');
const passport = require('../middleware/twitchAuth');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Twitch authentication routes
router.get('/auth', passport.authenticate('twitch', { scope: ['user:read:email'] }));

router.get('/auth/callback',
    passport.authenticate('twitch', { failureRedirect: '/login' }),
    (req, res) => {
        // Successful authentication
        res.redirect('/dashboard'); // Redirect to dashboard or wherever appropriate
    }
);

router.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Session destruction failed' });
            }
            res.json({ message: 'Logged out successfully' });
        });
    });
});

// Protected route example
router.get('/profile', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

// Get authentication status
router.get('/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: req.user
        });
    } else {
        res.json({
            authenticated: false,
            user: null
        });
    }
});

module.exports = router;