# 📁 Project Structure

Complete file organization for the Telegram Wiki Bot project.

## Directory Layout

```
telegram-wiki-bot/                    # Main project directory
│
├── src/                              # Source code directory
│   └── index.ts                      # Main bot application (4,500 lines)
│
├── dist/                             # Compiled JavaScript (auto-generated)
│   ├── index.js                      # Compiled bot code
│   └── index.js.map                  # Source map for debugging
│
├── node_modules/                     # NPM dependencies (auto-generated)
│   ├── telegraf/                     # Telegram bot framework
│   ├── @google/generative-ai/        # Google Gemini AI SDK
│   ├── @notionhq/client/             # Notion API client
│   ├── @octokit/rest/                # GitHub API client
│   ├── pg/                           # PostgreSQL client
│   └── ... (many more)
│
├── .fly/                             # Fly.io local data (auto-generated)
│
├── .env                              # 🔐 Environment variables (SECRET!)
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
│
├── package.json                      # Node.js project configuration
├── package-lock.json                 # Dependency lock file (auto-generated)
├── tsconfig.json                     # TypeScript configuration
│
├── Dockerfile                        # Docker container definition
├── fly.toml                          # Fly.io deployment configuration
│
├── README.md                         # Main documentation (comprehensive)
├── QUICKSTART.md                     # 5-minute setup guide
├── DEPLOYMENT_GUIDE.md               # Detailed step-by-step deployment
├── PROJECT_STRUCTURE.md              # This file
│
└── verify-setup.sh                   # Automated verification script
```

---

## File Descriptions

### Core Application Files

#### `src/index.ts` (MAIN APPLICATION)
**Purpose**: The heart of your bot
**Contains**:
- Telegram bot setup and handlers
- AI message analysis logic
- Database operations
- Notion integration
- GitHub integration
- Custom menu system
- User authorization
- Message processing pipeline

**Key sections**:
```typescript
// Imports and setup
import { Telegraf } from 'telegraf';
import { GoogleGenerativeAI } from '@google/generative-ai';
// ...

// Database initialization
async function initDatabase() { ... }

// Bot commands
bot.start(async (ctx) => { ... })
bot.hears('📊 Status', async (ctx) => { ... })
// ...

// Message processing
async function processMessages() { ... }

// Publishing functions
async function publishToNotion() { ... }
async function publishToGitHub() { ... }
```

---

### Configuration Files

#### `package.json`
**Purpose**: Node.js project manifest
**Defines**:
- Project name and version
- Dependencies (telegraf, @google/generative-ai, etc.)
- Scripts (build, start, dev)
- Node.js engine version (≥18)

**Key scripts**:
```json
{
  "scripts": {
    "build": "tsc",              // Compile TypeScript
    "start": "node dist/index.js", // Run production
    "dev": "ts-node src/index.ts"  // Development mode
  }
}
```

#### `tsconfig.json`
**Purpose**: TypeScript compiler configuration
**Configures**:
- Target: ES2022
- Module system: CommonJS
- Output directory: `dist/`
- Source directory: `src/`
- Strict type checking enabled

#### `Dockerfile`
**Purpose**: Container image definition for Fly.io
**Process**:
1. Use Node.js 18 Alpine base
2. Install dependencies
3. Compile TypeScript
4. Remove source files
5. Expose port 3000
6. Set health check
7. Start application

#### `fly.toml`
**Purpose**: Fly.io deployment configuration
**Defines**:
- App name
- Region (e.g., `dfw` for Dallas)
- Memory: 512MB
- CPU: 1 shared core
- Health check endpoint: `/health`
- Auto-start/stop behavior

---

### Environment Files

#### `.env` (🔐 NEVER COMMIT THIS!)
**Purpose**: Store secret API keys and configuration
**Contains**:
```bash
TELEGRAM_BOT_TOKEN=123456789:ABC...
OWNER_USER_ID=123456789
GOOGLE_AI_API_KEY=AIzaSy...
NOTION_API_KEY=secret_...
GITHUB_TOKEN=ghp_...
DATABASE_URL=postgres://...
NODE_ENV=production
PORT=3000
```

**⚠️ Security**: This file must be in `.gitignore`!

#### `.env.example`
**Purpose**: Template for `.env` file
**Contains**: Same structure as `.env` but with placeholder values
**Usage**: Copy to `.env` and fill in real values

---

### Documentation Files

#### `README.md` (Primary Documentation)
**Sections**:
- Features overview
- Quick start guide
- Prerequisites
- API key setup instructions
- Deployment guide
- Bot commands reference
- Configuration options
- AI capabilities explanation
- Cost breakdown
- Troubleshooting
- Security best practices

**Length**: ~500 lines
**Audience**: Everyone

#### `DEPLOYMENT_GUIDE.md` (Step-by-Step)
**Sections**:
- Estimated time: 30 minutes
- Part 1: Local setup (10 min)
- Part 2: Get API keys (10 min)
- Part 3: Create blog repo (5 min)
- Part 4: Deploy to Fly.io (10 min)
- Part 5: Configure bot (5 min)
- Part 6: Test everything (5 min)
- Verification checklist
- Troubleshooting

**Length**: ~400 lines
**Audience**: First-time deployers

#### `QUICKSTART.md` (5-Minute Guide)
**Sections**:
- Absolute minimum steps
- Command-by-command deployment
- Quick reference
- Essential commands

**Length**: ~150 lines
**Audience**: Experienced developers

#### `PROJECT_STRUCTURE.md` (This File)
**Sections**:
- Directory layout
- File descriptions
- Code organization
- Data flow diagram

**Length**: You're reading it!
**Audience**: Developers who want to understand the codebase

---

### Utility Files

#### `verify-setup.sh`
**Purpose**: Automated setup verification
**Checks**:
1. Required files exist
2. Project structure correct
3. Dependencies installed
4. Environment variables set
5. TypeScript compiles
6. Fly.io configured
7. Git repository initialized
8. Network connectivity
9. API key formats

**Usage**:
```bash
chmod +x verify-setup.sh
./verify-setup.sh
```

**Output**: Checklist of passed/failed checks

#### `.gitignore`
**Purpose**: Prevent committing sensitive files
**Ignores**:
- `node_modules/` (dependencies)
- `.env` (secrets)
- `dist/` (compiled code)
- `.fly/` (Fly.io local data)
- IDE files (.vscode, .idea)
- OS files (.DS_Store)
- Log files (*.log)

---

## Data Flow

### Message Processing Pipeline

```
┌─────────────────────────────────────┐
│   Telegram Channel/Group            │
│   User posts message                │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Bot Monitors (src/index.ts)       │
│   - Checks subscribed sources       │
│   - Every 30 seconds                │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Database (PostgreSQL)             │
│   Table: pending_messages           │
│   - Store message temporarily       │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   AI Analysis (Google Gemini)       │
│   - Is it informational?            │
│   - Should messages combine?        │
│   - Generate title                  │
│   - Format content                  │
└──────────────┬──────────────────────┘
               │
          ┌────┴────┐
          ↓         ↓
  Auto-publish?   Manual review?
          │         │
          ↓         ↓
┌─────────────┐  ┌─────────────────┐
│ Publish     │  │ Create pending  │
│ immediately │  │ post for review │
└──────┬──────┘  └────────┬────────┘
       │                  │
       │        User approves
       │                  │
       └──────────┬───────┘
                  ↓
     ┌────────────────────────┐
     │  Dual Publishing       │
     │  (parallel)            │
     └─┬──────────────────┬───┘
       │                  │
       ↓                  ↓
┌─────────────┐    ┌──────────────┐
│   Notion    │    │   GitHub     │
│   Database  │    │   Repository │
│   (API)     │    │   (API)      │
└─────────────┘    └──────┬───────┘
                          │
                          ↓
                   ┌──────────────┐
                   │ GitHub Pages │
                   │ Auto-deploy  │
                   │ (Jekyll)     │
                   └──────────────┘
                          │
                          ↓
                   ┌──────────────┐
                   │  Public Blog │
                   │  🌐 Live!    │
                   └──────────────┘
```

---

## Database Schema

Located in: `src/index.ts` → `initDatabase()` function

### Tables

#### `users`
```sql
user_id BIGINT PRIMARY KEY
username VARCHAR(255)
is_authorized BOOLEAN DEFAULT false
created_at TIMESTAMP
```
**Purpose**: Track authorized users

#### `user_settings`
```sql
user_id BIGINT PRIMARY KEY
auto_publish BOOLEAN DEFAULT false
combine_threshold_minutes INT DEFAULT 5
notion_database_id VARCHAR(255)
github_repo VARCHAR(255)
updated_at TIMESTAMP
```
**Purpose**: Store per-user configuration

#### `monitored_sources`
```sql
id SERIAL PRIMARY KEY
user_id BIGINT
chat_id BIGINT NOT NULL
chat_title VARCHAR(255)
chat_type VARCHAR(50)
topic_id INT
is_active BOOLEAN DEFAULT true
created_at TIMESTAMP
```
**Purpose**: Track subscribed channels/groups

#### `pending_messages`
```sql
id SERIAL PRIMARY KEY
source_id INT
message_id BIGINT NOT NULL
text TEXT
media_urls TEXT[]
sender VARCHAR(255)
timestamp TIMESTAMP NOT NULL
is_processed BOOLEAN DEFAULT false
created_at TIMESTAMP
```
**Purpose**: Queue for message processing

#### `blog_posts`
```sql
id SERIAL PRIMARY KEY
user_id BIGINT
title VARCHAR(500)
content TEXT
media_urls TEXT[]
source_messages INT[]
notion_page_id VARCHAR(255)
github_commit_sha VARCHAR(255)
status VARCHAR(50) DEFAULT 'pending'
created_at TIMESTAMP
published_at TIMESTAMP
```
**Purpose**: Track published posts

---

## Code Organization

### Main Functions in `src/index.ts`

#### Setup & Initialization
- `initDatabase()` - Create database tables
- `main()` - Start bot and background tasks

#### User Management
- `isAuthorized()` - Check if user can use bot
- `getUserSettings()` - Fetch user preferences

#### Message Processing
- `analyzeMessages()` - Send to AI for analysis
- `analyzeImage()` - Process images with AI vision
- `processMessages()` - Background job (every 30s)

#### Publishing
- `publishToNotion()` - Create Notion page
- `publishToGitHub()` - Commit to GitHub repo
- `publishPost()` - Orchestrate dual publishing

#### Bot Handlers
- `bot.start()` - Welcome message
- `bot.hears('📊 Status')` - Show statistics
- `bot.hears('⚙️ Settings')` - Configuration menu
- `bot.hears('➕ Subscribe')` - Add channel
- `bot.hears('📋 List Sources')` - Show subscriptions
- `bot.hears('📝 Pending Posts')` - Review queue
- `bot.action('publish_*')` - Publish post
- `bot.action('reject_*')` - Delete post

---

## Dependencies Overview

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `telegraf` | ^4.16.3 | Telegram bot framework |
| `@google/generative-ai` | ^0.21.0 | Google Gemini AI SDK |
| `@notionhq/client` | ^2.2.15 | Notion API client |
| `@octokit/rest` | ^21.0.2 | GitHub API client |
| `pg` | ^8.13.1 | PostgreSQL database |
| `axios` | ^1.7.7 | HTTP requests |
| `express` | ^4.21.1 | Health check server |
| `dotenv` | ^16.4.5 | Environment variables |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.6.3 | TypeScript compiler |
| `ts-node` | ^10.9.2 | Run TS in dev mode |
| `@types/*` | Various | TypeScript definitions |
| `eslint` | ^9.14.0 | Code linting |

---

## Deployment Artifacts

### Built by `npm run build`
- `dist/index.js` - Compiled JavaScript
- `dist/index.js.map` - Source map

### Created by Fly.io
- `.fly/` directory - Local Fly.io data
- Remote: Docker image
- Remote: PostgreSQL database

### Generated at runtime
- Database tables (see schema above)
- Log files (viewable via `fly logs`)

---

## File Creation Order

When setting up from scratch:

1. **Create directory**
   ```bash
   mkdir telegram-wiki-bot
   cd telegram-wiki-bot
   ```

2. **Initialize git**
   ```bash
   git init
   ```

3. **Create essential files** (in this order):
   - `.gitignore` (prevent committing secrets)
   - `package.json` (define project)
   - `tsconfig.json` (TypeScript config)
   - `.env.example` (template)
   - `.env` (actual secrets)

4. **Create source code**:
   - `src/` directory
   - `src/index.ts` (main code)

5. **Create deployment files**:
   - `Dockerfile` (container)
   - `fly.toml` (Fly.io config)

6. **Create documentation**:
   - `README.md`
   - `DEPLOYMENT_GUIDE.md`
   - `QUICKSTART.md`
   - `PROJECT_STRUCTURE.md`

7. **Create utilities**:
   - `verify-setup.sh`

8. **Install dependencies**:
   ```bash
   npm install
   ```

9. **Build**:
   ```bash
   npm run build
   ```

---

## File Sizes (Approximate)

| File | Lines of Code | Size |
|------|---------------|------|
| `src/index.ts` | ~800 | 35 KB |
| `package.json` | ~50 | 1.5 KB |
| `README.md` | ~600 | 40 KB |
| `DEPLOYMENT_GUIDE.md` | ~450 | 25 KB |
| `QUICKSTART.md` | ~150 | 8 KB |
| `verify-setup.sh` | ~400 | 15 KB |
| Total (source) | ~2,450 | ~125 KB |

---

## Important Paths

### Local Development
- Source code: `./src/index.ts`
- Compiled code: `./dist/index.js`
- Environment: `./.env`
- Dependencies: `./node_modules/`

### Production (Fly.io)
- Application: `/app/`
- Compiled code: `/app/dist/index.js`
- Node modules: `/app/node_modules/`
- Environment: Set via `fly secrets`

### Database (PostgreSQL)
- Connection: Via `DATABASE_URL` environment variable
- Managed by: Fly.io PostgreSQL service
- Access: `fly postgres connect`

---

## Summary

This project is organized for:
- ✅ **Clarity**: Easy to understand structure
- ✅ **Security**: Secrets in `.env`, not in code
- ✅ **Scalability**: Modular functions, clear separation
- ✅ **Maintainability**: Well-documented, TypeScript typed
- ✅ **Deployability**: Single command deploy (`fly deploy`)

**Total project size**: ~125 KB source + dependencies
**Deployment size**: ~50 MB Docker image
**Runtime memory**: ~100-200 MB

---

**Need to modify something?** Everything is in `src/index.ts`!
**Need to redeploy?** Just run `fly deploy`!
**Need help?** Check `README.md` → Troubleshooting!