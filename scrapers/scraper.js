const axios = require('axios');
const cheerio = require('cheerio');

class Scraper {
    constructor(config) {
        this.timeout = config.TIMEOUT;
        this.maxRetries = config.MAX_RETRIES;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ];
    }

    async fetch(url, retries = 0) {
        try {
            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'DNT': '1'
                },
                validateStatus: (status) => status < 500 // Accept 4xx as valid
            });
            
            if (response.status === 404) {
                throw new Error('Page not found');
            }
            
            return response.data;
            
        } catch (error) {
            if (retries < this.maxRetries) {
                const delay = 2000 * (retries + 1);
                await this.sleep(delay);
                return this.fetch(url, retries + 1);
            }
            throw error;
        }
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * Extract phone numbers dari HTML
     */
    extractNumbers(html, countryCode = '') {
        const $ = cheerio.load(html);
        const numbers = new Set();
        
        // Strategy 1: Links dengan href berisi nomor
        $('a[href*="number"], a[href*="phone"], a[href*="+"], a[href*="sms"]').each((i, elem) => {
            const href = $(elem).attr('href') || '';
            const text = $(elem).text();
            this.extractFromText(href + ' ' + text, numbers, countryCode);
        });
        
        // Strategy 2: Table cells (paling umum untuk nomor)
        $('td, th').each((i, elem) => {
            const text = $(elem).text();
            this.extractFromText(text, numbers, countryCode);
        });
        
        // Strategy 3: Div/Span dengan class spesifik
        const phoneClasses = [
            'number', 'phone', 'phone-number', 'phonenumber',
            'tel', 'telephone', 'mobile', 'cell',
            'contact', 'receiver', 'temp-number'
        ];
        
        phoneClasses.forEach(className => {
            $(`.${className}, [class*="${className}"]`).each((i, elem) => {
                const text = $(elem).text();
                this.extractFromText(text, numbers, countryCode);
            });
        });
        
        // Strategy 4: List items
        $('li').each((i, elem) => {
            const text = $(elem).text();
            this.extractFromText(text, numbers, countryCode);
        });
        
        // Strategy 5: Paragraphs
        $('p').each((i, elem) => {
            const text = $(elem).text();
            this.extractFromText(text, numbers, countryCode);
        });
        
        // Strategy 6: Cards/Boxes
        $('[class*="card"], [class*="box"]').each((i, elem) => {
            const text = $(elem).text();
            this.extractFromText(text, numbers, countryCode);
        });
        
        // Strategy 7: Specific attributes
        $('[data-phone], [data-number]').each((i, elem) => {
            const phone = $(elem).attr('data-phone') || $(elem).attr('data-number');
            if (phone) {
                this.extractFromText(phone, numbers, countryCode);
            }
        });
        
        // Strategy 8: Full body text scan (fallback)
        const bodyText = $('body').text();
        this.extractFromText(bodyText, numbers, countryCode);
        
        // Limit to 50 numbers per page
        return Array.from(numbers).slice(0, 50);
    }

    extractFromText(text, numbersSet, countryCode) {
        if (!text || text.length < 5) return;
        
        // Multiple phone number patterns
        const patterns = [
            // International format
            /\+\d{1,4}[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,9}/g,
            // With parentheses
            /\(?\+?\d{1,4}\)?[\s\-\.]?\(?\d{2,4}\)?[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4}/g,
            // Simple format
            /\d{10,15}/g,
            // With country code
            /\+\d{1,3}\s?\d{3,4}\s?\d{3,4}\s?\d{3,4}/g
        ];
        
        patterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const cleaned = this.cleanNumber(match);
                    
                    // Validate
                    if (this.isValidPhoneNumber(cleaned)) {
                        // Format dengan +
                        const formatted = cleaned.startsWith('+') ? cleaned : '+' + cleaned;
                        numbersSet.add(formatted);
                    }
                });
            }
        });
    }

    cleanNumber(number) {
        // Remove everything except digits and +
        return number.replace(/[^\d+]/g, '');
    }

    isValidPhoneNumber(number) {
        const cleaned = number.replace(/[^\d]/g, '');
        
        // Length check: 10-15 digits
        if (cleaned.length < 10 || cleaned.length > 15) {
            return false;
        }
        
        // Invalid patterns
        const invalidPatterns = [
            /^0+$/,              // All zeros
            /^1+$/,              // All ones
            /^(\d)\1{9,}$/,      // Same digit repeated 10+ times
            /^123456789/,        // Sequential
            /^987654321/,        // Reverse sequential
            /^\d{4}$/,           // Only 4 digits
            /^[89]{10}/,         // Starts with 8 or 9 repeated
            /^555\d{7}/          // Fake numbers (555...)
        ];
        
        for (const pattern of invalidPatterns) {
            if (pattern.test(cleaned)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Extract SMS messages dari HTML
     */
    extractSMS(html) {
        const $ = cheerio.load(html);
        const messages = [];
        
        // Strategy 1: Table rows
        $('table tr, tbody tr').each((i, elem) => {
            if (i === 0) return; // Skip header
            
            const cells = $(elem).find('td');
            if (cells.length >= 2) {
                this.extractSMSFromElement($, elem, messages);
            }
        });
        
        // Strategy 2: Message containers
        const messageClasses = [
            'message', 'sms', 'msg', 'text-message',
            'message-box', 'sms-box', 'message-item',
            'message-content', 'sms-content'
        ];
        
        messageClasses.forEach(className => {
            $(`.${className}, [class*="${className}"]`).each((i, elem) => {
                this.extractSMSFromElement($, elem, messages);
            });
        });
        
        // Strategy 3: List items
        $('ul li, ol li').each((i, elem) => {
            const text = $(elem).text();
            if (text.length > 20) { // SMS biasanya panjang
                this.extractSMSFromElement($, elem, messages);
            }
        });
        
        // Strategy 4: Divs with specific patterns
        $('div').each((i, elem) => {
            const text = $(elem).text();
            // Cek apakah ada code pattern
            if (/\d{4,8}/.test(text) && text.length > 20 && text.length < 500) {
                this.extractSMSFromElement($, elem, messages);
            }
        });
        
        return messages;
    }

    extractSMSFromElement($, elem, messagesArray) {
        const text = $(elem).text().trim();
        
        if (!text || text.length < 10) return;
        
        // Extract verification code (4-8 digits)
        const codePatterns = [
            /\b(\d{4,8})\b/g,
            /code[:\s]+(\d{4,8})/gi,
            /otp[:\s]+(\d{4,8})/gi,
            /verification[:\s]+(\d{4,8})/gi,
            /pin[:\s]+(\d{4,8})/gi
        ];
        
        let code = null;
        for (const pattern of codePatterns) {
            const match = text.match(pattern);
            if (match) {
                code = match[0].replace(/\D/g, '');
                if (code.length >= 4 && code.length <= 8) {
                    break;
                }
            }
        }
        
        if (!code) return;
        
        // Extract time
        let time = 'recent';
        const timePatterns = [
            /(\d{1,2}:\d{2}\s?(?:AM|PM)?)/gi,
            /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
            /(\d{1,2}-\d{1,2}-\d{2,4})/g,
            /(\d+\s?(?:second|minute|hour|day)s?\s?ago)/gi,
            /(today|yesterday|now)/gi
        ];
        
        for (const pattern of timePatterns) {
            const match = text.match(pattern);
            if (match) {
                time = match[0];
                break;
            }
        }
        
        // Extract sender/from
        let from = 'Unknown';
        const fromPatterns = [
            /from[:\s]+([^\n\r,\(\)]+)/gi,
            /sender[:\s]+([^\n\r,\(\)]+)/gi,
            /\(([^)]+)\)/g
        ];
        
        for (const pattern of fromPatterns) {
            const match = text.match(pattern);
            if (match) {
                from = match[0].replace(/from|sender|:|[\(\)]/gi, '').trim();
                if (from.length > 3 && from.length < 50) {
                    break;
                }
            }
        }
        
        // Check for duplicate
        const isDuplicate = messagesArray.some(msg => 
            msg.code === code && msg.time === time
        );
        
        if (!isDuplicate) {
            messagesArray.push({
                content: text.substring(0, 300).trim(),
                code: code,
                time: time,
                from: from,
                fullText: text
            });
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = Scraper;