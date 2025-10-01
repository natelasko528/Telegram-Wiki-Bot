# 🔧 Troubleshooting Guide

Complete guide to diagnosing and fixing common issues with your Telegram Wiki Bot.

---

## 📋 Quick Diagnostic Checklist

Run through this checklist first:

```bash
# 1. Is the bot running?
fly status

# 2. Check recent logs
fly logs --app telegram-wiki-bot

# 3. Test bot connection
curl https://telegram-wiki-bot.fly.dev/health

# 4. Check database
fly postgres connect -a telegram-wiki-bot-db

# 5. Verify secrets are set
fly secrets list
```

---

## 🚨 Critical Issues

### Issue: Bot Not Responding to Commands

**Symptoms:**
- Send `/start` to bot, no response
- Menu buttons don't work
- Bot appears offline

**Diagnostic Steps:**
```bash
# Check if app is running
fly status

# Expected output:
# Status: Running
# Health Checks: 1 passing
```

**Solutions:**

**Solution 1: Restart the bot**
```bash
fly apps restart telegram-wiki-bot

# Wait 30 seconds
fly status
```

**Solution 2: Check logs for errors**
```bash
fly logs

# Look for:
# ✅ "Bot started successfully"
# ❌ "Error:" messages
```

**Solution 3: Verify bot token**
```bash
# Re-set the token
fly secrets set TELEGRAM_BOT_TOKEN="your_actual_token"

# This will automatically restart the app
```

**Solution 4: Check authorization**
```bash
# Connect to database
fly postgres connect -a telegram-wiki-bot-db

# Check your user record
SELECT * FROM users WHERE user_id = YOUR_USER_ID;

# If not authorized:
UPDATE users SET is_authorized = true WHERE user_id = YOUR_USER_ID;
```

**Solution 5: Webhook conflicts**
```bash
# If bot was previously using webhooks, clear them:
# Visit in browser (replace with your token):
https://api.telegram.org/botYOUR_BOT_TOKEN/deleteWebhook

# Then restart
fly apps restart telegram-wiki-bot
```

---

### Issue: Database Connection Errors

**Symptoms:**
- Bot logs show "Error connecting to database"
- "Connection refused" errors
- "SSL connection error"

**Diagnostic Steps:**
```bash
# Check if database exists
fly postgres list

# Check connection
fly postgres connect -a telegram-wiki-bot-db

# Inside postgres, check tables
\dt
```

**Solutions:**

**Solution 1: Database not attached**
```bash
# Attach database to app
fly postgres attach --app telegram-wiki-bot YOUR_DB_NAME
```

**Solution 2: DATABASE_URL not set**
```bash
# Check if DATABASE_URL is set
fly secrets list | grep DATABASE

# If not listed, attach database (it will auto-set)
fly postgres attach --app telegram-wiki-bot YOUR_DB_NAME
```

**Solution 3: Tables not created**
```bash
# Connect to database
fly postgres connect -a telegram-wiki-bot-db

# Check for tables
\dt

# If empty, restart app (initDatabase runs on start)
fly apps restart telegram-wiki-bot
```

**Solution 4: Connection pool exhausted**
```bash
# Scale up database (still free tier)
fly postgres restart -a telegram-wiki-bot-db
```

---

### Issue: Messages Not Being Processed

**Symptoms:**
- Bot status shows 0 pending messages
- Posted in monitored channel but nothing happens
- No posts being created

**Diagnostic Steps:**
```bash
# Check if sources are being monitored
fly ssh console
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT * FROM monitored_sources WHERE is_active = true')
  .then(r => console.log(r.rows))
  .then(() => pool.end());
"
```

**Solutions:**

**Solution 1: Channel not subscribed**
- In bot, click "📋 List Sources"
- If channel not listed, forward a message from it to bot
- Bot should confirm subscription

**Solution 2: Bot not member of channel**
- If private channel: Add bot as admin
- If public channel: Should work automatically
- Test by forwarding a message

**Solution 3: Message processing loop not running**
```bash
# Check logs for "Processing messages..."
fly logs | grep -i process

# If not appearing every 30s, restart
fly apps restart telegram-wiki-bot
```

**Solution 4: Check pending_messages table**
```bash
fly postgres connect -a telegram-wiki-bot-db

# Check for unprocessed messages
SELECT COUNT(*) FROM pending_messages WHERE is_processed = false;

# View recent messages
SELECT * FROM pending_messages ORDER BY created_at DESC LIMIT 5;

# If messages stuck, manually process:
UPDATE pending_messages SET is_processed = false WHERE id = X;
```

---

### Issue: AI Analysis Failing

**Symptoms:**
- Error: "AI response not in expected JSON format"
- Posts not being created despite messages
- Logs show Google AI errors

**Diagnostic Steps:**
```bash
# Check if Google AI key is set
fly secrets list | grep GOOGLE

# Test API key manually
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"
```

**Solutions:**

**Solution 1: API key invalid**
```bash
# Get a new key from: https://makersuite.google.com/app/apikey
# Set it:
fly secrets set GOOGLE_AI_API_KEY="your_new_key"
```

**Solution 2: Rate limit exceeded**
- Free tier: 15 requests/minute, 1500/day
- Wait a few minutes and try again
- Check usage at: https://makersuite.google.com/

**Solution 3: API quota exceeded**
- View quota: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
- Reset at midnight UTC
- Consider upgrading if consistently hitting limits

**Solution 4: Message too long**
- Google Gemini has token limits
- Messages are truncated automatically in code
- Check logs for truncation warnings

---

### Issue: Publishing to Notion Fails

**Symptoms:**
- Error: "Notion API error"
- Posts marked as 'failed' status
- "Database not found" errors

**Diagnostic Steps:**
```bash
# Check if Notion key is set
fly secrets list | grep NOTION

# Check database ID in bot settings
# In Telegram bot: ⚙️ Settings → Notion Database
```

**Solutions:**

**Solution 1: Database not shared with integration**
1. Open your Notion database
2. Click "..." (top right)
3. Click "Add connections"
4. Select "Telegram Wiki Bot" integration
5. Try publishing again

**Solution 2: Incorrect database ID**
1. Open database in Notion
2. Copy URL: `notion.so/workspace/DATABASE_ID?v=...`
3. In bot: ⚙️ Settings → Set Notion Database
4. Paste only the DATABASE_ID part (32-char hex string)

**Solution 3: API key expired/invalid**
```bash
# Generate new integration token
# Visit: https://www.notion.so/my-integrations
# Click your integration → "Internal Integration Secret"
# Copy and set:
fly secrets set NOTION_API_KEY="secret_new_key"
```

**Solution 4: Database properties mismatch**
Ensure your database has these columns:
- `Name` (Title type)
- `Status` (Select type with "Published" option)
- `Created` (Date type)

**Solution 5: Check error details**
```bash
fly logs | grep -i notion

# Common errors:
# - "object not found" → Database not shared
# - "validation_error" → Wrong property types
# - "unauthorized" → Invalid API key
```

---

### Issue: Publishing to GitHub Fails

**Symptoms:**
- Error: "GitHub API error"
- "Repository not found"
- "Permission denied"

**Diagnostic Steps:**
```bash
# Check if GitHub token is set
fly secrets list | grep GITHUB

# Test token manually
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/user
```

**Solutions:**

**Solution 1: Wrong repository format**
- Correct: `username/repo-name`
- Incorrect: `github.com/username/repo-name`
- Incorrect: `username / repo-name` (spaces)

Update in bot: ⚙️ Settings → Set GitHub Repo

**Solution 2: Token lacks permissions**
1. Go to: https://github.com/settings/tokens
2. Click your token
3. Ensure `repo` scope is checked
4. If not, create new token with `repo` scope
5. Update: `fly secrets set GITHUB_TOKEN="ghp_new_token"`

**Solution 3: Repository doesn't exist**
```bash
# Create the repository first on GitHub
# Then verify it exists:
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/USERNAME/REPO_NAME
```

**Solution 4: _posts directory missing**
```bash
# Clone your repo
git clone https://github.com/USERNAME/REPO_NAME.git
cd REPO_NAME

# Create _posts directory
mkdir -p _posts

# Commit and push
git add _posts
git commit -m "Add _posts directory"
git push
```

**Solution 5: Token expired**
- GitHub tokens don't expire unless you set expiration
- If expired, create new token
- Update secret

---

## ⚠️ Common Warnings

### Warning: "Result too long, truncated"

**Meaning:** A Telegram message or media exceeded size limits

**Impact:** Minimal - content is truncated gracefully

**Solution:** No action needed, but if important content is cut:
- Split long messages into multiple posts
- Reduce image sizes before posting

---

### Warning: "No recent messages to process"

**Meaning:** No new messages in monitored channels within threshold time

**Impact:** None - normal behavior

**Solution:** Not an issue, just informational

---

### Warning: "AI filtered message as casual conversation"

**Meaning:** AI determined message wasn't informational content

**Impact:** Message not converted to blog post (as intended)

**Solution:** If incorrectly filtered:
1. Messages like "hey", "lol", "thanks" are correctly filtered
2. If informational message filtered, check message content
3. Try rephrasing with more detail
4. You can always manually publish from Notion

---

## 🐛 Debugging Tools

### View Live Logs

```bash
# Real-time logs
fly logs

# Last 100 lines
fly logs --app telegram-wiki-bot -n 100

# Filter for errors only
fly logs | grep -i error

# Filter for specific function
fly logs | grep -i "publish"
```

### SSH Into Application

```bash
# Connect to running app
fly ssh console

# Once inside:
# - Check files: ls -la
# - Check node version: node --version
# - Check environment: env | grep -i telegram
# - Exit: exit
```

### Database Console

```bash
# Connect to PostgreSQL
fly postgres connect -a telegram-wiki-bot-db

# Useful queries:
# View all users
SELECT * FROM users;

# View pending messages
SELECT * FROM pending_messages WHERE is_processed = false;

# View recent posts
SELECT id, title, status, created_at FROM blog_posts 
ORDER BY created_at DESC LIMIT 10;

# Count posts by status
SELECT status, COUNT(*) FROM blog_posts GROUP BY status;

# Find failed posts
SELECT id, title, created_at FROM blog_posts WHERE status = 'failed';

# Manually mark message as unprocessed
UPDATE pending_messages SET is_processed = false WHERE id = X;

# Exit: \q
```

### Test API Keys Manually

**Telegram:**
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"
```

**Google AI:**
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=<YOUR_KEY>"
```

**Notion:**
```bash
curl -H "Authorization: Bearer <YOUR_KEY>" \
  -H "Notion-Version: 2022-06-28" \
  https://api.notion.com/v1/users/me
```

**GitHub:**
```bash
curl -H "Authorization: token <YOUR_TOKEN>" \
  https://api.github.com/user
```

---

## 🔄 Reset Procedures

### Reset Bot Completely

```bash
# 1. Stop app
fly apps stop telegram-wiki-bot

# 2. Clear database
fly postgres connect -a telegram-wiki-bot-db
DROP TABLE IF EXISTS blog_posts CASCADE;
DROP TABLE IF EXISTS pending_messages CASCADE;
DROP TABLE IF EXISTS monitored_sources CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
\q

# 3. Restart app (recreates tables)
fly apps restart telegram-wiki-bot

# 4. Re-authorize yourself in bot
# Send /start to bot in Telegram
```

### Reset Specific User

```bash
fly postgres connect -a telegram-wiki-bot-db

# Reset user authorization
UPDATE users SET is_authorized = true WHERE user_id = YOUR_ID;

# Reset settings to defaults
UPDATE user_settings 
SET auto_publish = false, combine_threshold_minutes = 5 
WHERE user_id = YOUR_ID;

# Clear pending posts
DELETE FROM blog_posts WHERE user_id = YOUR_ID AND status = 'pending';

\q
```

### Reset Monitored Sources

```bash
fly postgres connect -a telegram-wiki-bot-db

# Deactivate all sources
UPDATE monitored_sources SET is_active = false;

# Or delete specific source
DELETE FROM monitored_sources WHERE id = X;

\q

# Then re-subscribe in bot
```

---

## 📊 Performance Issues

### Bot Slow to Respond

**Causes:**
- Fly.io free tier has shared CPU
- High memory usage
- Database queries slow

**Solutions:**

```bash
# Check memory usage
fly status

# Scale up memory (still free)
fly scale memory 512

# Restart to clear memory
fly apps restart telegram-wiki-bot
```

### Message Processing Delayed

**Causes:**
- AI analysis takes time
- Many messages queued
- Rate limiting

**Solutions:**

1. **Increase processing frequency:**
   - Edit `src/index.ts`
   - Change `setInterval(processMessages, 30000)` to `15000` (15s)
   - Redeploy: `fly deploy`

2. **Reduce combine threshold:**
   - In bot: ⚙️ Settings
   - Set combine time to 1-2 minutes
   - Messages processed faster

### Database Slow

```bash
# Check database size
fly postgres connect -a telegram-wiki-bot-db
SELECT pg_size_pretty(pg_database_size('telegram_wiki_bot'));

# If large, clean old data:
DELETE FROM pending_messages WHERE is_processed = true 
  AND created_at < NOW() - INTERVAL '30 days';

DELETE FROM blog_posts WHERE status = 'published' 
  AND published_at < NOW() - INTERVAL '90 days';

VACUUM FULL;
\q
```

---

## 🔐 Security Issues

### Unauthorized User Access

**Symptom:** Someone else can use your bot

**Solution:**
```bash
fly postgres connect -a telegram-wiki-bot-db

# Check all users
SELECT * FROM users;

# Revoke unauthorized users
UPDATE users SET is_authorized = false WHERE user_id = UNWANTED_ID;

# Or delete them
DELETE FROM users WHERE user_id = UNWANTED_ID;

\q
```

### API Key Compromised

**If any API key is leaked:**

1. **Immediately revoke old key:**
   - Telegram: @BotFather → revoke token → create new
   - Google AI: Delete key in console
   - Notion: Revoke integration
   - GitHub: Delete token

2. **Generate new keys** (see main README)

3. **Update secrets:**
```bash
fly secrets set KEY_NAME="new_key_value"
```

4. **Check logs for suspicious activity:**
```bash
fly logs | grep -i error
```

---

## 💾 Backup & Recovery

### Backup Database

```bash
# Backup all data
fly postgres connect -a telegram-wiki-bot-db

# Export to SQL
\copy users TO '/tmp/users_backup.csv' CSV HEADER
\copy blog_posts TO '/tmp/posts_backup.csv' CSV HEADER
\copy monitored_sources TO '/tmp/sources_backup.csv' CSV HEADER
```

### Restore from Backup

```bash
fly postgres connect -a telegram-wiki-bot-db

# Import data
\copy users FROM '/tmp/users_backup.csv' CSV HEADER
\copy blog_posts FROM '/tmp/posts_backup.csv' CSV HEADER
\copy monitored_sources FROM '/tmp/sources_backup.csv' CSV HEADER
```

---

## 🆘 Emergency Procedures

### App Completely Broken

```bash
# 1. Roll back to previous version
fly releases
fly releases rollback --version X

# 2. If that fails, redeploy from scratch
cd /path/to/telegram-wiki-bot
fly deploy --force

# 3. If still broken, destroy and recreate
fly apps destroy telegram-wiki-bot
fly launch
# (Set secrets again)
fly deploy
```

### Lost All Data

**Notion saves everything!**
1. All published posts are in your Notion database
2. Republish from Notion to GitHub manually if needed

**GitHub has commit history:**
1. All posts are in GitHub repo under `_posts/`
2. Clone repo to backup posts

---

## 📞 Getting Help

### Before Asking for Help

1. ✅ Run `./verify-setup.sh`
2. ✅ Check `fly logs` for errors
3. ✅ Review this troubleshooting guide
4. ✅ Test API keys manually
5. ✅ Try restarting: `fly apps restart`

### Information to Provide

When asking for help, include:

```bash
# System info
fly status
fly version
node --version

# Recent logs (last 50 lines)
fly logs -n 50

# Secrets status (don't share actual values!)
fly secrets list

# Database tables
fly postgres connect -a telegram-wiki-bot-db -c "\dt"
```

### Resources

- **Fly.io Docs**: https://fly.io/docs
- **Telegraf Docs**: https://telegraf.js.org
- **Google AI Docs**: https://ai.google.dev/docs
- **Notion API**: https://developers.notion.com
- **GitHub API**: https://docs.github.com/en/rest

---

## ✅ Prevention Tips

### Regular Maintenance

**Weekly:**
- Check bot status: `fly status`
- Review logs: `fly logs`
- Test by posting in monitored channel

**Monthly:**
- Review database size
- Clean old processed messages
- Check API quota usage
- Verify all integrations still work

### Best Practices

1. **Keep secrets secure** - Never commit `.env`
2. **Monitor logs regularly** - Catch issues early
3. **Test changes locally first** - Before deploying
4. **Keep dependencies updated** - `npm update`
5. **Backup data periodically** - Export from Notion
6. **Document customizations** - For future reference

---

**Still stuck? Check the main README.md for more detailed explanations!**