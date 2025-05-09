require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    obs: {
        host: process.env.OBS_WS_HOST || 'ws://127.0.0.1:4456',
        password: process.env.OBS_WS_PASSWORD
    },
    cors: {
        origin: ['http://localhost:8081', 'http://192.168.0.234:8081', 'exp://192.168.0.234:8081'],
        methods: ['GET', 'POST']
    }
}; 