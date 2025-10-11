const passport = require('passport');

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
    });
};

// Optional authentication middleware (doesn't block if not authenticated)
const optionalAuth = (req, res, next) => {
    // Just continue to next middleware
    return next();
};

// Check if user is authenticated and return user info if so
const getAuthStatus = (req, res) => {
    if (req.isAuthenticated()) {
        return res.json({
            authenticated: true,
            user: req.user
        });
    }
    return res.json({
        authenticated: false,
        user: null
    });
};

module.exports = {
    requireAuth,
    optionalAuth,
    getAuthStatus
};