class SearchManager {
    constructor(controller) {
        this.controller = controller;
        this.searchHistory = new Map();
    }

    async searchByService(userId, service) {
        console.log(`🔍 Searching by service: ${service} for user ${userId}`);
        
        const results = {
            service: service,
            matches: [],
            timestamp: new Date().toISOString()
        };

        this.saveSearch(userId, 'service', service, results);
        
        return results;
    }

    async searchByCode(userId, code) {
        console.log(`🔍 Searching by code: ${code} for user ${userId}`);
        
        const results = {
            code: code,
            matches: [],
            timestamp: new Date().toISOString()
        };

        this.saveSearch(userId, 'code', code, results);
        
        return results;
    }

    async searchByNumber(userId, number) {
        console.log(`🔍 Searching by number: ${number} for user ${userId}`);
        
        const results = {
            number: number,
            matches: [],
            timestamp: new Date().toISOString()
        };

        this.saveSearch(userId, 'number', number, results);
        
        return results;
    }

    saveSearch(userId, type, query, results) {
        if (!this.searchHistory.has(userId)) {
            this.searchHistory.set(userId, []);
        }

        const userHistory = this.searchHistory.get(userId);
        userHistory.push({
            type: type,
            query: query,
            results: results,
            timestamp: new Date().toISOString()
        });

        if (userHistory.length > 50) {
            userHistory.shift();
        }

        this.searchHistory.set(userId, userHistory);
    }

    getSearchHistory(userId) {
        return this.searchHistory.get(userId) || [];
    }

    clearSearchHistory(userId) {
        this.searchHistory.delete(userId);
        return { success: true, message: 'Search history cleared' };
    }
}

module.exports = SearchManager;