const BaseWorker = require('../workers/base-worker');
const CacheManager = require('./cache');
const CountryFilter = require('./country-filter');
const SocialDetector = require('../detectors/social-detector');
const ErrorHandler = require('../utils/error-handler');

class Controller {
    constructor(config) {
        this.config = config;
        this.cache = new CacheManager();
        this.filter = new CountryFilter(config);
        this.detector = new SocialDetector(config);
        this.errorHandler = new ErrorHandler();
        this.workers = this.initWorkers();
        
        // Auto clean cache every 10 minutes
        this.startCacheCleaner();
        
        console.log(`✅ Controller initialized`);
        console.log(`🌐 Servers: ${this.workers.length}`);
        console.log(`🌍 Countries: ${config.COUNTRIES.length}`);
    }

    initWorkers() {
        // Create 1 worker per platform (1 server = 1 platform)
        return this.config.PLATFORMS
            .filter(p => p.active)
            .map(platform => new BaseWorker(platform, this.config, this.filter));
    }

    startCacheCleaner() {
        setInterval(() => {
            this.cache.cleanExpired();
        }, 600000); // 10 minutes
    }

    /**
     * Scrape from SPECIFIC SERVER for SPECIFIC COUNTRY
     * Key concept: 1 Server = 1 Platform = Different numbers
     */
    async scrapeFromServer(serverId, countryCode) {
        // Validate country
        const countryInfo = this.filter.getCountryInfo(countryCode);
        if (!countryInfo) {
            throw new Error(`Country ${countryCode} not found`);
        }

        // Find specific worker/server
        const worker = this.workers.find(w => w.platform.id === serverId);
        if (!worker) {
            throw new Error(`Server ${serverId} not found`);
        }

        const cacheKey = `server_${serverId}_country_${countryCode}`;
        
        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && cached.length > 0) {
            console.log(`✅ Cache HIT: Server ${serverId} - ${countryInfo.name} (${cached.length} numbers)`);
            return cached;
        }
        
        console.log(`🚀 Scraping Server ${serverId} (${worker.platform.name}) for ${countryInfo.flag} ${countryInfo.name}...`);
        
        const startTime = Date.now();
        
        try {
            // Scrape from this specific server only
            const numbers = await this.errorHandler.withRetry(
                () => worker.scrapeCountry(countryCode),
                3, // max retries
                2000 // delay
            );
            
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            
            console.log(`📊 Raw results: ${numbers.length} numbers from Server ${serverId}`);
            
            // FILTER KETAT: Hanya nomor dari negara ini!
            const filteredNumbers = this.filter.filterByCountry(
                numbers.map(item => item.number),
                countryCode
            );
            
            // Re-map dengan metadata
            const finalNumbers = filteredNumbers.map(number => {
                const original = numbers.find(item => 
                    this.filter.cleanNumber(item.number) === this.filter.cleanNumber(number)
                );
                
                return {
                    number: this.filter.formatNumber(number, countryCode),
                    country: countryCode,
                    countryName: countryInfo.name,
                    countryFlag: countryInfo.flag,
                    dialCode: countryInfo.dialCode,
                    serverId: serverId,
                    serverName: worker.platform.name,
                    serverUrl: worker.platform.server,
                    platformUrl: worker.platform.url,
                    scrapedAt: new Date().toISOString()
                };
            });
            
            // Remove duplicates
            const uniqueNumbers = this.removeDuplicates(finalNumbers);
            
            console.log(`✅ Server ${serverId} scraping done in ${elapsed}s`);
            console.log(`🎯 Filtered: ${uniqueNumbers.length} valid ${countryInfo.name} numbers`);
            
            // Save to cache
            if (uniqueNumbers.length > 0) {
                this.cache.set(cacheKey, uniqueNumbers, this.config.CACHE_DURATION);
            }
            
            return uniqueNumbers;
            
        } catch (error) {
            console.error(`❌ Server ${serverId} scraping error:`, error.message);
            throw new Error(`Failed to scrape from Server ${serverId}: ${error.message}`);
        }
    }

    removeDuplicates(numbers) {
        const seen = new Map();
        
        numbers.forEach(item => {
            const cleanNum = this.filter.cleanNumber(item.number);
            if (!seen.has(cleanNum)) {
                seen.set(cleanNum, item);
            }
        });
        
        return Array.from(seen.values());
    }

    /**
     * Get SMS from SPECIFIC SERVER
     */
    async getSMSFromServer(serverId, number, countryCode) {
        // Validate number untuk negara ini
        if (!this.filter.isValidForCountry(number, countryCode)) {
            console.warn(`⚠️ Number ${number} might not be valid for country ${countryCode}`);
        }
        
        const worker = this.workers.find(w => w.platform.id === serverId);
        
        if (!worker) {
            throw new Error(`Server ${serverId} not found`);
        }
        
        console.log(`📨 Getting SMS from Server ${serverId} (${worker.platform.name})...`);
        console.log(`📱 Number: ${number}`);
        console.log(`🖥️ Server: ${worker.platform.server}`);
        
        try {
            const messages = await this.errorHandler.withRetry(
                () => worker.getSMS(number, countryCode),
                2, // max retries
                1000 // delay
            );
            
            // Detect social media
            const detected = this.detector.detectMultiple(messages);
            
            console.log(`✅ Found ${detected.length} messages from Server ${serverId}`);
            
            return detected;
            
        } catch (error) {
            console.error(`❌ Get SMS from Server ${serverId} error:`, error.message);
            throw new Error(`Failed to get SMS from Server ${serverId}: ${error.message}`);
        }
    }

    /**
     * Get all available servers
     */
    getAvailableServers() {
        return this.workers.map(w => ({
            id: w.platform.id,
            name: w.platform.name,
            server: w.platform.server,
            url: w.platform.url,
            status: w.status
        }));
    }

    /**
     * Get server info
     */
    getServerInfo(serverId) {
        const worker = this.workers.find(w => w.platform.id === serverId);
        if (!worker) return null;
        
        return {
            id: worker.platform.id,
            name: worker.platform.name,
            server: worker.platform.server,
            url: worker.platform.url,
            status: worker.status,
            stats: worker.getStats()
        };
    }

    /**
     * Get statistics
     */
    getStats() {
        const cacheStats = this.cache.getStats();
        const workerStats = {
            total: this.workers.length,
            active: this.workers.filter(w => w.status === 'idle' || w.status === 'working').length,
            idle: this.workers.filter(w => w.status === 'idle').length,
            working: this.workers.filter(w => w.status === 'working').length,
            error: this.workers.filter(w => w.status === 'error').length
        };
        
        return {
            cache: cacheStats,
            workers: workerStats,
            platforms: this.config.PLATFORMS.length,
            countries: this.config.COUNTRIES.length,
            socialMedia: Object.keys(this.config.SOCIAL_MEDIA).length
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache cleared successfully');
    }

    /**
     * Reset all workers
     */
    resetWorkers() {
        this.workers.forEach(worker => {
            worker.status = 'idle';
            worker.lastError = null;
        });
        console.log('🔄 All workers reset');
    }

    /**
     * Reset specific server
     */
    resetServer(serverId) {
        const worker = this.workers.find(w => w.platform.id === serverId);
        if (worker) {
            worker.reset();
            console.log(`🔄 Server ${serverId} reset`);
            return true;
        }
        return false;
    }
}

module.exports = Controller;