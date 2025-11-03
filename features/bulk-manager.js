class BulkManager {
    constructor(controller) {
        this.controller = controller;
        this.bulkRequests = new Map();
    }

    async bulkRequest(userId, serverId, countryCode, count) {
        console.log(`📦 Bulk request: ${count} numbers from server ${serverId}, country ${countryCode}`);

        if (count < 1 || count > 50) {
            throw new Error('Count must be between 1 and 50');
        }

        const requestId = `${userId}_${Date.now()}`;
        
        this.bulkRequests.set(requestId, {
            userId: userId,
            serverId: serverId,
            countryCode: countryCode,
            count: count,
            status: 'processing',
            progress: 0,
            numbers: [],
            startTime: Date.now()
        });

        try {
            const allNumbers = await this.controller.scrapeFromServer(serverId, countryCode);
            
            const selectedNumbers = allNumbers.slice(0, count);
            
            const request = this.bulkRequests.get(requestId);
            request.status = 'completed';
            request.progress = 100;
            request.numbers = selectedNumbers;
            request.endTime = Date.now();
            this.bulkRequests.set(requestId, request);

            console.log(`✅ Bulk request ${requestId} completed: ${selectedNumbers.length} numbers`);

            return {
                requestId: requestId,
                numbers: selectedNumbers,
                total: selectedNumbers.length,
                requested: count
            };

        } catch (error) {
            const request = this.bulkRequests.get(requestId);
            request.status = 'failed';
            request.error = error.message;
            this.bulkRequests.set(requestId, request);

            throw error;
        }
    }

    getBulkRequest(requestId) {
        return this.bulkRequests.get(requestId);
    }

    getUserBulkRequests(userId) {
        const userRequests = [];
        for (const [requestId, request] of this.bulkRequests.entries()) {
            if (request.userId === userId) {
                userRequests.push({ requestId, ...request });
            }
        }
        return userRequests;
    }

    clearOldRequests() {
        const now = Date.now();
        const maxAge = 3600000;

        for (const [requestId, request] of this.bulkRequests.entries()) {
            if (now - request.startTime > maxAge) {
                this.bulkRequests.delete(requestId);
            }
        }
    }
}

module.exports = BulkManager;
