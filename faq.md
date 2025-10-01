# ❓ Frequently Asked Questions (FAQ)

Quick answers to common questions about the Telegram Wiki Bot.

---

## 🤔 General Questions

### Q: Is this really 100% free?

**A: Yes!** All services used have generous free tiers:
- **Fly.io**: 3 shared VMs (256MB each) - FREE
- **PostgreSQL**: 3GB storage - FREE
- **Google Gemini AI**: 1,500 requests/day - FREE
- **Notion**: Unlimited pages - FREE
- **GitHub Pages**: Unlimited hosting - FREE

Total cost: **$0.00/month**

The only requirement is a credit card for Fly.io verification (won't be charged).

---

### Q: How long does deployment take?

**A: ~30 minutes** for first-time setup:
- Getting API keys: 10 minutes
- Creating GitHub blog: 5 minutes
- Deploying to Fly.io: 10 minutes
- Configuring bot: 5 minutes

If you have all keys ready: **~10 minutes**

---

### Q: Do I need coding experience?

**A: No!** Just follow the step-by-step guides:
- Copy/paste provided code
- Run simple commands
- Configure through Telegram menu

If you can follow a recipe, you can deploy this bot.

---

### Q: Can I customize the bot?

**A: Absolutely!** All code is in `src/index.ts`:
- Modify AI prompts
- Change menu buttons
- Adjust processing logic
- Add new features

After changes, redeploy: `fly deploy`

---

### Q: What if I run out of free tier limits?

**A:** Unlikely for personal use, but if you do:

**Fly.io** ($5/month for more resources):
- Free: 3 shared VMs
- Hobby: Dedicated resources

**Google AI** (unlikely to hit - 1,500/day is huge):
- Free: 1,500 requests/day
- Pay-as-you-go: Very cheap

**GitHub Pages** (unlimited on free):
- No limits for personal use

---

## 🤖 Bot Usage Questions

### Q: How many channels can I monitor?

**A: Unlimited!** 

Add as many as you want:
- Forward messages to subscribe
- Bot processes all monitored sources
- No performance impact (within reason)

---

### Q: How does the AI know what's informational vs casual chat?

**A:** Google Gemini AI analyzes message content:

**Informational** (creates posts):
- Tutorials, guides, announcements
- News, updates, documentation
- Questions with detailed answers
- Technical discussions

**Casual** (filtered out):
- "hey", "lol", "thanks"
- Single emojis
- Short responses
- General chitchat

The AI is pretty smart but not perfect. You can review posts before publishing if auto-publish is OFF.

---

### Q: Can I edit posts before publishing?

**A: Yes!** 

**Method 1: Manual Review Mode**
1. Settings → Toggle auto-publish OFF
2. Review posts in "📝 Pending Posts"
3. Click ✅ Publish or ❌ Reject

**Method 2: Edit in Notion**
1. Even after publishing, edit in Notion
2. Changes won't sync back to GitHub
3. Consider Notion as your source of truth

**Method 3: Edit GitHub directly**
1. Edit markdown files in `_posts/` directory
2. Commit changes
3. GitHub Pages auto-updates

---

### Q: What happens if bot goes offline?

**A:** No worries!

- Messages are still stored in channels
- When bot comes back online, catch up is automatic
- No messages are lost
- Just restart: `fly apps restart`

---

### Q: Can multiple people use the same bot?

**A: Yes!** 

Owner can authorize users:
1. Get their Telegram user ID
2. Send: `/authorize user_id`
3. They can now use the bot
4. Each user has their own settings and monitored sources

To revoke access:
```bash
fly postgres connect
UPDATE users SET is_authorized = false WHERE user_id = USER_ID;
```

---

### Q: Can I monitor private channels?

**A: Yes!**

For private channels:
1. Add bot to channel as admin
2. Give bot permission to read messages
3. Forward a message from channel to bot
4. Bot confirms subscription

---

### Q: How long are messages stored before processing?

**A:** Messages process every 30 seconds

- Messages wait in queue up to 30s
- Time-grouped messages wait up to your threshold (default 5 min)
- After processing, stored as blog posts
- Original messages stay in Telegram indefinitely

---

### Q: Can I change the 5-minute grouping threshold?

**A: Yes!**

1. Open bot in Telegram
2. Click "⚙️ Settings"
3. Click "Combine time: X min"
4. Choose: 1-15 minutes

**Recommendations:**
- 1-2 min: Real-time, less grouping
- 5 min: Balanced (default)
- 10-15 min: More grouping, fewer posts

---

## 📝 Publishing Questions

### Q: Can I publish to only Notion OR only GitHub?

**A: Not out of the box**, but easy to modify:

**Option 1: Remove Notion publishing**
Edit `src/index.ts` → `publishPost()` function:
```typescript
// Comment out:
// if (settings.notion_database_id) {
//   notionPageId = await publishToNotion(...)
// }
```

**Option 2: Remove GitHub publishing**
Comment out GitHub section similarly

Then redeploy: `fly deploy`

---

### Q: Can I customize the blog post format?

**A: Yes!** 

Edit the `publishToGitHub()` function in `src/index.ts`:

```typescript
let markdownContent = `---
title: "${title}"
date: ${date.toISOString()}
author: Your Name           // Add this
categories: [auto-posts]    // Change this
tags: [telegram, ai]        // Add this
custom_field: value         // Add any field
---

${content}

## Custom Footer              // Add this
Auto-generated from Telegram
`;
```

Redeploy: `fly deploy`

---

### Q: Can I publish to WordPress instead?

**A: Yes!** 

The architecture supports any publishing target:

1. Install WordPress REST API plugin
2. Add WordPress API client to dependencies:
```bash
npm install wordpress-rest-api
```

3. Create `publishToWordPress()` function
4. Add to `publishPost()` function
5. Redeploy

*This requires coding knowledge. Consider hiring a developer if needed.*

---

### Q: How do I customize the Jekyll theme?

**A:** Edit `_config.yml` in your blog repository:

```yaml
title: My Custom Blog
theme: minima  # or: jekyll-theme-cayman, etc.

# Available free themes:
# - minima (default)
# - cayman
# - minimal
# - slate
# - architect

# Or use remote theme:
remote_theme: username/repo-name
```

Commit and push. GitHub Pages rebuilds automatically.

See: https://pages.github.com/themes/

---

## 🔐 Security Questions

### Q: Are my API keys secure?

**A: Yes!** 

- Keys stored in Fly.io secrets (encrypted)
- Never committed to git (`.gitignore`)
- Not visible in logs
- Only accessible to your app

**Best practices:**
- Never share `.env` file
- Don't commit keys to GitHub
- Rotate keys periodically
- Use different keys for different projects

---

### Q: Can someone read my bot's messages?

**A: Only Telegram and you can read messages**

- Bot reads only subscribed channels
- Messages stored temporarily in your database
- Published content is public on your blog
- Don't monitor channels with sensitive info

**Privacy features:**
- Bot doesn't store message history long-term
- Can delete old messages from database
- Only processes new messages

---

### Q: What if my bot token is leaked?

**A: Immediately:**

1. Go to @BotFather
2. Send: `/revoke`
3. Select your bot
4. Create new token with `/token`
5. Update: `fly secrets set TELEGRAM_BOT_TOKEN="new_token"`

The old token stops working immediately.

---

## 💻 Technical Questions

### Q: Why TypeScript instead of JavaScript?

**A: Type safety!**

Benefits:
- Catch errors before deployment
- Better IDE autocompletion
- Easier to maintain
- Self-documenting code

Don't worry - it compiles to JavaScript automatically.

---

### Q: Can I use a different database?

**A: Yes!**

The bot uses PostgreSQL but can work with:
- **SQLite**: Good for testing, not for production
- **MySQL**: Requires changing `pg` package to `mysql2`
- **Supabase**: PostgreSQL with free tier
- **PlanetScale**: MySQL with free tier

Requires code changes in database connection setup.

---

### Q: How does the message processing loop work?

**A:** Every 30 seconds:

```
1. Query database for unprocessed messages
2. Group messages by time and source
3. Send to AI for analysis
4. AI decides: informational or not?
5. If informational: create post (pending or publish)
6. Mark messages as processed
7. Repeat
```

Processing interval configurable in code.

---

### Q: Can I host this on Heroku/Vercel/Railway instead?

**A: Yes!** 

**Heroku:**
- Similar to Fly.io
- Free tier ended in 2022
- Paid tiers start at $5/month

**Vercel:**
- Not ideal (serverless, bot needs long-running process)
- Would need cron job workaround

**Railway:**
- Free $5 credit/month
- ~500 hours runtime
- Good alternative to Fly.io

**Render:**
- Free tier available
- Bot sleeps after 15 min inactivity
- Needs external pinger to stay awake

**Fly.io recommended** for always-on free hosting.

---

### Q: How much data does the bot use?

**A: Very little!**

Approximate monthly usage:
- API calls: ~50MB
- Database: ~100MB
- Total bandwidth: ~200MB

Well within all free tier limits.

---

## 📊 Performance Questions

### Q: How many messages can it process per day?

**A: Limited by AI quota:**

- Free Google Gemini: 1,500 requests/day
- Each processing batch = 1 request
- If messages come in groups: many messages per request
- **Realistic estimate**: 500-1000 individual messages/day

For most users: more than enough.

---

### Q: Is there a delay in publishing?

**A: Yes, by design:**

- Messages processed every 30 seconds
- AI analysis takes 1-5 seconds
- Time grouping adds 0-5 minutes (configurable)
- Publishing takes 1-2 seconds

**Total delay**: 30 seconds to 6 minutes

This is intentional to:
- Group related messages
- Avoid rate limits
- Reduce API costs

---

### Q: Can I make it faster?

**A: Yes!**

Edit `src/index.ts`:
```typescript
// Change this line:
setInterval(processMessages, 30000);  // 30s

// To:
setInterval(processMessages, 10000);  // 10s
```

Redeploy: `fly deploy`

**Trade-off**: More frequent AI calls = hit limits faster

---

### Q: Why does the bot use 100-200MB of RAM?

**A: Normal for Node.js apps**

Breakdown:
- Node.js runtime: ~50MB
- Dependencies: ~50MB
- Database connections: ~20MB
- Active processing: ~30-50MB

Free tier includes 256MB, plenty of room.

---

## 🔧 Customization Questions

### Q: Can I add custom commands?

**A: Yes!**

Edit `src/index.ts`, add:

```typescript
bot.command('mycustomcommand', async (ctx) => {
  await ctx.reply('Custom response!');
});
```

Redeploy: `fly deploy`

---

### Q: Can I add image processing?

**A: Already included!**

The bot already uses Gemini's vision capabilities:
- Analyzes images in messages
- Extracts text from images
- Describes image content
- Includes in blog posts

---

### Q: Can I schedule posts instead of auto-publishing?

**A: Not built-in, but easy to add:**

1. Create posts as 'scheduled' status
2. Add a cron job to publish at specific times
3. Use `node-cron` package

Would require moderate coding changes.

---

### Q: Can I add categories or tags?

**A: Yes!**

Edit `publishToGitHub()` in `src/index.ts`:

```typescript
markdownContent = `---
title: "${title}"
date: ${date.toISOString()}
categories: [custom-category]
tags: [tag1, tag2, tag3]
---
...
```

Or dynamically assign based on AI analysis!

---

## 💰 Cost Questions

### Q: When would I need to pay?

**A:** You'd need to upgrade if:

**Fly.io** (>3 shared VMs OR >~160GB/month bandwidth):
- Heavy traffic spikes
- Need dedicated resources
- Solution: $5/month hobby tier

**Google AI** (>1,500 requests/day):
- Processing >500 messages/day consistently
- Solution: Pay-as-you-go (very cheap)

**For personal use: Will likely never need to pay**

---

### Q: How do I monitor my usage?

**Fly.io:**
```bash
fly dashboard
# View metrics in web UI
```

**Google AI:**
- Visit: https://makersuite.google.com/
- View quota usage

**Notion:** No limits to monitor

**GitHub Pages:** No limits for public repos

---

### Q: What if I go viral and get huge traffic?

**A: Good problem!**

1. **Blog traffic**: GitHub Pages can handle it (served via CDN)
2. **Bot usage**: Fly.io autoscales (still free up to limits)
3. **Database**: 3GB is plenty for metadata
4. **AI calls**: May need to upgrade Google AI quota

**Most likely:** No issues. GitHub CDN is robust.

---

## 🆘 Help & Support

### Q: Where can I get help?

**A: Multiple resources:**

1. **Documentation**:
   - `README.md` - Overview
   - `DEPLOYMENT_GUIDE.md` - Step-by-step
   - `TROUBLESHOOTING.md` - Fix issues
   - This FAQ

2. **Community**:
   - Fly.io Community: https://community.fly.io
   - Telegraf GitHub: https://github.com/telegraf/telegraf/discussions

3. **Official docs**:
   - Fly.io: https://fly.io/docs
   - Google AI: https://ai.google.dev/docs
   - Notion API: https://developers.notion.com

---

### Q: Can I hire someone to set this up?

**A: Yes!**

Look for developers with:
- Node.js experience
- Telegram bot experience
- Deployment experience

Estimated cost: $50-200 depending on customizations

---

### Q: Is there a hosted version I can just pay for?

**A: Not currently**

This is open-source and self-hosted by design:
- ✅ Full control over your data
- ✅ Customize everything
- ✅ No ongoing fees
- ✅ Learn how it works

---

## 🎓 Learning Questions

### Q: Can I use this to learn coding?

**A: Absolutely!**

This project teaches:
- TypeScript/Node.js
- API integration (Telegram, AI, Notion, GitHub)
- Database management (PostgreSQL)
- Cloud deployment (Fly.io)
- Docker containers
- Git version control

Start by:
1. Get it working first (follow guides)
2. Read through `src/index.ts` with comments
3. Make small changes
4. Test and deploy
5. Iterate!

---

### Q: What should I learn to customize this?

**Essential:**
- JavaScript/TypeScript basics
- Async/await patterns
- API concepts

**Helpful:**
- Express.js (for custom endpoints)
- PostgreSQL/SQL queries
- Markdown formatting
- Git/GitHub basics

**Nice to have:**
- Docker
- CI/CD
- Jest (testing)

---

### Q: Are there video tutorials?

**A: Not yet!**

But the documentation is comprehensive:
- Step-by-step guides
- Code comments
- Examples throughout
- Troubleshooting guides

Consider creating one yourself! 🎥

---

## 🚀 Advanced Questions

### Q: Can I cluster multiple bots?

**A: Yes, but complex:**

- Run multiple Fly.io apps
- Share database or use separate databases
- Coordinate message processing
- Load balance if needed

**Simpler:** Just use one bot, it can handle a lot!

---

### Q: Can I integrate with other services?

**A: Yes!** Architecture is extensible:

Easy to add:
- Slack notifications
- Discord webhooks
- Email alerts
- Custom APIs
- Analytics tracking
- Logging services

Just add the integration code and redeploy.

---

### Q: Can I create a web dashboard?

**A: Yes!**

Add Express.js routes in `src/index.ts`:

```typescript
app.get('/dashboard', (req, res) => {
  // Query database
  // Render HTML or JSON
  // Protect with authentication
});
```

Deploy and access at: `https://your-app.fly.dev/dashboard`

---

**Can't find your question? Check the other documentation files or open an issue on GitHub!** 🤔