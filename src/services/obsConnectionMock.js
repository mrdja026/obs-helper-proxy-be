const logger = require('../utils/logger');
const { OBSConnectionError } = require('../utils/errors');

class MockOBSConnectionManager {
    constructor() {
        this.connected = false;
        this.mockScenes = [
            { sceneName: 'Live', sceneIndex: 0 },
            { sceneName: 'BRB', sceneIndex: 1 },
            { sceneName: 'Pause', sceneIndex: 2 }
        ];
        this.currentSceneIndex = 0;
        this.eventHandlers = new Map();
        this.connectionStats = {
            totalConnections: 0,
            totalSceneChanges: 0,
            lastSceneChange: null,
            connectionHistory: []
        };
    }

    async connect(host = 'mock://localhost:4456', password = 'mock_password') {
        try {
            if (this.connected) {
                logger.info('Already connected to OBS (Mock Mode)');
                return { status: 'already_connected', message: 'Already connected to OBS (Mock)' };
            }

            // Simulate connection delay
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.connected = true;
            this.connectionStats.totalConnections++;
            this.connectionStats.connectionHistory.push({
                timestamp: new Date().toISOString(),
                event: 'connected',
                host
            });

            logger.info('Successfully connected to OBS (Mock Mode)', {
                host,
                connectionCount: this.connectionStats.totalConnections
            });

            // Notify event handlers about connection
            this.notifyEventHandlers('connectionStatus', {
                connected: true,
                host,
                timestamp: new Date().toISOString()
            });

            return {
                status: 'connected',
                message: 'Successfully connected to OBS (Mock Mode)',
                version: {
                    version: '30.0.0',
                    obsVersion: '30.0.0',
                    obsWebSocketVersion: '5.0.0',
                    platform: 'mock',
                    platformDescription: 'Mock platform for testing'
                },
                connectionStats: this.connectionStats
            };
        } catch (error) {
            logger.error('Failed to connect to OBS (Mock):', error);
            throw new OBSConnectionError(`Failed to connect to OBS (Mock): ${error.message}`);
        }
    }

    async disconnect() {
        try {
            if (!this.connected) {
                return { status: 'not_connected', message: 'Not connected to OBS' };
            }

            this.connected = false;
            this.connectionStats.connectionHistory.push({
                timestamp: new Date().toISOString(),
                event: 'disconnected'
            });

            logger.info('Successfully disconnected from OBS (Mock Mode)');

            // Notify event handlers about disconnection
            this.notifyEventHandlers('connectionStatus', {
                connected: false,
                timestamp: new Date().toISOString()
            });

            return {
                status: 'disconnected',
                message: 'Successfully disconnected from OBS (Mock Mode)',
                connectionStats: this.connectionStats
            };
        } catch (error) {
            logger.error('Error disconnecting from OBS (Mock):', error);
            throw new OBSConnectionError(`Error disconnecting from OBS (Mock): ${error.message}`);
        }
    }

    // Event handling methods
    addEventHandler(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
        logger.debug(`Added handler for event: ${event}`);
    }

    removeEventHandler(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
            logger.debug(`Removed handler for event: ${event}`);
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
            logger.debug('Retrieving scenes list (Mock)');
            return this.mockScenes;
        } catch (error) {
            logger.error('Error getting scenes (Mock):', error);
            throw new OBSConnectionError(`Failed to get scenes (Mock): ${error.message}`);
        }
    }

    async getCurrentScene() {
        try {
            const currentScene = this.mockScenes[this.currentSceneIndex];
            logger.debug(`Retrieving current scene: ${currentScene.sceneName} (Mock)`);
            
            return {
                sceneName: currentScene.sceneName,
                sceneIndex: currentScene.sceneIndex,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error getting current scene (Mock):', error);
            throw new OBSConnectionError(`Failed to get current scene (Mock): ${error.message}`);
        }
    }

    async changeScene(sceneName) {
        try {
            // Find the scene index
            const sceneIndex = this.mockScenes.findIndex(scene => scene.sceneName === sceneName);
            
            if (sceneIndex === -1) {
                const error = new OBSConnectionError(`Scene '${sceneName}' not found`);
                logger.error(`Scene change failed (Mock): ${error.message}`);
                this.notifyEventHandlers('error', error);
                throw error;
            }

            const previousSceneIndex = this.currentSceneIndex;
            const previousSceneName = this.mockScenes[previousSceneIndex].sceneName;
            
            // Simulate scene change delay
            await new Promise(resolve => setTimeout(resolve, 100));

            this.currentSceneIndex = sceneIndex;
            this.connectionStats.totalSceneChanges++;
            this.connectionStats.lastSceneChange = {
                from: previousSceneName,
                to: sceneName,
                timestamp: new Date().toISOString()
            };

            // Notify event handlers about the scene change
            const sceneChangeData = {
                sceneName: sceneName,
                previousSceneName: previousSceneName,
                sceneIndex: sceneIndex,
                previousSceneIndex: previousSceneIndex,
                timestamp: new Date().toISOString()
            };

            this.notifyEventHandlers('sceneChanged', sceneChangeData);

            logger.info(`Scene changed from '${previousSceneName}' to '${sceneName}' (Mock)`, {
                totalChanges: this.connectionStats.totalSceneChanges,
                sceneChangeData
            });

            return {
                status: 'success',
                message: `Changed to scene: ${sceneName}`,
                sceneName: sceneName,
                previousSceneName: previousSceneName,
                timestamp: new Date().toISOString(),
                connectionStats: this.connectionStats
            };
        } catch (error) {
            logger.error('Error changing scene (Mock):', error);
            throw new OBSConnectionError(`Failed to change scene (Mock): ${error.message}`);
        }
    }

    // Additional mock methods for testing
    async getSceneList() {
        try {
            return {
                scenes: this.mockScenes,
                currentProgramSceneName: this.mockScenes[this.currentSceneIndex].sceneName
            };
        } catch (error) {
            logger.error('Error getting scene list (Mock):', error);
            throw new OBSConnectionError(`Failed to get scene list (Mock): ${error.message}`);
        }
    }

    async getConnectionStats() {
        return {
            ...this.connectionStats,
            connected: this.connected,
            currentScene: this.mockScenes[this.currentSceneIndex].sceneName
        };
    }

    // Mock method to simulate random errors for testing
    simulateError(errorType = 'connection') {
        const errors = {
            connection: new OBSConnectionError('Simulated connection error'),
            sceneChange: new OBSConnectionError('Simulated scene change error'),
            invalidScene: new OBSConnectionError('Simulated invalid scene error')
        };

        const error = errors[errorType] || errors.connection;
        this.notifyEventHandlers('error', error);
        return error;
    }

    isConnected() {
        return this.connected;
    }

    // Reset mock state for testing
    reset() {
        this.connected = false;
        this.currentSceneIndex = 0;
        this.connectionStats = {
            totalConnections: 0,
            totalSceneChanges: 0,
            lastSceneChange: null,
            connectionHistory: []
        };
        logger.info('Mock OBS connection reset');
    }
}

// Create a singleton instance
const mockObsConnection = new MockOBSConnectionManager();

module.exports = mockObsConnection;