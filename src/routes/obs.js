const express = require('express');
const router = express.Router();
const config = require('../config/config');

// Conditionally require the appropriate connection service
const obsConnection = config.mockMode
    ? require('../services/obsConnectionMock')
    : require('../services/obsConnection');

const { ValidationError, OBSConnectionError } = require('../utils/errors');
const logger = require('../utils/logger');

// Middleware to check OBS connection
const checkOBSConnection = (req, res, next) => {
    if (!obsConnection.isConnected()) {
        return next(new OBSConnectionError('Not connected to OBS. Please connect first.'));
    }
    next();
};

// Connect to OBS
router.post('/connect', async (req, res, next) => {
    try {
        const { host, password } = req.body;

        // For mock mode, use default values if not provided
        const connectHost = config.mockMode ? undefined : (host || config.obs.host);
        const connectPassword = config.mockMode ? undefined : (password || config.obs.password);

        if (!config.mockMode && (!host || !password)) {
            throw new ValidationError('Host and password are required');
        }

        const result = await obsConnection.connect(connectHost, connectPassword);
        
        // Add mode information to response
        result.mockMode = config.mockMode;
        
        logger.info(`OBS connection established (Mode: ${config.mockMode ? 'Mock' : 'Real'})`, {
            host: connectHost,
            connected: result.status === 'connected'
        });
        
        res.json(result);
    } catch (error) {
        logger.error('OBS connection failed:', error);
        next(error);
    }
});

// Get all scenes
router.get('/scenes', checkOBSConnection, async (req, res, next) => {
    try {
        const scenes = await obsConnection.getScenes();
        res.json({ scenes });
    } catch (error) {
        next(error);
    }
});

// Get current scene
router.get('/scene/current', checkOBSConnection, async (req, res, next) => {
    try {
        const currentScene = await obsConnection.getCurrentScene();
        res.json(currentScene);
    } catch (error) {
        next(error);
    }
});

// Change scene
router.post('/scene/change', checkOBSConnection, async (req, res, next) => {
    try {
        const { sceneName } = req.body;

        if (!sceneName) {
            throw new ValidationError('Scene name is required');
        }

        const result = await obsConnection.changeScene(sceneName);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get connection status
router.get('/status', async (req, res, next) => {
    try {
        const status = {
            connected: obsConnection.isConnected(),
            mockMode: config.mockMode,
            timestamp: new Date().toISOString()
        };

        // Add additional stats for mock mode
        if (config.mockMode && typeof obsConnection.getConnectionStats === 'function') {
            status.stats = await obsConnection.getConnectionStats();
        }

        res.json(status);
    } catch (error) {
        next(error);
    }
});

// Reset mock state (mock mode only)
router.post('/reset', (req, res, next) => {
    try {
        if (!config.mockMode) {
            throw new ValidationError('Reset endpoint is only available in mock mode');
        }

        if (typeof obsConnection.reset === 'function') {
            obsConnection.reset();
            logger.info('Mock OBS connection reset');
        }

        res.json({
            status: 'success',
            message: 'Mock state reset successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// Simulate error (mock mode only)
router.post('/simulate-error', (req, res, next) => {
    try {
        if (!config.mockMode) {
            throw new ValidationError('Error simulation is only available in mock mode');
        }

        const { errorType = 'connection' } = req.body;
        
        if (typeof obsConnection.simulateError === 'function') {
            const error = obsConnection.simulateError(errorType);
            logger.warn(`Simulated error (${errorType}):`, error.message);
        }

        res.json({
            status: 'success',
            message: `Simulated ${errorType} error`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router; 