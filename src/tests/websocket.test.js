const WebSocket = require('ws');
const http = require('http');
const { setupWebSocket } = require('../services/websocket');
const obsConnection = require('../services/obsConnectionMock');

// Mock OBS connection for testing
jest.mock('../services/obsConnection', () => require('../services/obsConnectionMock'));

describe('WebSocket Service', () => {
  let server, wsService, client1, client2;

  beforeAll(async () => {
    // Create a test HTTP server
    server = http.createServer();
    await new Promise((resolve) => {
      server.listen(0, resolve);
    });

    // Setup WebSocket service
    setupWebSocket(server);
    
    // Get the WebSocket service instance
    wsService = require('../services/websocket');
  });

  afterAll(async () => {
    // Close all connections
    if (client1) client1.close();
    if (client2) client2.close();
    
    // Shutdown WebSocket service
    if (wsService && typeof wsService.shutdown === 'function') {
      wsService.shutdown();
    }
    
    // Close server
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  beforeEach(async () => {
    // Reset mock OBS connection
    obsConnection.reset();
    
    // Connect mock OBS
    await obsConnection.connect();
  });

  afterEach(async () => {
    // Disconnect clients
    if (client1 && client1.readyState === WebSocket.OPEN) {
      client1.close();
    }
    if (client2 && client2.readyState === WebSocket.OPEN) {
      client2.close();
    }
    
    // Wait for disconnection
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Connection Handling', () => {
    test('should accept WebSocket connections', (done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);

      client1.on('open', () => {
        expect(client1.readyState).toBe(WebSocket.OPEN);
        done();
      });
    });

    test('should send connection status on connect', (done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);

      client1.on('open', () => {
        // Wait for initial message
      });

      client1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'connectionStatus') {
          expect(message.data.connected).toBe(true);
          expect(message.data.mockMode).toBe(true);
          expect(message.data.clientId).toBeDefined();
          done();
        }
      });
    });

    test('should handle multiple clients', (done) => {
      const port = server.address().port;
      let connections = 0;

      const checkConnections = () => {
        connections++;
        if (connections === 2) {
          const stats = wsService.getStats();
          expect(stats.activeConnections).toBe(2);
          done();
        }
      };

      client1 = new WebSocket(`ws://localhost:${port}`);
      client2 = new WebSocket(`ws://localhost:${port}`);

      client1.on('open', checkConnections);
      client2.on('open', checkConnections);
    });

    test('should handle client disconnection', (done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);

      client1.on('open', () => {
        client1.close();
      });

      client1.on('close', () => {
        setTimeout(() => {
          const stats = wsService.getStats();
          expect(stats.activeConnections).toBe(0);
          done();
        }, 100);
      });
    });
  });

  describe('Message Handling', () => {
    beforeEach((done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);
      client1.on('open', done);
    });

    test('should handle ping messages', (done) => {
      client1.send(JSON.stringify({ type: 'ping', data: null }));

      client1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong') {
          expect(message.data.timestamp).toBeDefined();
          done();
        }
      });
    });

    test('should handle getStatus messages', (done) => {
      client1.send(JSON.stringify({ type: 'getStatus', data: null }));

      client1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'statusResponse') {
          expect(message.data.connected).toBe(true);
          expect(message.data.serverStats).toBeDefined();
          done();
        }
      });
    });

    test('should handle unknown message types gracefully', (done) => {
      client1.send(JSON.stringify({ type: 'unknown', data: null }));

      // Should not crash, just ignore the message
      setTimeout(() => {
        const stats = wsService.getStats();
        expect(stats.errors).toBe(0);
        done();
      }, 100);
    });
  });

  describe('Scene Change Events', () => {
    beforeEach((done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);
      client1.on('open', done);
    });

    test('should broadcast scene changes to all clients', (done) => {
      const port = server.address().port;
      client2 = new WebSocket(`ws://localhost:${port}`);

      let messagesReceived = 0;
      const checkMessage = (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'sceneChanged') {
          expect(message.data.sceneName).toBe('Live');
          expect(message.data.previousSceneName).toBeDefined();
          expect(message.data.timestamp).toBeDefined();
          
          messagesReceived++;
          if (messagesReceived === 2) {
            done();
          }
        }
      };

      client1.on('message', checkMessage);
      client2.on('message', checkMessage);

      client2.on('open', () => {
        // Trigger scene change
        obsConnection.changeScene('Live');
      });
    });

    test('should include scene transition details', (done) => {
      client1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'sceneChanged') {
          expect(message.data).toHaveProperty('sceneName');
          expect(message.data).toHaveProperty('previousSceneName');
          expect(message.data).toHaveProperty('sceneIndex');
          expect(message.data).toHaveProperty('previousSceneIndex');
          expect(message.data).toHaveProperty('timestamp');
          done();
        }
      });

      // Trigger scene change
      obsConnection.changeScene('BRB');
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);
      client1.on('open', done);
    });

    test('should broadcast OBS errors to clients', (done) => {
      client1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'obsError') {
          expect(message.data.message).toBeDefined();
          expect(message.data.name).toBeDefined();
          expect(message.data.timestamp).toBeDefined();
          done();
        }
      });

      // Simulate an error
      obsConnection.simulateError('connection');
    });

    test('should handle malformed messages', (done) => {
      client1.send('invalid json');

      setTimeout(() => {
        const stats = wsService.getStats();
        expect(stats.errors).toBe(0); // Should not crash, just ignore
        done();
      }, 100);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track connection statistics', (done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);

      client1.on('open', () => {
        const stats = wsService.getStats();
        expect(stats.totalConnections).toBeGreaterThan(0);
        expect(stats.activeConnections).toBe(1);
        done();
      });
    });

    test('should track message statistics', (done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);

      client1.on('open', () => {
        client1.send(JSON.stringify({ type: 'ping', data: null }));
      });

      client1.on('message', () => {
        const stats = wsService.getStats();
        expect(stats.messagesSent).toBeGreaterThan(0);
        expect(stats.messagesReceived).toBeGreaterThan(0);
        done();
      });
    });

    test('should provide client information', (done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);

      client1.on('open', () => {
        const stats = wsService.getStats();
        expect(stats.clients).toBeDefined();
        expect(stats.clients.length).toBe(1);
        expect(stats.clients[0]).toHaveProperty('id');
        expect(stats.clients[0]).toHaveProperty('ip');
        expect(stats.clients[0]).toHaveProperty('connectedAt');
        done();
      });
    });
  });

  describe('Heartbeat Mechanism', () => {
    test('should send ping messages periodically', (done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);
      
      let pingCount = 0;
      client1.on('ping', () => {
        pingCount++;
        if (pingCount >= 2) {
          done();
        }
      });

      client1.on('open', () => {
        // Wait for heartbeat to trigger
      });
    }, 35000); // Wait for heartbeat interval (30s + buffer)

    test('should handle pong responses', (done) => {
      const port = server.address().port;
      client1 = new WebSocket(`ws://localhost:${port}`);

      client1.on('open', () => {
        client1.send(JSON.stringify({ type: 'ping', data: null }));
      });

      client1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong') {
          done();
        }
      });
    });
  });
});