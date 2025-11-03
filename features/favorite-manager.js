class FavoriteManager {
    constructor() {
        this.favorites = new Map();
    }

    addFavorite(userId, favoriteData) {
        if (!this.favorites.has(userId)) {
            this.favorites.set(userId, []);
        }

        const userFavorites = this.favorites.get(userId);
        
        const exists = userFavorites.some(fav => fav.number === favoriteData.number);
        if (exists) {
            return { success: false, message: 'Already in favorites' };
        }

        userFavorites.push(favoriteData);
        this.favorites.set(userId, userFavorites);

        console.log(`⭐ User ${userId} added favorite: ${favoriteData.number}`);
        return { success: true, message: 'Added to favorites' };
    }

    removeFavorite(userId, number) {
        if (!this.favorites.has(userId)) {
            return { success: false, message: 'No favorites found' };
        }

        const userFavorites = this.favorites.get(userId);
        const filtered = userFavorites.filter(fav => fav.number !== number);
        
        if (filtered.length === userFavorites.length) {
            return { success: false, message: 'Favorite not found' };
        }

        this.favorites.set(userId, filtered);

        console.log(`🗑️ User ${userId} removed favorite: ${number}`);
        return { success: true, message: 'Removed from favorites' };
    }

    getFavorites(userId) {
        return this.favorites.get(userId) || [];
    }

    getFavorite(userId, number) {
        const userFavorites = this.getFavorites(userId);
        return userFavorites.find(fav => fav.number === number);
    }

    clearFavorites(userId) {
        this.favorites.delete(userId);
        console.log(`🗑️ User ${userId} cleared all favorites`);
        return { success: true, message: 'All favorites cleared' };
    }

    getUserStats(userId) {
        const userFavorites = this.getFavorites(userId);
        
        const countries = new Set();
        const servers = new Set();
        
        userFavorites.forEach(fav => {
            countries.add(fav.countryCode);
            servers.add(fav.serverId);
        });

        return {
            totalFavorites: userFavorites.length,
            uniqueCountries: countries.size,
            uniqueServers: servers.size
        };
    }

    getTotalFavorites() {
        let total = 0;
        for (const userFavorites of this.favorites.values()) {
            total += userFavorites.length;
        }
        return total;
    }

    getTotalUsers() {
        return this.favorites.size;
    }
}

module.exports = FavoriteManager;