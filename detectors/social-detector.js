class SocialDetector {
    constructor(config) {
        this.patterns = config.SOCIAL_MEDIA;
    }

    /**
     * Detect social media dari SMS content
     */
    detect(smsContent) {
        if (!smsContent) {
            return { 
                service: 'unknown', 
                icon: '📱', 
                confidence: 'low', 
                name: 'Unknown',
                copyable: null
            };
        }
        
        const content = smsContent.toLowerCase();
        
        // Check all social media patterns
        for (const [serviceKey, data] of Object.entries(this.patterns)) {
            for (const pattern of data.patterns) {
                if (pattern.test(content)) {
                    return {
                        service: serviceKey,
                        icon: data.icon,
                        confidence: 'high',
                        name: data.name,
                        copyable: data.copyable
                    };
                }
            }
        }
        
        // Fallback: Check common verification keywords
        const verificationKeywords = {
            'verification': { icon: '🔐', name: 'Verification Service' },
            'verify': { icon: '✅', name: 'Verification' },
            'code': { icon: '🔑', name: 'Verification Code' },
            'otp': { icon: '🔢', name: 'OTP Service' },
            'password': { icon: '🔒', name: 'Password Reset' },
            'security': { icon: '🛡️', name: 'Security' },
            'login': { icon: '🔓', name: 'Login Service' },
            'account': { icon: '👤', name: 'Account Service' },
            'confirm': { icon: '✔️', name: 'Confirmation' },
            'authentication': { icon: '🔐', name: 'Authentication' }
        };
        
        for (const [keyword, data] of Object.entries(verificationKeywords)) {
            if (content.includes(keyword)) {
                return {
                    service: 'verification',
                    icon: data.icon,
                    confidence: 'medium',
                    name: data.name,
                    copyable: `${data.name}: {code}`
                };
            }
        }
        
        return { 
            service: 'unknown', 
            icon: '📱', 
            confidence: 'low',
            name: 'Unknown Service',
            copyable: 'Code: {code}'
        };
    }

    /**
     * Detect multiple SMS messages
     */
    detectMultiple(smsArray) {
        return smsArray.map(sms => {
            const detected = this.detect(sms.content || sms.fullText);
            
            // Generate copyable text dengan code
            let copyableText = null;
            if (detected.copyable && sms.code) {
                copyableText = detected.copyable.replace('{code}', sms.code);
            }
            
            return {
                ...sms,
                detected: detected,
                copyableText: copyableText,
                formattedMessage: this.formatMessage(sms, detected)
            };
        });
    }

    /**
     * Format message untuk display
     */
    formatMessage(sms, detected) {
        let formatted = `${detected.icon} ${detected.name}\n`;
        formatted += `🔑 Code: ${sms.code}\n`;
        formatted += `⏰ Time: ${sms.time}\n`;
        
        if (sms.from && sms.from !== 'Unknown') {
            formatted += `📤 From: ${sms.from}\n`;
        }
        
        return formatted;
    }

    /**
     * Get copyable format
     */
    getCopyableFormat(sms, detected) {
        if (detected.copyable && sms.code) {
            return detected.copyable.replace('{code}', sms.code);
        }
        return `Code: ${sms.code}`;
    }

    /**
     * Extract all codes from text
     */
    extractCodes(text) {
        if (!text) return [];
        
        const codePattern = /\b\d{4,8}\b/g;
        const matches = text.match(codePattern) || [];
        
        return matches.filter(code => 
            code.length >= 4 && code.length <= 8
        );
    }

    /**
     * Get statistics
     */
    getStats(messages) {
        const stats = {
            total: messages.length,
            byService: {},
            byConfidence: {
                high: 0,
                medium: 0,
                low: 0
            }
        };
        
        messages.forEach(msg => {
            const service = msg.detected?.service || 'unknown';
            const confidence = msg.detected?.confidence || 'low';
            
            stats.byService[service] = (stats.byService[service] || 0) + 1;
            stats.byConfidence[confidence]++;
        });
        
        return stats;
    }
}

module.exports = SocialDetector;