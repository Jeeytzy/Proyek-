class RatingManager {
    constructor() {
        this.numberRatings = new Map();
        this.serverRatings = new Map();
    }

    rateNumber(number, success) {
        if (!this.numberRatings.has(number)) {
            this.numberRatings.set(number, {
                successCount: 0,
                failCount: 0,
                totalAttempts: 0,
                lastUsed: Date.now()
            });
        }

        const rating = this.numberRatings.get(number);
        rating.totalAttempts++;
        
        if (success) {
            rating.successCount++;
        } else {
            rating.failCount++;
        }
        
        rating.lastUsed = Date.now();
        this.numberRatings.set(number, rating);

        console.log(`⭐ Rated number ${number}: ${success ? 'SUCCESS' : 'FAIL'}`);
    }

    getNumberRating(number) {
        const rating = this.numberRatings.get(number);
        
        if (!rating) {
            return {
                stars: '⭐',
                successRate: '0%',
                attempts: 0
            };
        }

        const successRate = rating.totalAttempts > 0
            ? ((rating.successCount / rating.totalAttempts) * 100).toFixed(0)
            : 0;

        let stars = '';
        if (successRate >= 90) stars = '⭐⭐⭐⭐⭐';
        else if (successRate >= 75) stars = '⭐⭐⭐⭐';
        else if (successRate >= 60) stars = '⭐⭐⭐';
        else if (successRate >= 40) stars = '⭐⭐';
        else if (successRate >= 20) stars = '⭐';
        else stars = '❌';

        return {
            stars: stars,
            successRate: `${successRate}%`,
            attempts: rating.totalAttempts,
            successCount: rating.successCount,
            failCount: rating.failCount
        };
    }

    rateServer(serverId, success) {
        if (!this.serverRatings.has(serverId)) {
            this.serverRatings.set(serverId, {
                successCount: 0,
                failCount: 0,
                totalRequests: 0,
                lastUsed: Date.now()
            });
        }

        const rating = this.serverRatings.get(serverId);
        rating.totalRequests++;
        
        if (success) {
            rating.successCount++;
        } else {
            rating.failCount++;
        }
        
        rating.lastUsed = Date.now();
        this.serverRatings.set(serverId, rating);

        console.log(`⭐ Rated server ${serverId}: ${success ? 'SUCCESS' : 'FAIL'}`);
    }

    getServerRating(serverId) {
        const rating = this.serverRatings.get(serverId);
        
        if (!rating) {
            return {
                stars: '⭐⭐⭐',
                successRate: 'New',
                requests: 0
            };
        }

        const successRate = rating.totalRequests > 0
            ? ((rating.successCount / rating.totalRequests) * 100).toFixed(0)
            : 0;

        let stars = '';
        if (successRate >= 90) stars = '⭐⭐⭐⭐⭐';
        else if (successRate >= 75) stars = '⭐⭐⭐⭐';
        else if (successRate >= 60) stars = '⭐⭐⭐';
        else if (successRate >= 40) stars = '⭐⭐';
        else if (successRate >= 20) stars = '⭐';
        else stars = '❌';

        return {
            stars: stars,
            successRate: `${successRate}%`,
            requests: rating.totalRequests,
            successCount: rating.successCount,
            failCount: rating.failCount
        };
    }

    getTopNumbers(limit = 10) {
        const sorted = Array.from(this.numberRatings.entries())
            .map(([number, rating]) => ({
                number,
                successRate: (rating.successCount / rating.totalAttempts) * 100,
                attempts: rating.totalAttempts
            }))
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, limit);

        return sorted;
    }

    getTopServers(limit = 10) {
        const sorted = Array.from(this.serverRatings.entries())
            .map(([serverId, rating]) => ({
                serverId,
                successRate: (rating.successCount / rating.totalRequests) * 100,
                requests: rating.totalRequests
            }))
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, limit);

        return sorted;
    }
}

module.exports = RatingManager;