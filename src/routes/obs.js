const express = require('express');
const router = express.Router();
const obsConnection = require('../services/obsConnection');
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

        if (!host || !password) {
            throw new ValidationError('Host and password are required');
        }

        const result = await obsConnection.connect(host, password);
        res.json(result);
    } catch (error) {
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
router.get('/status', (req, res) => {
    res.json({
        connected: obsConnection.isConnected(),
        timestamp: new Date().toISOString()
    });
});

module.exports = router; 