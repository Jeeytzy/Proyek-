class ExportManager {
    constructor() {
        this.exports = new Map();
    }

    exportToJSON(userId, data) {
        const exportId = `export_${userId}_${Date.now()}`;
        
        const jsonData = JSON.stringify(data, null, 2);
        
        this.exports.set(exportId, {
            id: exportId,
            userId: userId,
            format: 'json',
            data: jsonData,
            size: Buffer.byteLength(jsonData),
            createdAt: new Date().toISOString()
        });

        console.log(`💾 Exported to JSON: ${exportId}`);
        
        return {
            success: true,
            exportId: exportId,
            data: jsonData,
            format: 'json'
        };
    }

    exportToCSV(userId, data) {
        const exportId = `export_${userId}_${Date.now()}`;
        
        let csv = '';
        
        if (data.length > 0) {
            const headers = Object.keys(data[0]);
            csv = headers.join(',') + '\n';
            
            data.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header];
                    return typeof value === 'string' && value.includes(',')
                        ? `"${value}"`
                        : value;
                });
                csv += values.join(',') + '\n';
            });
        }
        
        this.exports.set(exportId, {
            id: exportId,
            userId: userId,
            format: 'csv',
            data: csv,
            size: Buffer.byteLength(csv),
            createdAt: new Date().toISOString()
        });

        console.log(`💾 Exported to CSV: ${exportId}`);
        
        return {
            success: true,
            exportId: exportId,
            data: csv,
            format: 'csv'
        };
    }

    getExport(exportId) {
        return this.exports.get(exportId);
    }

    getUserExports(userId) {
        const userExports = [];
        
        for (const [exportId, exportData] of this.exports.entries()) {
            if (exportData.userId === userId) {
                userExports.push({
                    id: exportId,
                    format: exportData.format,
                    size: exportData.size,
                    createdAt: exportData.createdAt
                });
            }
        }

        return userExports;
    }

    clearOldExports() {
        const now = Date.now();
        const maxAge = 3600000;

        for (const [exportId, exportData] of this.exports.entries()) {
            const createdAt = new Date(exportData.createdAt).getTime();
            if (now - createdAt > maxAge) {
                this.exports.delete(exportId);
            }
        }
    }
}

module.exports = ExportManager;