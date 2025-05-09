const WebSocket = require('ws');
const logger = require('../utils/logger');
const obsConnection = require('./obsConnection');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Set();
    }

    setup(server) {
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', (ws) => {
            this.handleConnection(ws);
        });

        // Set up OBS event handlers
        this.setupOBSEventHandlers();

        logger.info('WebSocket server is running');
    }

    handleConnection(ws) {
        this.clients.add(ws);
        logger.info(`New WebSocket client connected. Total clients: ${this.clients.size}`);

        // Send initial connection status
        this.sendToClient(ws, {
            type: 'connectionStatus',
            data: {
                connected: obsConnection.isConnected()
            }
        });

        ws.on('close', () => {
            this.clients.delete(ws);
            logger.info(`WebSocket client disconnected. Total clients: ${this.clients.size}`);
        });

        ws.on('error', (error) => {
            logger.error('WebSocket client error:', error);
            this.clients.delete(ws);
        });
    }

    setupOBSEventHandlers() {
        // Handle scene changes
        obsConnection.addEventHandler('sceneChanged', (data) => {
            this.broadcast({
                type: 'sceneChanged',
                data: {
                    sceneName: data.sceneName,
                    timestamp: new Date().toISOString()
                }
            });
        });

        // Handle connection status changes
        obsConnection.addEventHandler('connectionStatus', (data) => {
            this.broadcast({
                type: 'obsConnectionStatus',
                data: {
                    connected: data.connected,
                    timestamp: new Date().toISOString()
                }
            });
        });

        // Handle errors
        obsConnection.addEventHandler('error', (error) => {
            this.broadcast({
                type: 'obsError',
                data: {
                    message: error.message,
                    timestamp: new Date().toISOString()
                }
            });
        });
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }

    sendToClient(client, message) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }
}

const websocketService = new WebSocketService();

module.exports = {
    setupWebSocket: (server) => websocketService.setup(server)
}; 