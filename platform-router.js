class PlatformRouter {
    constructor(config) {
        this.config = config;
        this.serverAssignments = new Map();
        this.initServerAssignments();
    }

    /**
     * Initialize: 1 Platform = 1 Dedicated Server
     */
    initServerAssignments() {
        this.config.PLATFORMS.forEach(platform => {
            this.serverAssignments.set(platform.id, {
                platformId: platform.id,
                platformName: platform.name,
                serverUrl: platform.server,
                baseUrl: platform.url,
                status: 'ready',
                lastUsed: null,
                requestCount: 0
            });
        });
        
        console.log(`🖥️ Platform Router: ${this.serverAssignments.size} dedicated servers assigned`);
    }

    /**
     * Route workers to their dedicated servers
     */
    routeWorkers(workers, maxWorkers) {
        const selectedWorkers = workers.slice(0, maxWorkers);
        
        selectedWorkers.forEach(worker => {
            const assignment = this.serverAssignments.get(worker.platform.id);
            if (assignment) {
                // Assign dedicated server to worker
                worker.assignedServer = assignment.serverUrl;
                assignment.lastUsed = Date.now();
                assignment.requestCount++;
                assignment.status = 'active';
                
                console.log(`🔗 Worker ${worker.platform.id} (${worker.platform.name}) → Server: ${assignment.serverUrl}`);
            }
        });
        
        return selectedWorkers;
    }

    /**
     * Get server info for platform
     */
    getServerInfo(platformId) {
        return this.serverAssignments.get(platformId);
    }

    /**
     * Get all server assignments
     */
    getAllAssignments() {
        return Array.from(this.serverAssignments.values());
    }

    /**
     * Get statistics
     */
    getStats() {
        const assignments = Array.from(this.serverAssignments.values());
        
        return {
            totalServers: assignments.length,
            activeServers: assignments.filter(a => a.status === 'active').length,
            readyServers: assignments.filter(a => a.status === 'ready').length,
            totalRequests: assignments.reduce((sum, a) => sum + a.requestCount, 0),
            mostUsedServer: assignments.sort((a, b) => b.requestCount - a.requestCount)[0]
        };
    }

    /**
     * Reset server status
     */
    resetServers() {
        this.serverAssignments.forEach(assignment => {
            assignment.status = 'ready';
        });
        console.log('🔄 All servers reset to ready state');
    }
}

module.exports = PlatformRouter;