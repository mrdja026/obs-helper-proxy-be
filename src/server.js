require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { setupWebSocket } = require('./services/websocket');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { securityHeaders } = require('./middleware/security');
const logger = require('./utils/logger');
const config = require('./config/config');

const app = express();

// Security middleware
app.use(securityHeaders);

// Basic middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(compression());

// Logging
app.use(requestLogger);

// Routes
app.use('/api', apiRoutes);

// Error handling
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
    logger.info(`Server is running on port ${config.port}`);
});

// Setup WebSocket
setupWebSocket(server);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
}); 