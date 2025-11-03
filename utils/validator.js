class Validator {
    constructor() {
        this.patterns = {
            // Phone number patterns
            phone: /^[\+]?[\d\s\-\(\)]{10,20}$/,
            
            // Invalid patterns
            invalidSequences: [
                /^0+$/,           // All zeros
                /^1+$/,           // All ones
                /^(\d)\1{9,}$/,   // Same digit repeated
                /^123456789/,     // Sequential
                /^987654321/      // Reverse sequential
            ]
        };
    }

    isValidPhoneNumber(number) {
        if (!number) return false;
        
        const cleanNumber = number.toString().replace(/[^\d+]/g, '');
        
        // Check length
        if (cleanNumber.length < 10 || cleanNumber.length > 20) {
            return false;
        }
        
        // Check invalid patterns
        for (const pattern of this.patterns.invalidSequences) {
            if (pattern.test(cleanNumber)) {
                return false;
            }
        }
        
        return true;
    }

    isValidSMSCode(code) {
        if (!code) return false;
        
        // Code should be 4-8 digits
        const cleanCode = code.toString().replace(/\D/g, '');
        return cleanCode.length >= 4 && cleanCode.length <= 8;
    }

    sanitizeNumber(number) {
        if (!number) return '';
        return number.toString().replace(/[^\d+]/g, '');
    }

    sanitizeCode(code) {
        if (!code) return '';
        return code.toString().replace(/\D/g, '');
    }
}

module.exports = Validator;