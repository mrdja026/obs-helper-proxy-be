require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    obs: {
        host: process.env.OBS_WS_HOST || 'ws://127.0.0.1:4455',
        password: process.env.OBS_WS_PASSWORD
    },
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
    }
}; 