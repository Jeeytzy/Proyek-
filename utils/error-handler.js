class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
    }

    /**
     * Retry function with exponential backoff
     */
    async withRetry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                this.logError(error);
                
                if (i < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, i);
                    console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Safe execute with error handling
     */
    async safeExecute(fn, defaultValue = null) {
        try {
            return await fn();
        } catch (error) {
            this.logError(error);
            return defaultValue;
        }
    }

    /**
     * Log error
     */
    logError(error) {
        const errorLog = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };
        
        this.errors.push(errorLog);
        
        // Keep only last 100 errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        const now = Date.now();
        const last5min = this.errors.filter(e => 
            now - new Date(e.timestamp).getTime() < 300000
        );
        const last1hour = this.errors.filter(e => 
            now - new Date(e.timestamp).getTime() < 3600000
        );
        
        return {
            total: this.errors.length,
            last5min: last5min.length,
            last1hour: last1hour.length,
            lastError: this.errors[this.errors.length - 1] || null
        };
    }

    /**
     * Clear errors
     */
    clearErrors() {
        this.errors = [];
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ErrorHandler;