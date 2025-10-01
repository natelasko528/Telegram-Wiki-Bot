# ⚡ Quick Start Guide - 5 Minutes to Deploy

Too long, didn't read? Here's the fastest path to getting your bot running.

## 🎯 Prerequisites

- Telegram account
- GitHub account  
- Notion account
- Credit card (for Fly.io verification - won't be charged)

---

## 📝 Step 1: Get API Keys (3 minutes)

### Telegram Bot
1. Message [@BotFather](https://t.me/botfather) → `/newbot`
2. Copy token: `123456789:ABC...`

### Your User ID
1. Message [@userinfobot](https://t.me/userinfobot)
2. Copy your ID: `123456789`

### Google AI (FREE)
1. Visit: https://makersuite.google.com/app/apikey
2. Click "Get API Key"
3. Copy key: `AIzaSy...`

### Notion
1. Visit: https://www.notion.so/my-integrations
2. Create integration → Copy token: `secret_...`
3. Create database in Notion
4. Share database with integration
5. Copy database ID from URL

### GitHub
1. Visit: https://github.com/settings/tokens
2. Generate token (classic) with `repo` scope
3. Copy token: `ghp_...`

---

## 🚀 Step 2: Deploy to Fly.io (2 minutes)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Sign up (free)
fly auth signup

# Create project directory
mkdir telegram-wiki-bot && cd telegram-wiki-bot

# Copy all files from artifacts into this directory:
# - src/index.ts
# - package.json
# - tsconfig.json
# - Dockerfile
# - fly.toml
# - .env.example
# - .gitignore

# Create .env file with your keys
cp .env.example .env
nano .env  # Fill in your actual keys

# Launch app (creates database automatically)
fly launch
# Choose app name, region
# PostgreSQL: YES → Development (FREE)
# Redis: NO
# Deploy now: NO

# Set secrets
fly secrets set \
  TELEGRAM_BOT_TOKEN="your_token" \
  OWNER_USER_ID="your_id" \
  GOOGLE_AI_API_KEY="your_key" \
  NOTION_API_KEY="your_notion_key" \
  GITHUB_TOKEN="your_github_token" \
  NODE_ENV="production"

# Deploy!
fly deploy

# Verify
fly status
fly logs
```

---

## 📚 Step 3: Create Blog Repository

```bash
# Create repo on GitHub: my-wiki-blog (Public)

# Clone and set up Jekyll
git clone https://github.com/YOUR_USERNAME/my-wiki-blog.git
cd my-wiki-blog

mkdir _posts

cat > _config.yml << 'EOF'
title: My Wiki Blog
theme: minima
EOF

cat > index.md << 'EOF'
---
layout: home
---
Welcome!
EOF

git add .
git commit -m "Initial setup"
git push

# Enable GitHub Pages in repo settings
```

---

## ⚙️ Step 4: Configure Bot

1. Open your bot in Telegram
2. Send `/start`
3. Click "⚙️ Settings"
4. Set Notion database ID
5. Set GitHub repo: `username/repo-name`
6. Toggle auto-publish: ON or OFF

---

## 🎉 Step 5: Test

1. Create a Telegram channel (or use existing)
2. Post a message
3. Forward message to your bot
4. Bot confirms subscription
5. Post in channel: "Testing my wiki bot!"
6. Wait 30 seconds
7. Check Notion → GitHub → Blog

**Done!** 🚀

---

## 🆘 Problems?

```bash
# Bot not responding?
fly logs

# Restart
fly apps restart telegram-wiki-bot

# Check database
fly postgres connect
```

---

## 📖 Read More

- **Full guide**: See `README.md`
- **Step-by-step**: See `DEPLOYMENT_GUIDE.md`
- **Troubleshooting**: Check `README.md` → Troubleshooting section

---

## 💰 Total Cost

**$0.00/month** - Everything is on free tiers! 🎉

- Fly.io: 3 shared VMs (FREE)
- PostgreSQL: 3GB (FREE)
- Google Gemini: 1,500 requests/day (FREE)
- Notion: Unlimited pages (FREE)
- GitHub Pages: Unlimited (FREE)

---

## 🔑 Environment Variables Reference

```bash
TELEGRAM_BOT_TOKEN=     # From @BotFather
OWNER_USER_ID=          # From @userinfobot  
GOOGLE_AI_API_KEY=      # From makersuite.google.com
NOTION_API_KEY=         # From notion.so/my-integrations
GITHUB_TOKEN=           # From github.com/settings/tokens
DATABASE_URL=           # Auto-filled by Fly.io
NODE_ENV=production
PORT=3000
```

---

## 📋 Quick Commands

```bash
# Deploy
fly deploy

# View logs
fly logs

# Restart
fly apps restart

# Status
fly status

# SSH into app
fly ssh console

# Database console
fly postgres connect
```

---

**That's it! Your AI-powered wiki bot is live!** 🤖✨