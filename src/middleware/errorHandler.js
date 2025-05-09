const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(err.stack);

    // Default to 500 if status code is not a valid HTTP status code
    const status = (err.statusCode && err.statusCode >= 100 && err.statusCode < 600)
        ? err.statusCode
        : 500;

    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        error: {
            message,
            status,
            name: err.name || 'Error'
        }
    });
};

module.exports = errorHandler; 