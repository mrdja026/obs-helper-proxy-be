const OBSWebSocket = require('obs-websocket-js').default;
const logger = require('../utils/logger');
const { OBSConnectionError } = require('../utils/errors');
const config = require('../config/config');

class OBSConnectionManager {
    constructor() {
        this.obs = new OBSWebSocket();
        this.connected = false;
        this.connectionAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        this.eventHandlers = new Map();
    }

    async connect(host = config.obs.host, password = config.obs.password) {
        try {
            if (this.connected) {
                return { status: 'already_connected', message: 'Already connected to OBS' };
            }

            await this.obs.connect(host, password);
            this.connected = true;
            this.connectionAttempts = 0;

            logger.info('Successfully connected to OBS');

            // Set up event listeners
            this.setupEventListeners();

            return {
                status: 'connected',
                message: 'Successfully connected to OBS',
                version: await this.obs.call('GetVersion')
            };
        } catch (error) {
            logger.error('Failed to connect to OBS:', error);
            throw new OBSConnectionError(`Failed to connect to OBS: ${error.message}`);
        }
    }

    async disconnect() {
        try {
            if (!this.connected) {
                return { status: 'not_connected', message: 'Not connected to OBS' };
            }

            await this.obs.disconnect();
            this.connected = false;
            this.connectionAttempts = 0;

            logger.info('Successfully disconnected from OBS');

            return {
                status: 'disconnected',
                message: 'Successfully disconnected from OBS'
            };
        } catch (error) {
            logger.error('Error disconnecting from OBS:', error);
            throw new OBSConnectionError(`Error disconnecting from OBS: ${error.message}`);
        }
    }

    setupEventListeners() {
        // Handle disconnection
        this.obs.on('ConnectionClosed', async () => {
            this.connected = false;
            logger.warn('OBS connection closed');

            // Attempt to reconnect
            if (this.connectionAttempts < this.maxReconnectAttempts) {
                this.connectionAttempts++;
                logger.info(`Attempting to reconnect (${this.connectionAttempts}/${this.maxReconnectAttempts})...`);

                setTimeout(async () => {
                    try {
                        await this.connect();
                    } catch (error) {
                        logger.error('Reconnection attempt failed:', error);
                    }
                }, this.reconnectInterval);
            }
        });

        // Handle scene changes
        this.obs.on('CurrentSceneChanged', (data) => {
            logger.info('Scene changed:', data);
            this.notifyEventHandlers('sceneChanged', data);
        });

        // Handle errors
        this.obs.on('Error', (error) => {
            logger.error('OBS WebSocket error:', error);
            this.notifyEventHandlers('error', error);
        });
    }

    // Event handling methods
    addEventHandler(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }

    removeEventHandler(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }
    }

    notifyEventHandlers(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    logger.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // OBS operation methods
    async getScenes() {
        try {
            const { scenes } = await this.obs.call('GetSceneList');
            return scenes;
        } catch (error) {
            logger.error('Error getting scenes:', error);
            throw new OBSConnectionError(`Failed to get scenes: ${error.message}`);
        }
    }

    async getCurrentScene() {
        try {
            // Get the current program scene
            const { currentProgramSceneName } = await this.obs.call('GetCurrentProgramScene');
            return {
                sceneName: currentProgramSceneName,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error getting current scene:', error);
            throw new OBSConnectionError(`Failed to get current scene: ${error.message}`);
        }
    }

    async changeScene(sceneName) {
        try {
            await this.obs.call('SetCurrentProgramScene', { sceneName });
            return {
                status: 'success',
                message: `Changed to scene: ${sceneName}`,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error changing scene:', error);
            throw new OBSConnectionError(`Failed to change scene: ${error.message}`);
        }
    }

    isConnected() {
        return this.connected;
    }
}

// Create a singleton instance
const obsConnection = new OBSConnectionManager();

module.exports = obsConnection; 