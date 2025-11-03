class CacheManager {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }

    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        // Cek expiry
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            this.stats.misses++;
            this.stats.deletes++;
            return null;
        }
        
        this.stats.hits++;
        return item.data;
    }

    set(key, data, duration = 300000) {
        try {
            this.cache.set(key, {
                data: data,
                expiry: Date.now() + duration,
                created: Date.now(),
                size: this.estimateSize(data)
            });
            
            this.stats.sets++;
            return true;
        } catch (error) {
            console.error('❌ Cache set error:', error.message);
            return false;
        }
    }

    has(key) {
        const item = this.cache.get(key);
        if (!item) return false;
        
        // Cek expiry
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }

    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
        }
        return deleted;
    }

    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats = { 
            hits: 0, 
            misses: 0, 
            sets: 0, 
            deletes: this.stats.deletes + size 
        };
        console.log(`🗑️ Cache cleared: ${size} items deleted`);
    }

    /**
     * Clean expired items
     */
    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} expired cache items`);
            this.stats.deletes += cleaned;
        }
        
        return cleaned;
    }

    /**
     * Estimate data size in bytes
     */
    estimateSize(data) {
        try {
            return new TextEncoder().encode(JSON.stringify(data)).length;
        } catch {
            return 0;
        }
    }

    /**
     * Get total cache size
     */
    getTotalSize() {
        let total = 0;
        for (const item of this.cache.values()) {
            total += item.size || 0;
        }
        return total;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;
        const totalSize = this.getTotalSize();
        
        return {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            hitRate: `${hitRate}%`,
            totalSize: this.formatBytes(totalSize)
        };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get keys by pattern
     */
    getKeysByPattern(pattern) {
        const regex = new RegExp(pattern);
        const keys = [];
        
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                keys.push(key);
            }
        }
        
        return keys;
    }
}

module.exports = CacheManager;