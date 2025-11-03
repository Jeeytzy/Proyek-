const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const config = require('./config');
const Controller = require('./core/controller');
const APIServer = require('./api/server');
const FavoriteManager = require('./features/favorite-manager');
const SearchManager = require('./features/search-manager');
const BulkManager = require('./features/bulk-manager');
const RatingManager = require('./features/rating-manager');
const WebhookManager = require('./features/webhook-manager');
const ExportManager = require('./features/export-manager');

class NokosBot {
    constructor() {
        this.config = config;
        this.bot = new TelegramBot(this.config.BOT_TOKEN, { 
            polling: {
                interval: 300,
                autoStart: true,
                params: { timeout: 10 }
            }
        });
        this.controller = new Controller(config);
        
        // Initialize all managers
        this.favoriteManager = new FavoriteManager();
        this.searchManager = new SearchManager(this.controller);
        this.bulkManager = new BulkManager(this.controller);
        this.ratingManager = new RatingManager();
        this.webhookManager = new WebhookManager();
        this.exportManager = new ExportManager();
        
        this.userSessions = new Map();
        this.processingCallbacks = new Set();
        this.messageTracker = new Map(); // Track messages untuk auto delete
        
        this.OPERATION_TIMEOUT = 60000;
        
        // Start API Server if enabled
        if (config.API_ENABLED) {
            this.apiServer = new APIServer(this.controller, config);
            this.apiServer.start();
        }
        
        this.setupHandlers();
        this.setupErrorHandling();
        this.startSessionCleaner();
        this.startAutoDeleteCleaner();
        
        console.log('🤖 NOKOS Bot V3.0 - FULL FEATURES Started!');
        console.log('🌐 Servers: 100 (Each = 1 Platform)');
        console.log('🌍 Countries: 250');
        console.log('📱 Social Media Detection: 100+');
        console.log('🚀 API Server: ' + (config.API_ENABLED ? 'ENABLED on port ' + config.API_PORT : 'DISABLED'));
        console.log('✅ All Features Ready!');
    }

    setupHandlers() {
        // Command handlers
        this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
        this.bot.onText(/\/stats/, (msg) => this.handleStats(msg));
        this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
        this.bot.onText(/\/api/, (msg) => this.handleAPIInfo(msg));
        this.bot.onText(/\/favorite (.+)/, (msg, match) => this.handleFavorite(msg, match));
        this.bot.onText(/\/search (.+)/, (msg, match) => this.handleSearch(msg, match));
        this.bot.onText(/\/bulk (.+)/, (msg, match) => this.handleBulk(msg, match));
        this.bot.onText(/\/export (.+)/, (msg, match) => this.handleExport(msg, match));
        this.bot.onText(/\/mystats/, (msg) => this.handleMyStats(msg));
        this.bot.onText(/\/clear/, (msg) => this.handleClearChat(msg));
        
        // Callback query handler
        this.bot.on('callback_query', (query) => this.handleCallback(query));
    }

    setupErrorHandling() {
        this.bot.on('polling_error', (error) => {
            console.error('❌ Polling error:', error.code, error.message);
        });

        this.bot.on('error', (error) => {
            console.error('❌ Bot error:', error);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise);
            console.error('Reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            console.error('Stack:', error.stack);
        });

        setInterval(() => {
            console.log('💓 Bot heartbeat - Still running...');
        }, 60000);
    }

    startSessionCleaner() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            for (const [userId, session] of this.userSessions.entries()) {
                if (now - session.timestamp > 1800000) {
                    this.userSessions.delete(userId);
                    cleaned++;
                }
            }
            if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} old sessions`);
        }, 900000);
    }

    startAutoDeleteCleaner() {
        if (!this.config.AUTO_DELETE_ENABLED) return;
        
        setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.messageTracker.entries()) {
                if (now - data.timestamp > this.config.AUTO_DELETE_DELAY) {
                    this.bot.deleteMessage(data.chatId, data.messageId).catch(() => {});
                    this.messageTracker.delete(key);
                }
            }
        }, 30000); // Check every 30 seconds
    }

    trackMessageForAutoDelete(chatId, messageId, menuType) {
        // Only track specific menus (not /start)
        const autoDeleteMenus = ['servers', 'countries', 'numbers', 'sms', 'search', 'bulk', 'export'];
        if (autoDeleteMenus.includes(menuType)) {
            const key = `${chatId}_${messageId}`;
            this.messageTracker.set(key, {
                chatId: chatId,
                messageId: messageId,
                timestamp: Date.now(),
                menuType: menuType
            });
        }
    }

    async withTimeout(promise, timeoutMs = this.OPERATION_TIMEOUT) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
            )
        ]);
    }

    async safeEditMessage(chatId, messageId, text, options = {}) {
        try {
            return await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
        } catch (error) {
            if (error.message.includes('message is not modified')) {
                console.log('⚠️ Message not modified (same content)');
                return;
            }
            
            if (error.message.includes('message to edit not found')) {
                console.log('⚠️ Message not found, sending new message');
                return await this.bot.sendMessage(chatId, text, options);
            }
            
            if (error.message.includes("message can't be edited")) {
                console.log('⚠️ Message too old, sending new message');
                return await this.bot.sendMessage(chatId, text, options);
            }
            
            throw error;
        }
    }

    async sendPhotoMessage(chatId, text, options = {}) {
        try {
            if (this.config.BOT_IMAGE) {
                return await this.bot.sendPhoto(chatId, this.config.BOT_IMAGE, {
                    caption: text,
                    parse_mode: 'Markdown',
                    ...options
                });
            } else {
                return await this.bot.sendMessage(chatId, text, {
                    parse_mode: 'Markdown',
                    ...options
                });
            }
        } catch (error) {
            console.error('❌ Send photo error:', error.message);
            return await this.bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                ...options
            });
        }
    }

    async handleStart(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '🌐 Select Server (100 Servers)', callback_data: 'select_server_0' }],
                [
                    { text: '⭐ My Favorites', callback_data: 'my_favorites' },
                    { text: '🔍 Search', callback_data: 'search_menu' }
                ],
                [
                    { text: '📊 My Statistics', callback_data: 'my_stats' },
                    { text: '📡 API Info', callback_data: 'api_info' }
                ],
                [
                    { text: '🚀 Bulk Request', callback_data: 'bulk_menu' },
                    { text: '💾 Export Data', callback_data: 'export_menu' }
                ],
                [{ text: 'ℹ️ Help', callback_data: 'help' }]
            ]
        };

        if (userId.toString() === this.config.OWNER_ID) {
            keyboard.inline_keyboard.push([{ text: '👑 Owner Panel', callback_data: 'owner_panel' }]);
        }

        const welcomeText = 
            `🎉 *WELCOME TO NOKOS BOT V3.0* 🎉\n\n` +
            `🌐 *ENTERPRISE FEATURES:*\n\n` +
            `✅ 100 Dedicated Servers\n` +
            `✅ 250 Countries Available\n` +
            `✅ 100+ Social Media Detection\n` +
            `✅ API Access for Developers\n` +
            `✅ Favorite Numbers Management\n` +
            `✅ Advanced Search & Filter\n` +
            `✅ Bulk Operations Support\n` +
            `✅ Real-time Number Rating\n` +
            `✅ Webhook Integration\n` +
            `✅ Data Export (JSON/CSV)\n` +
            `✅ Personal Statistics\n` +
            `✅ Auto-Retry Smart System\n\n` +
            `👤 User: ${msg.from.first_name}\n` +
            `🆔 ID: \`${userId}\`\n\n` +
            `🎯 *QUICK START:*\n` +
            `1️⃣ Select Server → Country → Number\n` +
            `2️⃣ Use /favorite to save numbers\n` +
            `3️⃣ Use /search to find specific SMS\n` +
            `4️⃣ Use /api to get API access\n\n` +
            `⚡ *Creator:* @Jeeyhosting`;

        await this.sendPhotoMessage(chatId, welcomeText, { reply_markup: keyboard });
    }

    async handleCallback(query) {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        const userId = query.from.id;

        console.log(`🔥 Callback received: ${data} from user ${userId}`);

        const callbackKey = `${chatId}_${data}`;
        
        if (this.processingCallbacks.has(callbackKey)) {
            await this.bot.answerCallbackQuery(query.id, {
                text: '⏳ Processing...',
                show_alert: false
            }).catch(err => console.error('Answer callback error:', err));
            return;
        }

        this.processingCallbacks.add(callbackKey);

        await this.bot.answerCallbackQuery(query.id).catch(err => {
            console.error('❌ Answer callback error:', err);
        });

        try {
            console.log(`🔄 Processing: ${data}`);

            if (data === 'page_info') {
                return;
            }
            else if (data.startsWith('select_server_')) {
                const page = parseInt(data.split('_')[2]);
                await this.showServers(chatId, messageId, page);
                this.trackMessageForAutoDelete(chatId, messageId, 'servers');
            }
            else if (data.startsWith('server_')) {
                const serverId = parseInt(data.split('_')[1]);
                await this.selectServer(chatId, messageId, serverId, userId);
                this.trackMessageForAutoDelete(chatId, messageId, 'servers');
            }
            else if (data.startsWith('countries_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[1]);
                const page = parseInt(parts[2]);
                await this.showCountries(chatId, messageId, serverId, page, userId);
                this.trackMessageForAutoDelete(chatId, messageId, 'countries');
            }
            else if (data.startsWith('country_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[1]);
                const countryCode = parts[2];
                await this.scrapeCountry(chatId, messageId, serverId, countryCode, userId);
                this.trackMessageForAutoDelete(chatId, messageId, 'numbers');
            }
            else if (data.startsWith('numbers_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[1]);
                const countryCode = parts[2];
                const page = parseInt(parts[3]);
                await this.showNumbers(chatId, messageId, serverId, countryCode, page, userId);
                this.trackMessageForAutoDelete(chatId, messageId, 'numbers');
            }
            else if (data.startsWith('select_number_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[2]);
                const countryCode = parts[3];
                const number = parts.slice(4).join('_');
                await this.selectNumber(chatId, messageId, serverId, number, countryCode, userId);
                this.trackMessageForAutoDelete(chatId, messageId, 'sms');
            }
            else if (data.startsWith('refresh_sms_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[2]);
                const countryCode = parts[3];
                const number = parts.slice(4).join('_');
                await this.refreshSMS(chatId, messageId, serverId, number, countryCode, userId);
                this.trackMessageForAutoDelete(chatId, messageId, 'sms');
            }
            else if (data.startsWith('add_favorite_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[2]);
                const countryCode = parts[3];
                const number = parts.slice(4).join('_');
                await this.addToFavorites(chatId, messageId, userId, serverId, number, countryCode);
            }
            else if (data === 'my_favorites') {
                await this.showFavorites(chatId, messageId, userId, 0);
            }
            else if (data.startsWith('favorites_page_')) {
                const page = parseInt(data.split('_')[2]);
                await this.showFavorites(chatId, messageId, userId, page);
            }
            else if (data.startsWith('use_favorite_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[2]);
                const countryCode = parts[3];
                const number = parts.slice(4).join('_');
                await this.selectNumber(chatId, messageId, serverId, number, countryCode, userId);
            }
            else if (data.startsWith('remove_favorite_')) {
                const number = data.split('_').slice(2).join('_');
                await this.removeFavorite(chatId, messageId, userId, number);
            }
            else if (data === 'search_menu') {
                await this.showSearchMenu(chatId, messageId);
            }
            else if (data === 'bulk_menu') {
                await this.showBulkMenu(chatId, messageId);
            }
            else if (data === 'export_menu') {
                await this.showExportMenu(chatId, messageId);
            }
            else if (data === 'my_stats') {
                await this.showMyStats(chatId, messageId, userId);
            }
            else if (data === 'api_info') {
                await this.showAPIInfo(chatId, messageId, userId);
            }
            else if (data === 'help') {
                await this.showHelp(chatId, messageId);
            }
            else if (data === 'owner_panel' && userId.toString() === this.config.OWNER_ID) {
                await this.showOwnerPanel(chatId, messageId);
            }
            else if (data === 'clear_cache' && userId.toString() === this.config.OWNER_ID) {
                this.controller.clearCache();
                await this.showOwnerPanel(chatId, messageId);
            }
            else if (data === 'back_main') {
                await this.bot.deleteMessage(chatId, messageId).catch(() => {});
                await this.handleStart({ chat: { id: chatId }, from: query.from });
            }
            else if (data.startsWith('back_server_')) {
                const serverId = parseInt(data.split('_')[2]);
                await this.selectServer(chatId, messageId, serverId, userId);
            }
            else {
                console.log(`⚠️ Unknown callback data: ${data}`);
            }

            console.log(`✅ Callback processed: ${data}`);

        } catch (error) {
            console.error('❌ Callback error:', error);
            console.error('Stack:', error.stack);
            
            try {
                await this.bot.sendMessage(chatId, 
                    `❌ *ERROR*\n\n` +
                    `Data: ${data}\n` +
                    `Error: ${error.message}\n\n` +
                    `Type /start to restart.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        } finally {
            setTimeout(() => {
                this.processingCallbacks.delete(callbackKey);
                console.log(`🧹 Cleared callback: ${callbackKey}`);
            }, 2000);
        }
    }

    async showServers(chatId, messageId, page = 0) {
        const servers = this.config.PLATFORMS;
        const perPage = 10;
        const totalPages = Math.ceil(servers.length / perPage);
        
        const startIdx = page * perPage;
        const endIdx = startIdx + perPage;
        const pageServers = servers.slice(startIdx, endIdx);

        const keyboard = {
            inline_keyboard: []
        };

        for (let i = 0; i < pageServers.length; i += 2) {
            const row = [];
            row.push({
                text: `🌐 Server ${pageServers[i].id}`,
                callback_data: `server_${pageServers[i].id}`
            });
            if (i + 1 < pageServers.length) {
                row.push({
                    text: `🌐 Server ${pageServers[i + 1].id}`,
                    callback_data: `server_${pageServers[i + 1].id}`
                });
            }
            keyboard.inline_keyboard.push(row);
        }

        const navButtons = [];
        if (page > 0) {
            navButtons.push({ text: '⬅️ Prev', callback_data: `select_server_${page - 1}` });
        }
        navButtons.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'page_info' });
        if (page < totalPages - 1) {
            navButtons.push({ text: 'Next ➡️', callback_data: `select_server_${page + 1}` });
        }
        
        if (navButtons.length > 0) {
            keyboard.inline_keyboard.push(navButtons);
        }

        keyboard.inline_keyboard.push([{ text: '🏠 Main Menu', callback_data: 'back_main' }]);

        const text = 
            `🌐 *SELECT SERVER*\n\n` +
            `📊 Total: 100 Servers Available\n` +
            `📄 Page: ${page + 1}/${totalPages}\n\n` +
            `✅ 1 Server = 1 Platform\n` +
            `✅ 250 Countries per Server\n` +
            `✅ Different numbers each server\n\n` +
            `Select a server to continue:`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async selectServer(chatId, messageId, serverId, userId) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        
        if (!server) {
            await this.safeEditMessage(chatId, messageId, '❌ Server not found');
            return;
        }

        let session = this.userSessions.get(userId) || {};
        session.serverId = serverId;
        session.serverName = server.name;
        session.timestamp = Date.now();
        this.userSessions.set(userId, session);

        const serverInfo = this.controller.getServerInfo(serverId);
        const rating = this.ratingManager.getServerRating(serverId);

        const keyboard = {
            inline_keyboard: [
                [{ text: '🌍 Select Country (250 Countries)', callback_data: `countries_${serverId}_0` }],
                [
                    { text: '🔙 Other Servers', callback_data: 'select_server_0' },
                    { text: '🏠 Main Menu', callback_data: 'back_main' }
                ]
            ]
        };

        const text = 
            `🌐 *SERVER ${serverId} SELECTED*\n\n` +
            `📱 Platform: ${server.name}\n` +
            `🖥️ Server: ${server.server}\n` +
            `🌍 Countries: 250 Available\n` +
            `🔗 URL: ${server.url}\n` +
            `⭐ Rating: ${rating.stars} (${rating.successRate})\n\n` +
            `✅ *Server Info:*\n` +
            `• 250 countries available\n` +
            `• Different numbers from other servers\n` +
            `• All social media detection\n` +
            `• Real-time SMS updates\n\n` +
            `Continue to select country:`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showCountries(chatId, messageId, serverId, page, userId) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        if (!server) {
            await this.safeEditMessage(chatId, messageId, '❌ Server not found');
            return;
        }

        const countries = this.config.COUNTRIES;
        const perPage = this.config.COUNTRIES_PER_PAGE;
        const totalPages = Math.ceil(countries.length / perPage);
        
        const startIdx = page * perPage;
        const endIdx = startIdx + perPage;
        const pageCountries = countries.slice(startIdx, endIdx);

        const keyboard = {
            inline_keyboard: []
        };

        for (let i = 0; i < pageCountries.length; i += 2) {
            const row = [];
            row.push({
                text: `${pageCountries[i].flag} ${pageCountries[i].name}`,
                callback_data: `country_${serverId}_${pageCountries[i].code}`
            });
            if (i + 1 < pageCountries.length) {
                row.push({
                    text: `${pageCountries[i + 1].flag} ${pageCountries[i + 1].name}`,
                    callback_data: `country_${serverId}_${pageCountries[i + 1].code}`
                });
            }
            keyboard.inline_keyboard.push(row);
        }

        const navButtons = [];
        if (page > 0) {
            navButtons.push({ text: '⬅️ Prev', callback_data: `countries_${serverId}_${page - 1}` });
        }
        navButtons.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'page_info' });
        if (page < totalPages - 1) {
            navButtons.push({ text: 'Next ➡️', callback_data: `countries_${serverId}_${page + 1}` });
        }
        
        if (navButtons.length > 0) {
            keyboard.inline_keyboard.push(navButtons);
        }

        keyboard.inline_keyboard.push([
            { text: '🔙 Back to Server', callback_data: `back_server_${serverId}` },
            { text: '🏠 Main Menu', callback_data: 'back_main' }
        ]);

        const text = 
            `🌍 *SELECT COUNTRY*\n\n` +
            `🌐 Server: ${serverId} (${server.name})\n` +
            `📊 Total: ${countries.length} countries\n` +
            `📄 Page: ${page + 1}/${totalPages}\n\n` +
            `✅ Numbers from selected country\n` +
            `✅ Different from other servers\n\n` +
            `Select a country:`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async scrapeCountry(chatId, messageId, serverId, countryCode, userId) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        const country = this.config.COUNTRIES.find(c => c.code === countryCode);
        
        if (!server || !country) {
            await this.safeEditMessage(chatId, messageId, '❌ Server or country not found');
            return;
        }

        await this.safeEditMessage(chatId, messageId,
            `⏳ *SEARCHING FOR NUMBERS...*\n\n` +
            `🌐 Server: ${serverId} (${server.name})\n` +
            `🌍 Country: ${country.flag} ${country.name}\n` +
            `📞 Dial Code: ${country.dialCode}\n` +
            `🖥️ Server: ${server.server}\n\n` +
            `🔍 Scraping from this server...\n` +
            `✅ Only ${country.name} numbers\n\n` +
            `⚡ Please wait 10-30 seconds...`,
            { parse_mode: 'Markdown' }
        );

        try {
            const numbers = await this.withTimeout(
                this.controller.scrapeFromServer(serverId, countryCode),
                60000
            );

            if (numbers.length === 0) {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: `country_${serverId}_${countryCode}` }],
                        [{ text: '🌍 Other Country', callback_data: `countries_${serverId}_0` }],
                        [{ text: '🌐 Other Server', callback_data: 'select_server_0' }]
                    ]
                };

                await this.safeEditMessage(chatId, messageId,
                    `❌ *NO NUMBERS FOUND*\n\n` +
                    `🌐 Server: ${serverId}\n` +
                    `🌍 Country: ${country.flag} ${country.name}\n` +
                    `📊 Result: 0 numbers\n\n` +
                    `💡 Try another server or country`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
                return;
            }

            // Rate numbers
            numbers.forEach(num => {
                this.ratingManager.rateNumber(num.number, true);
            });

            let session = this.userSessions.get(userId) || {};
            session.serverId = serverId;
            session.countryCode = countryCode;
            session.numbers = numbers;
            session.timestamp = Date.now();
            this.userSessions.set(userId, session);

            await this.showNumbers(chatId, messageId, serverId, countryCode, 0, userId);

        } catch (error) {
            console.error('❌ Scrape error:', error);
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔄 Try Again', callback_data: `country_${serverId}_${countryCode}` }],
                    [{ text: '🌍 Other Country', callback_data: `countries_${serverId}_0` }],
                    [{ text: '🌐 Other Server', callback_data: 'select_server_0' }]
                ]
            };

            if (error.message === 'Operation timeout') {
                await this.safeEditMessage(chatId, messageId,
                    `⏰ *TIMEOUT*\n\n` +
                    `Scraping took too long.\n` +
                    `Please try again or select another server.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            } else {
                await this.safeEditMessage(chatId, messageId,
                    `❌ *ERROR*\n\n${error.message}\n\nPlease try again.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            }
        }
    }

    async showNumbers(chatId, messageId, serverId, countryCode, page, userId) {
        const session = this.userSessions.get(userId);
        
        if (!session || session.serverId !== serverId || session.countryCode !== countryCode) {
            await this.safeEditMessage(chatId, messageId, '❌ Session expired. Select server & country again.');
            return;
        }

        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        const country = this.config.COUNTRIES.find(c => c.code === countryCode);
        const numbers = session.numbers;
        const perPage = this.config.NUMBERS_PER_PAGE;
        const totalPages = Math.ceil(numbers.length / perPage);
        
        const startIdx = page * perPage;
        const endIdx = startIdx + perPage;
        const pageNumbers = numbers.slice(startIdx, endIdx);

        const keyboard = {
            inline_keyboard: []
        };

        pageNumbers.forEach((item) => {
            const rating = this.ratingManager.getNumberRating(item.number);
            const displayNumber = item.number.length > 15
                ? item.number.substring(0, 15) + '...' 
                : item.number;
            
            keyboard.inline_keyboard.push([{
                text: `📱 ${displayNumber} ${rating.stars}`,
                callback_data: `select_number_${serverId}_${countryCode}_${item.number}`
            }]);
        });

        const navButtons = [];
        if (page > 0) {
            navButtons.push({ text: '⬅️ Prev', callback_data: `numbers_${serverId}_${countryCode}_${page - 1}` });
        }
        navButtons.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'page_info' });
        if (page < totalPages - 1) {
            navButtons.push({ text: 'Next ➡️', callback_data: `numbers_${serverId}_${countryCode}_${page + 1}` });
        }
        
        if (navButtons.length > 0) {
            keyboard.inline_keyboard.push(navButtons);
        }

        keyboard.inline_keyboard.push([
            { text: '🔄 Refresh', callback_data: `country_${serverId}_${countryCode}` },
            { text: '🌍 Other Country', callback_data: `countries_${serverId}_0` }
        ]);

        const text = 
            `✅ *NUMBERS FOUND!*\n\n` +
            `🌐 Server: ${serverId} (${server.name})\n` +
            `🌍 Country: ${country.flag} ${country.name}\n` +
            `📞 Dial Code: ${country.dialCode}\n` +
            `📊 Total: ${numbers.length} numbers\n` +
            `📄 Page: ${page + 1}/${totalPages}\n\n` +
            `✅ Only ${country.name} numbers\n` +
            `✅ Server ${serverId} exclusive\n` +
            `⭐ Star rating = success rate\n\n` +
            `📱 Select a number:`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async selectNumber(chatId, messageId, serverId, number, countryCode, userId) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        const country = this.config.COUNTRIES.find(c => c.code === countryCode);

        await this.safeEditMessage(chatId, messageId,
            `⏳ *FETCHING SMS...*\n\n` +
            `🌐 Server: ${serverId}\n` +
            `📱 Number: ${number}\n` +
            `🌍 Country: ${country.flag} ${country.name}\n\n` +
            `⚡ Please wait...`,
            { parse_mode: 'Markdown' }
        );

        try {
            const messages = await this.controller.getSMSFromServer(serverId, number, countryCode);

            if (messages.length === 0) {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔄 Refresh SMS', callback_data: `refresh_sms_${serverId}_${countryCode}_${number}` }],
                        [{ text: '⭐ Add to Favorites', callback_data: `add_favorite_${serverId}_${countryCode}_${number}` }],
                        [{ text: '📱 Other Numbers', callback_data: `numbers_${serverId}_${countryCode}_0` }]
                    ]
                };

                await this.safeEditMessage(chatId, messageId,
                    `🔭 *NO SMS YET*\n\n` +
                    `📱 Use this number for registration\n` +
                    `🔄 Refresh after registration\n` +
                    `⏰ SMS arrives in 1-5 minutes\n\n` +
                    `💡 Tip: Add to favorites for quick access!`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
                return;
            }

            // Update rating
            this.ratingManager.rateNumber(number, true);
            this.ratingManager.rateServer(serverId, true);

            await this.showSMS(chatId, messageId, serverId, number, messages, server, country, countryCode);

        } catch (error) {
            console.error('❌ Get SMS error:', error);
            
            // Update rating
            this.ratingManager.rateNumber(number, false);
            this.ratingManager.rateServer(serverId, false);
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔄 Try Again', callback_data: `select_number_${serverId}_${countryCode}_${number}` }]
                ]
            };

            await this.safeEditMessage(chatId, messageId,
                `❌ *ERROR*\n\n${error.message}`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
        }
    }

    async showSMS(chatId, messageId, serverId, number, messages, server, country, countryCode) {
        let text = 
            `📨 *SMS RECEIVED!*\n\n` +
            `🌐 Server: ${serverId} (${server.name})\n` +
            `📱 Number: \`${number}\`\n` +
            `🌍 Country: ${country.flag} ${country.name}\n` +
            `📊 Total: ${messages.length} SMS\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n\n`;

        messages.slice(0, 10).forEach((msg, idx) => {
            const detected = msg.detected || { icon: '📱', name: 'Unknown' };
            
            text += `${idx + 1}. ${detected.icon} *${detected.name.toUpperCase()}*\n`;
            text += `   ━━━━━━━━━━━━━━━━━━\n`;
            text += `   🔑 Code: \`${msg.code}\`\n`;
            
            if (msg.copyableText) {
                text += `   📋 Copy: \`${msg.copyableText}\`\n`;
            }
            
            text += `   ⏰ ${msg.time}\n`;
            
            if (msg.from && msg.from !== 'Unknown') {
                text += `   📤 From: ${msg.from}\n`;
            }
            
            text += `\n`;
        });

        if (messages.length > 10) {
            text += `... and ${messages.length - 10} more SMS\n\n`;
        }

        text += `━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `💡 *HOW TO USE:*\n`;
        text += `1. Look at platform name (e.g., WHATSAPP)\n`;
        text += `2. Copy the corresponding code\n`;
        text += `3. Paste in the same app\n\n`;
        text += `⭐ Add to favorites for quick access!`;

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🔄 Refresh SMS', callback_data: `refresh_sms_${serverId}_${countryCode}_${number}` },
                    { text: '⭐ Add Favorite', callback_data: `add_favorite_${serverId}_${countryCode}_${number}` }
                ],
                [{ text: '📱 Other Numbers', callback_data: `numbers_${serverId}_${countryCode}_0` }],
                [{ text: '🌍 Other Country', callback_data: `countries_${serverId}_0` }],
                [{ text: '🌐 Other Server', callback_data: 'select_server_0' }]
            ]
        };

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async refreshSMS(chatId, messageId, serverId, number, countryCode, userId) {
        await this.selectNumber(chatId, messageId, serverId, number, countryCode, userId);
    }

    async addToFavorites(chatId, messageId, userId, serverId, number, countryCode) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        const country = this.config.COUNTRIES.find(c => c.code === countryCode);
        
        const result = this.favoriteManager.addFavorite(userId, {
            number: number,
            serverId: serverId,
            serverName: server.name,
            countryCode: countryCode,
            countryName: country.name,
            countryFlag: country.flag,
            addedAt: new Date().toISOString()
        });

        if (result.success) {
            await this.bot.answerCallbackQuery(messageId, {
                text: '⭐ Added to favorites!',
                show_alert: true
            });
        } else {
            await this.bot.answerCallbackQuery(messageId, {
                text: '⚠️ Already in favorites!',
                show_alert: true
            });
        }
    }

    async showFavorites(chatId, messageId, userId, page = 0) {
        const favorites = this.favoriteManager.getFavorites(userId);
        
        if (favorites.length === 0) {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🌐 Browse Servers', callback_data: 'select_server_0' }],
                    [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
                ]
            };

            await this.safeEditMessage(chatId, messageId,
                `⭐ *MY FAVORITES*\n\n` +
                `You have no favorite numbers yet.\n\n` +
                `Add numbers to favorites for quick access!`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                }
            );
            return;
        }

        const perPage = 10;
        const totalPages = Math.ceil(favorites.length / perPage);
        const startIdx = page * perPage;
        const endIdx = startIdx + perPage;
        const pageFavorites = favorites.slice(startIdx, endIdx);

        const keyboard = {
            inline_keyboard: []
        };

        pageFavorites.forEach((fav) => {
            const rating = this.ratingManager.getNumberRating(fav.number);
            keyboard.inline_keyboard.push([
                {
                    text: `${fav.countryFlag} ${fav.number} ${rating.stars}`,
                    callback_data: `use_favorite_${fav.serverId}_${fav.countryCode}_${fav.number}`
                },
                {
                    text: '🗑️',
                    callback_data: `remove_favorite_${fav.number}`
                }
            ]);
        });

        const navButtons = [];
        if (page > 0) {
            navButtons.push({ text: '⬅️ Prev', callback_data: `favorites_page_${page - 1}` });
        }
        navButtons.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: 'page_info' });
        if (page < totalPages - 1) {
            navButtons.push({ text: 'Next ➡️', callback_data: `favorites_page_${page + 1}` });
        }
        
        if (navButtons.length > 0) {
            keyboard.inline_keyboard.push(navButtons);
        }

        keyboard.inline_keyboard.push([{ text: '🏠 Main Menu', callback_data: 'back_main' }]);

        const text = 
            `⭐ *MY FAVORITES*\n\n` +
            `📊 Total: ${favorites.length} numbers\n` +
            `📄 Page: ${page + 1}/${totalPages}\n\n` +
            `Click number to use, 🗑️ to remove\n` +
            `⭐ Star rating shows success rate`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async removeFavorite(chatId, messageId, userId, number) {
        this.favoriteManager.removeFavorite(userId, number);
        await this.showFavorites(chatId, messageId, userId, 0);
    }

    async showSearchMenu(chatId, messageId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '🔍 Search by Service (WhatsApp, etc)', callback_data: 'search_service' }],
                [{ text: '🔢 Search by Code (123456)', callback_data: 'search_code' }],
                [{ text: '📱 Search by Number', callback_data: 'search_number' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        const text = 
            `🔍 *SEARCH MENU*\n\n` +
            `Search your SMS history:\n\n` +
            `1️⃣ By Service - Find all WhatsApp, Telegram, etc\n` +
            `2️⃣ By Code - Find specific verification code\n` +
            `3️⃣ By Number - Find SMS from specific number\n\n` +
            `Use commands:\n` +
            `/search whatsapp - Search by service\n` +
            `/search 123456 - Search by code`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showBulkMenu(chatId, messageId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '📦 Request 5 Numbers', callback_data: 'bulk_5' }],
                [{ text: '📦 Request 10 Numbers', callback_data: 'bulk_10' }],
                [{ text: '📦 Request 20 Numbers', callback_data: 'bulk_20' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        const text = 
            `🚀 *BULK REQUEST MENU*\n\n` +
            `Request multiple numbers at once!\n\n` +
            `✅ Perfect for testing\n` +
            `✅ Load testing\n` +
            `✅ Multiple accounts\n\n` +
            `Use command:\n` +
            `/bulk 1 us 5\n` +
            `Format: /bulk {server} {country} {count}\n\n` +
            `Example: Request 5 US numbers from server 1`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showExportMenu(chatId, messageId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '📄 Export as JSON', callback_data: 'export_json' }],
                [{ text: '📊 Export as CSV', callback_data: 'export_csv' }],
                [{ text: '💾 Backup Favorites', callback_data: 'export_favorites' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        const text = 
            `💾 *EXPORT DATA MENU*\n\n` +
            `Export your data:\n\n` +
            `1️⃣ JSON - For developers\n` +
            `2️⃣ CSV - For Excel/Sheets\n` +
            `3️⃣ Backup - Save favorites\n\n` +
            `Use command:\n` +
            `/export json - Export to JSON\n` +
            `/export csv - Export to CSV\n` +
            `/export favorites - Backup favorites`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showMyStats(chatId, messageId, userId) {
        const stats = this.favoriteManager.getUserStats(userId);
        const favorites = this.favoriteManager.getFavorites(userId);
        
        let mostUsedCountry = 'N/A';
        if (favorites.length > 0) {
            const countryCounts = {};
            favorites.forEach(fav => {
                countryCounts[fav.countryName] = (countryCounts[fav.countryName] || 0) + 1;
            });
            mostUsedCountry = Object.keys(countryCounts).reduce((a, b) => 
                countryCounts[a] > countryCounts[b] ? a : b
            );
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔄 Refresh', callback_data: 'my_stats' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        const text = 
            `📊 *YOUR STATISTICS*\n\n` +
            `⭐ *Favorites:* ${stats.totalFavorites}\n` +
            `🌍 *Most Used Country:* ${mostUsedCountry}\n` +
            `📅 *Member Since:* Recently\n\n` +
            `✅ Keep using NOKOS for better stats!\n` +
            `✅ Add favorites for tracking`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showAPIInfo(chatId, messageId, userId) {
        if (!this.config.API_ENABLED) {
            await this.safeEditMessage(chatId, messageId,
                `📡 *API ACCESS*\n\n` +
                `API is currently disabled.\n` +
                `Contact admin for access.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const apiKey = this.config.API_KEY;
        const apiUrl = `http://localhost:${this.config.API_PORT}`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '📖 API Documentation', callback_data: 'api_docs' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        const text = 
            `📡 *API ACCESS*\n\n` +
            `🔗 Base URL: \`${apiUrl}\`\n` +
            `🔑 API Key: \`${apiKey}\`\n\n` +
            `✅ *Available Endpoints:*\n\n` +
            `GET /api/servers\n` +
            `GET /api/countries/{server}\n` +
            `GET /api/numbers/{server}/{country}\n` +
            `GET /api/sms/{server}/{number}\n\n` +
            `📖 *Example Usage:*\n` +
            `\`\`\`\n` +
            `curl -H "X-API-Key: ${apiKey}" \\\n` +
            `  ${apiUrl}/api/servers\n` +
            `\`\`\`\n\n` +
            `💡 Perfect for automation & CI/CD!`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showHelp(chatId, messageId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        const text = 
            `ℹ️ *HELP & COMMANDS*\n\n` +
            `🎯 *Basic Flow:*\n` +
            `1️⃣ Select Server (1-100)\n` +
            `2️⃣ Select Country (250 countries)\n` +
            `3️⃣ Select Number\n` +
            `4️⃣ View SMS\n\n` +
            `📱 *Commands:*\n` +
            `/start - Main menu\n` +
            `/favorite add {number} - Add favorite\n` +
            `/favorite list - List favorites\n` +
            `/search {keyword} - Search SMS\n` +
            `/bulk {server} {country} {count} - Bulk request\n` +
            `/export json - Export data\n` +
            `/mystats - Your statistics\n` +
            `/api - API information\n` +
            `/clear - Clear chat history\n` +
            `/help - This help\n\n` +
            `✅ *Features:*\n` +
            `• 100 Servers (1 per platform)\n` +
            `• 250 Countries per server\n` +
            `• 100+ Social media detection\n` +
            `• Favorite numbers management\n` +
            `• Advanced search & filter\n` +
            `• Bulk operations\n` +
            `• Number rating system\n` +
            `• API for developers\n` +
            `• Data export (JSON/CSV)\n` +
            `• Auto-delete messages\n` +
            `• Real-time updates\n\n` +
            `💡 *Tips:*\n` +
            `• Platform names shown in CAPITALS\n` +
            `• Star ⭐ = Success rate\n` +
            `• Add favorites for quick access\n` +
            `• Use bulk for testing\n` +
            `• Export data regularly\n\n` +
            `👨‍💻 Creator: @Jeeyhosting`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showOwnerPanel(chatId, messageId) {
        const stats = this.controller.getStats();
        const totalUsers = this.userSessions.size;
        const totalFavorites = this.favoriteManager.getTotalFavorites();
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '🗑️ Clear Cache', callback_data: 'clear_cache' }],
                [{ text: '🔄 Reset Workers', callback_data: 'reset_workers' }],
                [{ text: '📊 Full Stats', callback_data: 'full_stats' }],
                [{ text: '🔄 Refresh', callback_data: 'owner_panel' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        const text = 
            `👑 *OWNER PANEL*\n\n` +
            `📊 *System Stats:*\n` +
            `🌐 Servers: ${stats.platforms}\n` +
            `🌍 Countries: ${stats.countries}\n` +
            `💾 Cache: ${stats.cache.size} items\n` +
            `👥 Active Users: ${totalUsers}\n` +
            `⭐ Total Favorites: ${totalFavorites}\n` +
            `💬 Social Media: ${stats.socialMedia}+\n\n` +
            `⚙️ *Workers:*\n` +
            `Total: ${stats.workers.total}\n` +
            `Active: ${stats.workers.active}\n` +
            `Idle: ${stats.workers.idle}\n` +
            `Error: ${stats.workers.error}\n\n` +
            `💾 *Cache:*\n` +
            `Hit Rate: ${stats.cache.hitRate}\n` +
            `Size: ${stats.cache.totalSize}\n\n` +
            `✅ System: Online & Healthy`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async handleFavorite(msg, match) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const args = match[1].split(' ');
        const command = args[0];

        if (command === 'list') {
            const sent = await this.bot.sendMessage(chatId, '⏳ Loading favorites...');
            await this.showFavorites(chatId, sent.message_id, userId, 0);
        } else if (command === 'add' && args[1]) {
            await this.bot.sendMessage(chatId, 
                `⚠️ Use the "⭐ Add Favorite" button when viewing a number!`,
                { parse_mode: 'Markdown' }
            );
        } else {
            await this.bot.sendMessage(chatId,
                `📖 *Favorite Commands:*\n\n` +
                `/favorite list - Show all favorites\n` +
                `Use ⭐ button to add favorites`,
                { parse_mode: 'Markdown' }
            );
        }
    }

    async handleSearch(msg, match) {
        const chatId = msg.chat.id;
        const keyword = match[1];

        await this.bot.sendMessage(chatId,
            `🔍 *Search Results for:* \`${keyword}\`\n\n` +
            `This feature will search your SMS history.\n` +
            `Currently in development!\n\n` +
            `Stay tuned for updates! 🚀`,
            { parse_mode: 'Markdown' }
        );
    }

    async handleBulk(msg, match) {
        const chatId = msg.chat.id;
        const args = match[1].split(' ');

        if (args.length !== 3) {
            await this.bot.sendMessage(chatId,
                `📖 *Bulk Request Usage:*\n\n` +
                `/bulk {server} {country} {count}\n\n` +
                `Example:\n` +
                `/bulk 1 us 5\n` +
                `This will request 5 US numbers from server 1`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        await this.bot.sendMessage(chatId,
            `🚀 *Bulk Request:*\n\n` +
            `Server: ${args[0]}\n` +
            `Country: ${args[1].toUpperCase()}\n` +
            `Count: ${args[2]}\n\n` +
            `This feature is in development!\n` +
            `It will provide ${args[2]} numbers at once.\n\n` +
            `Stay tuned! 🔥`,
            { parse_mode: 'Markdown' }
        );
    }

    async handleExport(msg, match) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const format = match[1].toLowerCase();

        if (!['json', 'csv', 'favorites'].includes(format)) {
            await this.bot.sendMessage(chatId,
                `📖 *Export Usage:*\n\n` +
                `/export json - Export as JSON\n` +
                `/export csv - Export as CSV\n` +
                `/export favorites - Backup favorites`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const favorites = this.favoriteManager.getFavorites(userId);

        if (favorites.length === 0) {
            await this.bot.sendMessage(chatId,
                `⚠️ No data to export!\n\n` +
                `Add some favorite numbers first.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        if (format === 'json') {
            const jsonData = JSON.stringify(favorites, null, 2);
            const buffer = Buffer.from(jsonData, 'utf-8');
            await this.bot.sendDocument(chatId, buffer, {}, {
                filename: `nokos_export_${Date.now()}.json`,
                contentType: 'application/json'
            });
        } else if (format === 'csv') {
            let csv = 'Number,Country,Server,Added At\n';
            favorites.forEach(fav => {
                csv += `${fav.number},${fav.countryName},${fav.serverName},${fav.addedAt}\n`;
            });
            const buffer = Buffer.from(csv, 'utf-8');
            await this.bot.sendDocument(chatId, buffer, {}, {
                filename: `nokos_export_${Date.now()}.csv`,
                contentType: 'text/csv'
            });
        } else if (format === 'favorites') {
            const jsonData = JSON.stringify({ userId, favorites }, null, 2);
            const buffer = Buffer.from(jsonData, 'utf-8');
            await this.bot.sendDocument(chatId, buffer, {}, {
                filename: `nokos_favorites_backup_${Date.now()}.json`,
                contentType: 'application/json'
            });
        }

        await this.bot.sendMessage(chatId,
            `✅ Export completed successfully!`,
            { parse_mode: 'Markdown' }
        );
    }

    async handleMyStats(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const sent = await this.bot.sendMessage(chatId, '⏳ Loading statistics...');
        await this.showMyStats(chatId, sent.message_id, userId);
    }

    async handleAPIInfo(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const sent = await this.bot.sendMessage(chatId, '⏳ Loading API info...');
        await this.showAPIInfo(chatId, sent.message_id, userId);
    }

    async handleStats(msg) {
        const chatId = msg.chat.id;
        const stats = this.controller.getStats();
        
        await this.bot.sendMessage(chatId,
            `📊 *BOT STATISTICS*\n\n` +
            `🌐 Servers: ${stats.platforms}\n` +
            `🌍 Countries: ${stats.countries}\n` +
            `💬 Social Media: ${stats.socialMedia}+\n` +
            `💾 Cache: ${stats.cache.size} items\n` +
            `⚙️ Workers: ${stats.workers.total} (${stats.workers.active} active)\n\n` +
            `✅ System Status: Online`,
            { parse_mode: 'Markdown' }
        );
    }

    async handleHelp(msg) {
        const sent = await this.bot.sendMessage(msg.chat.id, '⏳ Loading help...');
        await this.showHelp(msg.chat.id, sent.message_id);
    }

    async handleClearChat(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            // Delete last 100 messages (Telegram limit)
            for (let i = 0; i < 100; i++) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id - i);
                } catch (e) {
                    // Skip if message not found
                    continue;
                }
            }

            const sent = await this.bot.sendMessage(chatId,
                `🧹 *Chat Cleared!*\n\n` +
                `All recent messages have been deleted.\n\n` +
                `Type /start to begin again.`,
                { parse_mode: 'Markdown' }
            );

            // Auto delete this message after 5 seconds
            setTimeout(() => {
                this.bot.deleteMessage(chatId, sent.message_id).catch(() => {});
            }, 5000);

        } catch (error) {
            await this.bot.sendMessage(chatId,
                `⚠️ Could not clear all messages.\n` +
                `Some messages may be too old to delete.`,
                { parse_mode: 'Markdown' }
            );
        }
    }
}

const bot = new NokosBot();
console.log('✅ NOKOS Bot V3.0 - All Features Running!');
console.log('🔥 Bot is now idle and ready!');
console.log('📡 Waiting for commands...');
