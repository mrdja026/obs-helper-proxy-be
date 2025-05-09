const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log request
    logger.info({
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    // Log response
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`
        });
    });

    next();
};

module.exports = requestLogger; 