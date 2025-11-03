# 🚀 NOKOS Bot V3.0 - Enterprise SMS Service

Full-featured Telegram bot for free SMS verification with 100 servers, 250 countries, and enterprise features.

## ✨ Features

### Core Features
- 🌐 100 Dedicated Servers (1 per platform)
- 🌍 250 Countries Available
- 📱 100+ Social Media Detection
- ⚡ Real-time SMS Updates
- 💾 Smart Caching System
- 🔄 Auto-retry Mechanism

### Enterprise Features
- ⭐ Favorite Numbers Management
- 🔍 Advanced Search & Filter
- 📦 Bulk Operations (up to 50 numbers)
- ⭐ Number Rating System
- 📡 REST API for Developers
- 🔔 Webhook Integration
- 💾 Data Export (JSON/CSV)
- 📊 Personal Statistics
- 🗑️ Auto-delete Messages
- 🧹 Clear Chat Command

## 🎯 Quick Start

### Installation
```bash
npm install
```

### Configuration

Edit `config.js`:
- Set your `BOT_TOKEN`
- Set your `OWNER_ID`
- Add your `BOT_IMAGE` URL (bot profile picture)

### Run
```bash
npm start
```

For development:
```bash
npm run dev
```

## 📖 Bot Commands

### Basic Commands
- `/start` - Main menu
- `/help` - Help & commands
- `/stats` - Bot statistics
- `/clear` - Clear chat history

### Favorite Commands
- `/favorite list` - Show all favorites
- Use ⭐ button when viewing SMS

### Search Commands
- `/search whatsapp` - Search by service
- `/search 123456` - Search by code

### Bulk Commands
- `/bulk 1 us 5` - Request 5 US numbers from server 1

### Export Commands
- `/export json` - Export as JSON
- `/export csv` - Export as CSV
- `/export favorites` - Backup favorites

### Developer Commands
- `/api` - API information
- `/mystats` - Your statistics

## 📡 API Documentation

### Base URL
```
http://localhost:3000
```

### Authentication
Add header:
```
X-API-Key: your_api_key_here
```

### Endpoints

#### Get All Servers
```bash
GET /api/servers
```

#### Get Server Info
```bash
GET /api/servers/:serverId
```

#### Get All Countries
```bash
GET /api/countries
```

#### Get Numbers
```bash
GET /api/numbers/:serverId/:countryCode
```

#### Get SMS
```bash
GET /api/sms/:serverId/:number?country=us
```

#### Health Check
```bash
GET /api/health
```

### Example Usage
```bash
curl -H "X-API-Key: your_key" \
  http://localhost:3000/api/servers
```
```bash
curl -H "X-API-Key: your_key" \
  http://localhost:3000/api/numbers/1/us
```

## 🏗️ Project Structure
```
nokos-bot/
├── config.js                 # Configuration
├── index.js                  # Main bot file
├── package.json              # Dependencies
├── core/
│   ├── controller.js         # Main controller
│   ├── cache.js              # Cache manager
│   └── country-filter.js     # Country filter
├── features/
│   ├── favorite-manager.js   # Favorites
│   ├── search-manager.js     # Search
│   ├── bulk-manager.js       # Bulk operations
│   ├── rating-manager.js     # Rating system
│   ├── webhook-manager.js    # Webhooks
│   └── export-manager.js     # Data export
├── api/
│   └── server.js             # API server
├── workers/
│   └── base-worker.js        # Worker base
├── scrapers/
│   └── scraper.js            # Web scraper
├── detectors/
│   └── social-detector.js    # Social media detector
└── utils/
    ├── error-handler.js      # Error handler
    └── validator.js          # Validator
```

## 🎨 Bot Features Detail

### 1. Favorite Numbers
- Save frequently used numbers
- Quick access from favorites menu
- Rating system for each number
- Bulk operations on favorites

### 2. Search System
- Search by service (WhatsApp, Telegram, etc)
- Search by verification code
- Search by phone number
- Search history tracking

### 3. Bulk Operations
- Request multiple numbers at once (1-50)
- Perfect for load testing
- Batch processing
- Export bulk results

### 4. Rating System
- Auto-rate numbers based on success
- Star rating (1-5 stars)
- Server reliability tracking
- Success rate percentage

### 5. API Access
- RESTful API for developers
- API key authentication
- Full CRUD operations
- Rate limiting support

### 6. Webhooks
- Real-time SMS notifications
- Custom webhook URLs
- Event filtering
- Retry mechanism

### 7. Data Export
- JSON format for developers
- CSV format for Excel
- Favorites backup
- Scheduled exports

### 8. Auto-delete
- Configurable delay (default 5 minutes)
- Only for specific menus
- /start menu never deleted
- Manual clear with /clear

## ⚙️ Advanced Configuration

### Auto-delete Settings
```javascript
AUTO_DELETE_ENABLED: true,
AUTO_DELETE_DELAY: 300000, // 5 minutes
```

### API Settings
```javascript
API_ENABLED: true,
API_PORT: 3000,
```

### Cache Settings
```javascript
CACHE_DURATION: 300000, // 5 minutes
```

## 🔒 Security

- API key authentication
- Rate limiting
- Request validation
- Error handling
- Safe operations

## 🐛 Troubleshooting

### Bot not starting
- Check BOT_TOKEN is correct
- Check Node.js version (14+)
- Run `npm install` first

### API not working
- Check API_ENABLED is true
- Check port 3000 is available
- Check API_KEY is set

### Images not showing
- Set BOT_IMAGE URL in config.js
- Use direct image URL (imgur, etc)
- Check image is publicly accessible

## 📊 Statistics

Bot tracks:
- Total requests
- Success/fail rate
- Cache hit rate
- Active users
- Popular countries
- Popular servers

## 🚀 Performance

- Caching for speed
- Concurrent scraping
- Timeout protection
- Error recovery
- Memory management

## 🤝 Contributing

This is a private project by @Jeeyhosting

## 📄 License

MIT License

## 📧 Support

Contact: @Jeeyhosting on Telegram

---

Made with ❤️ by @Jeeyhosting
