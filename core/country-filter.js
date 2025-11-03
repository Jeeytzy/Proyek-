class CountryFilter {
    constructor(config) {
        this.config = config;
        this.countryDialCodes = this.buildDialCodeMap();
    }

    buildDialCodeMap() {
        const map = new Map();
        this.config.COUNTRIES.forEach(country => {
            map.set(country.code, {
                dialCode: country.dialCode,
                name: country.name,
                flag: country.flag
            });
        });
        return map;
    }

    /**
     * Filter nomor berdasarkan negara
     * PENTING: Hanya nomor dari negara yang diminta yang akan dikembalikan
     */
    filterByCountry(numbers, countryCode) {
        const country = this.countryDialCodes.get(countryCode);
        
        if (!country) {
            console.warn(`⚠️ Country ${countryCode} not found in config`);
            return [];
        }

        const dialCode = country.dialCode;
        
        // Filter nomor yang benar-benar dari negara ini
        const filtered = numbers.filter(number => {
            const cleanNumber = this.cleanNumber(number);
            // Cek apakah nomor dimulai dengan dial code negara ini
            if (cleanNumber.startsWith(dialCode.replace('+', ''))) {
                return true;
            }
            
            // Cek format alternatif
            if (cleanNumber.startsWith(dialCode)) {
                return true;
            }
            
            return false;
        });

        console.log(`✅ Filtered ${filtered.length}/${numbers.length} numbers for ${country.name}`);
        
        return filtered;
    }

    cleanNumber(number) {
        // Hapus semua karakter non-digit kecuali +
        return number.toString().replace(/[^\d+]/g, '');
    }

    /**
     * Validasi apakah nomor valid untuk negara tertentu
     */
    isValidForCountry(number, countryCode) {
        const country = this.countryDialCodes.get(countryCode);
        if (!country) return false;

        const cleanNumber = this.cleanNumber(number);
        const dialCode = country.dialCode.replace('+', '');
        
        return cleanNumber.startsWith(dialCode) || cleanNumber.startsWith('+' + dialCode);
    }

    /**
     * Detect negara dari nomor telepon
     */
    detectCountry(number) {
        const cleanNumber = this.cleanNumber(number);
        
        // Cari negara yang cocok berdasarkan dial code
        for (const [code, data] of this.countryDialCodes.entries()) {
            const dialCode = data.dialCode.replace('+', '');
            if (cleanNumber.startsWith(dialCode) || cleanNumber.startsWith('+' + dialCode)) {
                return {
                    code: code,
                    ...data
                };
            }
        }
        
        return null;
    }

    /**
     * Format nomor sesuai negara
     */
    formatNumber(number, countryCode) {
        const country = this.countryDialCodes.get(countryCode);
        if (!country) return number;

        let cleanNumber = this.cleanNumber(number);
        const dialCode = country.dialCode.replace('+', '');
        
        // Pastikan nomor dimulai dengan dial code
        if (!cleanNumber.startsWith(dialCode) && !cleanNumber.startsWith('+')) {
            cleanNumber = dialCode + cleanNumber;
        }
        
        // Tambahkan + di depan
        if (!cleanNumber.startsWith('+')) {
            cleanNumber = '+' + cleanNumber;
        }
        
        return cleanNumber;
    }

    /**
     * Get country info
     */
    getCountryInfo(countryCode) {
        const country = this.countryDialCodes.get(countryCode);
        if (!country) return null;
        
        return {
            code: countryCode,
            ...country
        };
    }
}

module.exports = CountryFilter;