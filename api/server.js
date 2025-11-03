const express = require('express');
const cors = require('cors');

class APIServer {
    constructor(controller, config) {
        this.controller = controller;
        this.config = config;
        this.app = express();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        
        this.app.use((req, res, next) => {
            const apiKey = req.headers['x-api-key'];
            
            if (apiKey !== this.config.API_KEY) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid API key'
                });
            }
            
            next();
        });

        this.app.use((req, res, next) => {
            console.log(`📡 API Request: ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        this.app.get('/api/health', (req, res) => {
            res.json({
                success: true,
                status: 'online',
                timestamp: new Date().toISOString()
            });
        });

        this.app.get('/api/servers', (req, res) => {
            try {
                const servers = this.controller.getAvailableServers();
                res.json({
                    success: true,
                    total: servers.length,
                    servers: servers
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.get('/api/servers/:serverId', (req, res) => {
            try {
                const serverId = parseInt(req.params.serverId);
                const serverInfo = this.controller.getServerInfo(serverId);
                
                if (!serverInfo) {
                    return res.status(404).json({
                        success: false,
                        error: 'Server not found'
                    });
                }
                
                res.json({
                    success: true,
                    server: serverInfo
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.get('/api/countries', (req, res) => {
            try {
                res.json({
                    success: true,
                    total: this.config.COUNTRIES.length,
                    countries: this.config.COUNTRIES
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.get('/api/numbers/:serverId/:countryCode', async (req, res) => {
            try {
                const serverId = parseInt(req.params.serverId);
                const countryCode = req.params.countryCode.toLowerCase();
                
                const numbers = await this.controller.scrapeFromServer(serverId, countryCode);
                
                res.json({
                    success: true,
                    serverId: serverId,
                    countryCode: countryCode,
                    total: numbers.length,
                    numbers: numbers
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.get('/api/sms/:serverId/:number', async (req, res) => {
            try {
                const serverId = parseInt(req.params.serverId);
                const number = req.params.number;
                const countryCode = req.query.country || 'us';
                
                const messages = await this.controller.getSMSFromServer(serverId, number, countryCode);
                
                res.json({
                    success: true,
                    serverId: serverId,
                    number: number,
                    total: messages.length,
                    messages: messages
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.get('/api/stats', (req, res) => {
            try {
                const stats = this.controller.getStats();
                res.json({
                    success: true,
                    stats: stats
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found'
            });
        });

        this.app.use((err, req, res, next) => {
            console.error('❌ API Error:', err);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        });
    }

    start() {
        this.app.listen(this.config.API_PORT, () => {
            console.log(`🚀 API Server started on port ${this.config.API_PORT}`);
            console.log(`📡 API URL: http://localhost:${this.config.API_PORT}`);
            console.log(`🔑 API Key: ${this.config.API_KEY}`);
        });
    }
}

module.exports = APIServer;
