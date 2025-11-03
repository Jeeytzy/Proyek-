const Scraper = require('../scrapers/scraper');
const Validator = require('../utils/validator');

class BaseWorker {
    constructor(platform, config, countryFilter) {
        this.platform = platform;
        this.config = config;
        this.filter = countryFilter;
        this.scraper = new Scraper(config);
        this.validator = new Validator();
        this.status = 'idle';
        this.lastError = null;
        this.assignedServer = null;
        this.stats = {
            successCount: 0,
            errorCount: 0,
            totalRequests: 0
        };
    }

    async scrapeCountry(countryCode) {
        try {
            this.status = 'working';
            this.stats.totalRequests++;
            
            const countryInfo = this.filter.getCountryInfo(countryCode);
            if (!countryInfo) {
                throw new Error(`Country ${countryCode} not found`);
            }
            
            // Build URLs
            const urls = this.buildURLs(countryCode);
            
            let numbers = [];
            
            // Try all URL patterns
            for (const url of urls) {
                try {
                    console.log(`🔍 Worker ${this.platform.id} trying: ${url}`);
                    
                    const html = await this.scraper.fetch(url);
                    const extracted = this.scraper.extractNumbers(html, countryCode);
                    
                    if (extracted.length > 0) {
                        // FILTER: Hanya nomor dari negara ini!
                        const validNumbers = this.filter.filterByCountry(extracted, countryCode);
                        
                        if (validNumbers.length > 0) {
                            numbers = validNumbers;
                            console.log(`✅ Worker ${this.platform.id} found ${validNumbers.length} valid ${countryInfo.name} numbers`);
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Worker ${this.platform.id} failed URL: ${url.substring(0, 50)}...`);
                    continue;
                }
            }
            
            this.status = 'idle';
            this.lastError = null;
            this.stats.successCount++;
            
            // Map dengan metadata lengkap
            return numbers.map(num => ({
                number: this.filter.formatNumber(num, countryCode),
                country: countryCode,
                countryName: countryInfo.name,
                countryFlag: countryInfo.flag,
                dialCode: countryInfo.dialCode,
                platform: this.platform.name,
                platformId: this.platform.id,
                platformUrl: this.platform.url,
                server: this.assignedServer || this.platform.server,
                scrapedAt: new Date().toISOString()
            }));
            
        } catch (error) {
            this.status = 'error';
            this.lastError = error.message;
            this.stats.errorCount++;
            console.error(`❌ Worker ${this.platform.id} (${this.platform.name}) error:`, error.message);
            return [];
        }
    }

    buildURLs(countryCode) {
        const baseUrl = this.platform.url;
        const country = countryCode.toLowerCase();
        const countryUpper = countryCode.toUpperCase();
        
        // Comprehensive URL patterns
        return [
            `${baseUrl}`,
            `${baseUrl}/${country}`,
            `${baseUrl}/${countryUpper}`,
            `${baseUrl}/country/${country}`,
            `${baseUrl}/numbers/${country}`,
            `${baseUrl}/${country}/`,
            `${baseUrl}/free-${country}-phone-number`,
            `${baseUrl}/receive-sms-${country}`,
            `${baseUrl}/${country}-phone-numbers`,
            `${baseUrl}/sms/${country}`,
            `${baseUrl}/temp-number/${country}`,
            `${baseUrl}/index.php?country=${country}`,
            `${baseUrl}/?c=${country}`,
            `${baseUrl}/?country=${country}`,
            `${baseUrl}/online-sms/${country}`
        ];
    }

    async getSMS(number, countryCode) {
        try {
            // Validate number
            if (!this.validator.isValidPhoneNumber(number)) {
                throw new Error('Invalid phone number format');
            }
            
            // Clean number
            const cleanNumber = number.replace(/[^\d]/g, '');
            
            // Build SMS URLs
            const urls = this.buildSMSURLs(cleanNumber, countryCode);
            
            let messages = [];
            
            for (const url of urls) {
                try {
                    console.log(`📨 Getting SMS from: ${url.substring(0, 60)}...`);
                    
                    const html = await this.scraper.fetch(url);
                    const extracted = this.scraper.extractSMS(html);
                    
                    if (extracted.length > 0) {
                        messages = extracted;
                        console.log(`✅ Found ${messages.length} SMS`);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            return messages;
            
        } catch (error) {
            console.error(`❌ Get SMS error:`, error.message);
            return [];
        }
    }

    buildSMSURLs(number, countryCode) {
        const baseUrl = this.platform.url;
        const country = countryCode.toLowerCase();
        
        return [
            `${baseUrl}/number/${number}`,
            `${baseUrl}/sms/${number}`,
            `${baseUrl}/messages/${number}`,
            `${baseUrl}/${country}/${number}`,
            `${baseUrl}/view/${number}`,
            `${baseUrl}/?number=${number}`,
            `${baseUrl}/receive-sms-online/${number}`,
            `${baseUrl}/phone/${number}`,
            `${baseUrl}/message/${number}`,
            `${baseUrl}/${number}`,
            `${baseUrl}/receive/${number}`
        ];
    }

    getStats() {
        return {
            platform: this.platform.name,
            status: this.status,
            server: this.assignedServer || this.platform.server,
            ...this.stats,
            successRate: this.stats.totalRequests > 0 
                ? ((this.stats.successCount / this.stats.totalRequests) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    reset() {
        this.status = 'idle';
        this.lastError = null;
    }
}

module.exports = BaseWorker;