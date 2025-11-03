const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const Controller = require('./core/controller');

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
        
        this.userSessions = new Map();
        this.processingCallbacks = new Set();
        
        // ADD: Operation timeout (60 seconds)
        this.OPERATION_TIMEOUT = 60000;
        
        this.setupHandlers();
        this.setupErrorHandling();
        this.startSessionCleaner();
        
        console.log('🤖 NOKOS Bot V2.0 - Server Mode Started!');
        console.log('🌐 Servers: 100 (Each = 1 Platform)');
        console.log('🌍 Countries per Server: 250');
        console.log('📱 All Social Media Detection');
        console.log('✅ Ready with Anti-Crash Protection!');
    }

    setupHandlers() {
        this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
        this.bot.onText(/\/stats/, (msg) => this.handleStats(msg));
        this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
        this.bot.on('callback_query', (query) => this.handleCallback(query));
    }

    setupErrorHandling() {
        this.bot.on('polling_error', (error) => {
            console.error('❌ Polling error:', error.code, error.message);
            // Don't crash, just log
        });

        this.bot.on('error', (error) => {
            console.error('❌ Bot error:', error);
            // Don't crash, just log
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise);
            console.error('Reason:', reason);
            // Don't crash the process
        });

        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            console.error('Stack:', error.stack);
            // Log but don't crash
        });

        // Keep bot alive - heartbeat
        setInterval(() => {
            console.log('💓 Bot heartbeat - Still running...');
        }, 60000); // Every 1 minute
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

    // ADD: Timeout protection helper
    async withTimeout(promise, timeoutMs = this.OPERATION_TIMEOUT) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
            )
        ]);
    }

    // ADD: Safe edit message helper
    async safeEditMessage(chatId, messageId, text, options = {}) {
        try {
            return await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
        } catch (error) {
            // Handle "message is not modified" error
            if (error.message.includes('message is not modified')) {
                console.log('⚠️ Message not modified (same content)');
                return;
            }
            
            // Handle "message to edit not found"
            if (error.message.includes('message to edit not found')) {
                console.log('⚠️ Message not found, sending new message');
                return await this.bot.sendMessage(chatId, text, options);
            }
            
            // Handle "message can't be edited"
            if (error.message.includes("message can't be edited")) {
                console.log('⚠️ Message too old, sending new message');
                return await this.bot.sendMessage(chatId, text, options);
            }
            
            throw error;
        }
    }

    async handleStart(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '🌐 Pilih Server (100 Servers)', callback_data: 'select_server_0' }],
                [{ text: '📊 Statistics', callback_data: 'stats' }],
                [{ text: 'ℹ️ Help', callback_data: 'help' }]
            ]
        };

        if (userId.toString() === this.config.OWNER_ID) {
            keyboard.inline_keyboard.push([{ text: '👑 Owner Panel', callback_data: 'owner_panel' }]);
        }

        const welcomeText = 
            `🎉 *WELCOME TO NOKOS BOT V2.0* 🎉\n\n` +
            `🌐 *SERVER-BASED SYSTEM*\n\n` +
            `✅ *STRUKTUR:*\n` +
            `• 100 Servers (1 Server = 1 Platform)\n` +
            `• 250 Countries per Server\n` +
            `• Nomor berbeda tiap server!\n` +
            `• All Social Media Detection\n` +
            `• 100% GRATIS!\n\n` +
            `👤 User: ${msg.from.first_name}\n` +
            `🆔 ID: \`${userId}\`\n\n` +
            `🎯 *CARA PAKAI:*\n` +
            `1️⃣ Pilih Server (1-100)\n` +
            `2️⃣ Pilih Negara (250 negara)\n` +
            `3️⃣ Pilih Nomor\n` +
            `4️⃣ Lihat SMS + Copy Code\n\n` +
            `⚡ *Creator:* @Jeeyhosting`;

        await this.bot.sendMessage(chatId, welcomeText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async handleCallback(query) {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        const userId = query.from.id;

        // Log untuk debugging
        console.log(`🔥 Callback received: ${data} from user ${userId}`);

        const callbackKey = `${chatId}_${data}`;
        
        // Check if already processing
        if (this.processingCallbacks.has(callbackKey)) {
            await this.bot.answerCallbackQuery(query.id, {
                text: '⏳ Sedang diproses...',
                show_alert: false
            }).catch(err => console.error('Answer callback error:', err));
            return;
        }

        this.processingCallbacks.add(callbackKey);

        // Answer callback immediately
        await this.bot.answerCallbackQuery(query.id).catch(err => {
            console.error('❌ Answer callback error:', err);
        });

        try {
            console.log(`🔄 Processing: ${data}`);

            if (data === 'page_info') {
                // Do nothing, just info
                return;
            }
            else if (data.startsWith('select_server_')) {
                const page = parseInt(data.split('_')[2]);
                await this.showServers(chatId, messageId, page);
            }
            else if (data.startsWith('server_')) {
                const serverId = parseInt(data.split('_')[1]);
                await this.selectServer(chatId, messageId, serverId, userId);
            }
            else if (data.startsWith('countries_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[1]);
                const page = parseInt(parts[2]);
                await this.showCountries(chatId, messageId, serverId, page, userId);
            }
            else if (data.startsWith('country_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[1]);
                const countryCode = parts[2];
                await this.scrapeCountry(chatId, messageId, serverId, countryCode, userId);
            }
            else if (data.startsWith('numbers_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[1]);
                const countryCode = parts[2];
                const page = parseInt(parts[3]);
                await this.showNumbers(chatId, messageId, serverId, countryCode, page, userId);
            }
            else if (data.startsWith('select_number_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[2]);
                const countryCode = parts[3];
                const number = parts.slice(4).join('_');
                await this.selectNumber(chatId, messageId, serverId, number, countryCode, userId);
            }
            else if (data.startsWith('refresh_sms_')) {
                const parts = data.split('_');
                const serverId = parseInt(parts[2]);
                const countryCode = parts[3];
                const number = parts.slice(4).join('_');
                await this.refreshSMS(chatId, messageId, serverId, number, countryCode, userId);
            }
            else if (data === 'stats') {
                await this.showStats(chatId, messageId);
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
                // Delete old message and send new /start
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
            
            // Try to inform user
            try {
                await this.bot.sendMessage(chatId, 
                    `❌ *ERROR*\n\n` +
                    `Data: ${data}\n` +
                    `Error: ${error.message}\n\n` +
                    `Ketik /start untuk restart.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError);
            }
        } finally {
            // Clear processing dengan delay
            setTimeout(() => {
                this.processingCallbacks.delete(callbackKey);
                console.log(`🧹 Cleared callback: ${callbackKey}`);
            }, 2000);
        }
    }

    // ============================================
    // STEP 1: SHOW SERVERS (100 SERVERS)
    // ============================================
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
            `🌐 *PILIH SERVER*\n\n` +
            `📊 Total: 100 Servers Available\n` +
            `📄 Halaman: ${page + 1}/${totalPages}\n\n` +
            `✅ 1 Server = 1 Platform\n` +
            `✅ 250 Negara per Server\n` +
            `✅ Nomor berbeda tiap server\n\n` +
            `Pilih server untuk lanjut:`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // ============================================
    // STEP 2: SELECT SERVER & SHOW INFO
    // ============================================
    async selectServer(chatId, messageId, serverId, userId) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        
        if (!server) {
            await this.safeEditMessage(chatId, messageId, '❌ Server tidak ditemukan');
            return;
        }

        let session = this.userSessions.get(userId) || {};
        session.serverId = serverId;
        session.serverName = server.name;
        session.timestamp = Date.now();
        this.userSessions.set(userId, session);

        const keyboard = {
            inline_keyboard: [
                [{ text: '🌍 Pilih Negara (250 Countries)', callback_data: `countries_${serverId}_0` }],
                [{ text: '🔙 Pilih Server Lain', callback_data: 'select_server_0' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        const text = 
            `🌐 *SERVER ${serverId} SELECTED*\n\n` +
            `📱 Platform: ${server.name}\n` +
            `🖥️ Server: ${server.server}\n` +
            `🌍 Countries: 250 Available\n` +
            `🔗 URL: ${server.url}\n\n` +
            `✅ *Info:*\n` +
            `• Server ini punya 250 negara\n` +
            `• Nomor berbeda dari server lain\n` +
            `• All social media detection\n\n` +
            `Lanjut pilih negara:`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // ============================================
    // STEP 3: SHOW COUNTRIES (250 COUNTRIES)
    // ============================================
    async showCountries(chatId, messageId, serverId, page, userId) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        if (!server) {
            await this.safeEditMessage(chatId, messageId, '❌ Server tidak ditemukan');
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
            `🌍 *PILIH NEGARA*\n\n` +
            `🌐 Server: ${serverId} (${server.name})\n` +
            `📊 Total: ${countries.length} negara\n` +
            `📄 Halaman: ${page + 1}/${totalPages}\n\n` +
            `✅ Nomor dari negara yang dipilih\n` +
            `✅ Nomor berbeda dari server lain\n\n` +
            `Pilih negara:`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // ============================================
    // STEP 4: SCRAPE COUNTRY FROM SERVER
    // ============================================
    async scrapeCountry(chatId, messageId, serverId, countryCode, userId) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        const country = this.config.COUNTRIES.find(c => c.code === countryCode);
        
        if (!server || !country) {
            await this.safeEditMessage(chatId, messageId, '❌ Server atau negara tidak ditemukan');
            return;
        }

        await this.safeEditMessage(chatId, messageId,
            `⏳ *MENCARI NOMOR...*\n\n` +
            `🌐 Server: ${serverId} (${server.name})\n` +
            `🌍 Negara: ${country.flag} ${country.name}\n` +
            `📞 Dial Code: ${country.dialCode}\n` +
            `🖥️ Server: ${server.server}\n\n` +
            `🔍 Scraping dari server ini...\n` +
            `✅ Hanya nomor ${country.name}\n\n` +
            `⚡ Tunggu 10-30 detik...`,
            { parse_mode: 'Markdown' }
        );

        try {
            // Scrape with timeout protection (60 seconds max)
            const numbers = await this.withTimeout(
                this.controller.scrapeFromServer(serverId, countryCode),
                60000
            );

            if (numbers.length === 0) {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔄 Coba Lagi', callback_data: `country_${serverId}_${countryCode}` }],
                        [{ text: '🌍 Negara Lain', callback_data: `countries_${serverId}_0` }],
                        [{ text: '🌐 Server Lain', callback_data: 'select_server_0' }]
                    ]
                };

                await this.safeEditMessage(chatId, messageId,
                    `❌ *TIDAK ADA NOMOR*\n\n` +
                    `🌐 Server: ${serverId}\n` +
                    `🌍 Negara: ${country.flag} ${country.name}\n` +
                    `📊 Hasil: 0 nomor\n\n` +
                    `💡 Coba server lain atau negara lain`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
                return;
            }

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
                    [{ text: '🔄 Coba Lagi', callback_data: `country_${serverId}_${countryCode}` }],
                    [{ text: '🌍 Negara Lain', callback_data: `countries_${serverId}_0` }],
                    [{ text: '🌐 Server Lain', callback_data: 'select_server_0' }]
                ]
            };

            if (error.message === 'Operation timeout') {
                await this.safeEditMessage(chatId, messageId,
                    `⏰ *TIMEOUT*\n\n` +
                    `Scraping memakan waktu terlalu lama.\n` +
                    `Silakan coba lagi atau pilih server lain.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            } else {
                await this.safeEditMessage(chatId, messageId,
                    `❌ *ERROR*\n\n${error.message}\n\nSilakan coba lagi.`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
            }
        }
    }

    // ============================================
    // STEP 5: SHOW NUMBERS
    // ============================================
    async showNumbers(chatId, messageId, serverId, countryCode, page, userId) {
        const session = this.userSessions.get(userId);
        
        if (!session || session.serverId !== serverId || session.countryCode !== countryCode) {
            await this.safeEditMessage(chatId, messageId, '❌ Session expired. Pilih server & negara lagi.');
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
            const displayNumber = item.number.length > 18
                ? item.number.substring(0, 18) + '...' 
                : item.number;
            
            keyboard.inline_keyboard.push([{
                text: `📱 ${displayNumber}`,
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
            { text: '🌍 Negara Lain', callback_data: `countries_${serverId}_0` }
        ]);

        const text = 
            `✅ *NOMOR DITEMUKAN!*\n\n` +
            `🌐 Server: ${serverId} (${server.name})\n` +
            `🌍 Negara: ${country.flag} ${country.name}\n` +
            `📞 Dial Code: ${country.dialCode}\n` +
            `📊 Total: ${numbers.length} nomor\n` +
            `📄 Halaman: ${page + 1}/${totalPages}\n\n` +
            `✅ Nomor dari ${country.name} only\n` +
            `✅ Server ${serverId} exclusive\n\n` +
            `📱 Pilih nomor:`;

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // ============================================
    // STEP 6: SELECT NUMBER & GET SMS
    // ============================================
    async selectNumber(chatId, messageId, serverId, number, countryCode, userId) {
        const server = this.config.PLATFORMS.find(p => p.id === serverId);
        const country = this.config.COUNTRIES.find(c => c.code === countryCode);

        await this.safeEditMessage(chatId, messageId,
            `⏳ *MENGAMBIL SMS...*\n\n` +
            `🌐 Server: ${serverId}\n` +
            `📱 Nomor: ${number}\n` +
            `🌍 Negara: ${country.flag} ${country.name}\n\n` +
            `⚡ Tunggu...`,
            { parse_mode: 'Markdown' }
        );

        try {
            const messages = await this.controller.getSMSFromServer(serverId, number, countryCode);

            if (messages.length === 0) {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '🔄 Refresh SMS', callback_data: `refresh_sms_${serverId}_${countryCode}_${number}` }],
                        [{ text: '📱 Nomor Lain', callback_data: `numbers_${serverId}_${countryCode}_0` }]
                    ]
                };

                await this.safeEditMessage(chatId, messageId,
                    `🔭 *BELUM ADA SMS*\n\n` +
                    `📱 Gunakan nomor untuk registrasi\n` +
                    `🔄 Refresh setelah daftar\n` +
                    `⏰ SMS masuk 1-5 menit`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    }
                );
                return;
            }

            await this.showSMS(chatId, messageId, serverId, number, messages, server, country, countryCode);

        } catch (error) {
            console.error('❌ Get SMS error:', error);
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🔄 Coba Lagi', callback_data: `select_number_${serverId}_${countryCode}_${number}` }]
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

    // ============================================
    // PERBAIKAN: SHOW SMS DENGAN FORMAT LEBIH JELAS
    // ============================================
    async showSMS(chatId, messageId, serverId, number, messages, server, country, countryCode) {
        let text = 
            `📨 *SMS DITERIMA!*\n\n` +
            `🌐 Server: ${serverId} (${server.name})\n` +
            `📱 Nomor: \`${number}\`\n` +
            `🌍 Negara: ${country.flag} ${country.name}\n` +
            `📊 Total: ${messages.length} SMS\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n\n`;

        messages.slice(0, 10).forEach((msg, idx) => {
            const detected = msg.detected || { icon: '📱', name: 'Unknown' };
            
            // PERBAIKAN: Tampilkan nama social media dengan jelas & besar
            text += `${idx + 1}. ${detected.icon} *${detected.name.toUpperCase()}*\n`;
            text += `   ━━━━━━━━━━━━━━━━━━\n`;
            text += `   🔑 Code: \`${msg.code}\`\n`;
            
            // Tampilkan copyable text jika ada
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
            text += `... dan ${messages.length - 10} SMS lainnya\n\n`;
        }

        text += `━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `💡 *CARA PAKAI:*\n`;
        text += `1. Lihat nama platform (misal: WHATSAPP)\n`;
        text += `2. Copy code yang sesuai\n`;
        text += `3. Paste di aplikasi yang sama\n`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔄 Refresh SMS', callback_data: `refresh_sms_${serverId}_${countryCode}_${number}` }],
                [{ text: '📱 Nomor Lain', callback_data: `numbers_${serverId}_${countryCode}_0` }],
                [{ text: '🌍 Negara Lain', callback_data: `countries_${serverId}_0` }],
                [{ text: '🌐 Server Lain', callback_data: 'select_server_0' }]
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

    async showStats(chatId, messageId) {
        const stats = this.controller.getStats();
        
        const text = 
            `📊 *BOT STATISTICS*\n\n` +
            `🌐 *Servers:* ${stats.platforms}\n` +
            `🌍 *Countries:* ${stats.countries}\n` +
            `💬 *Social Media:* ${stats.socialMedia}+\n\n` +
            `💾 *Cache:*\n` +
            `Size: ${stats.cache.size}\n` +
            `Hit Rate: ${stats.cache.hitRate}\n\n` +
            `✅ System: Online`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔄 Refresh', callback_data: 'stats' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showHelp(chatId, messageId) {
        const text = 
            `ℹ️ *HELP*\n\n` +
            `🎯 *Flow:*\n` +
            `1️⃣ Pilih Server (1-100)\n` +
            `2️⃣ Pilih Negara (250 negara)\n` +
            `3️⃣ Pilih Nomor\n` +
            `4️⃣ Lihat SMS\n\n` +
            `✅ *Keunggulan:*\n` +
            `• 100 Server berbeda\n` +
            `• Nomor berbeda tiap server\n` +
            `• 250 negara per server\n` +
            `• All social media detection\n\n` +
            `💡 *Tips:*\n` +
            `• Nama platform ditampilkan KAPITAL\n` +
            `• Contoh: WHATSAPP, TELEGRAM, dll\n` +
            `• Copy code sesuai platform\n\n` +
            `👨‍💻 Creator: @Jeeyhosting`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async showOwnerPanel(chatId, messageId) {
        const stats = this.controller.getStats();
        
        const text = 
            `👑 *OWNER PANEL*\n\n` +
            `🌐 Servers: ${stats.platforms}\n` +
            `🌍 Countries: ${stats.countries}\n` +
            `💾 Cache: ${stats.cache.size} items\n` +
            `👥 Sessions: ${this.userSessions.size}\n\n` +
            `Commands:\n` +
            `/stats - Statistics\n` +
            `/start - Restart`;

        const keyboard = {
            inline_keyboard: [
                [{ text: '🗑️ Clear Cache', callback_data: 'clear_cache' }],
                [{ text: '🔄 Refresh', callback_data: 'owner_panel' }],
                [{ text: '🏠 Main Menu', callback_data: 'back_main' }]
            ]
        };

        await this.safeEditMessage(chatId, messageId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    async handleStats(msg) {
        const stats = this.controller.getStats();
        await this.bot.sendMessage(msg.chat.id, 
            `📊 *STATS*\n\n` +
            `Servers: ${stats.platforms}\n` +
            `Countries: ${stats.countries}\n` +
            `Cache: ${stats.cache.size}`,
            { parse_mode: 'Markdown' }
        );
    }

    async handleHelp(msg) {
        await this.bot.sendMessage(msg.chat.id, 
            `ℹ️ *HELP*\n\n` +
            `Use /start to begin\n\n` +
            `Flow:\n` +
            `Server → Country → Number → SMS`,
            { parse_mode: 'Markdown' }
        );
    }
}

// Start Bot
const bot = new NokosBot();
console.log('✅ Bot running - Server-based system with Anti-Crash Protection!');