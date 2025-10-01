# 🚀 Optimization & Monitoring Guide

Complete guide to keeping your Telegram Wiki Bot running at peak performance.

---

## 📊 Monitoring Dashboard Setup

### Built-in Health Check

Your bot includes a health endpoint:

```bash
# Test health
curl https://your-app.fly.dev/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-09-30T12:00:00.000Z"
}
```

### Fly.io Metrics

```bash
# View metrics in CLI
fly status --app telegram-wiki-bot

# Open web dashboard
fly dashboard

# View in browser:
# - CPU usage
# - Memory usage
# - Network traffic
# - Request counts
```

### Database Monitoring

```bash
# Connect to database
fly postgres connect -a telegram-wiki-bot-db

# Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));

# Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check slow queries (if any)
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

---

## 🎯 Performance Optimization

### 1. Message Processing Optimization

**Current:** Processes every 30 seconds

**Option A: Faster Processing**
```typescript
// In src/index.ts, change:
setInterval(processMessages, 15000);  // 15 seconds
```

**Option B: Batch Processing**
```typescript
// Process more messages at once
const messages = await pool.query(
  `SELECT pm.* FROM pending_messages pm
   WHERE pm.is_processed = false
   ORDER BY pm.timestamp ASC
   LIMIT 50`,  // Increased from default
  [user.user_id]
);
```

**Trade-offs:**
- ⚡ Faster → More API calls → May hit rate limits
- 🐢 Slower → Fewer API calls → Better for free tier

---

### 2. Database Query Optimization

**Add indexes** for faster queries:

```sql
-- Connect to database
fly postgres connect -a telegram-wiki-bot-db

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_pending_messages_user 
  ON pending_messages(source_id, is_processed);

CREATE INDEX IF NOT EXISTS idx_blog_posts_user_status 
  ON blog_posts(user_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_monitored_sources_user_active 
  ON monitored_sources(user_id, is_active);

-- Analyze tables for query planner
ANALYZE pending_messages;
ANALYZE blog_posts;
ANALYZE monitored_sources;
```

**Clean old data** regularly:

```sql
-- Delete processed messages older than 30 days
DELETE FROM pending_messages 
WHERE is_processed = true 
  AND created_at < NOW() - INTERVAL '30 days';

-- Optional: Archive old published posts
-- (Keep in Notion/GitHub, remove from DB)
DELETE FROM blog_posts 
WHERE status = 'published' 
  AND published_at < NOW() - INTERVAL '90 days';

-- Reclaim space
VACUUM FULL;
```

---

### 3. AI API Optimization

**Reduce API calls:**

```typescript
// In analyzeMessages(), add caching
const cacheKey = messages.map(m => m.id).join('-');
// Check cache first (implement Redis or in-memory cache)

// Batch multiple analyses
// Instead of one message at a time, analyze in groups
```

**Optimize prompts:**

```typescript
// Shorter, more focused prompts = faster responses
const prompt = `Analyze these messages. Are they informational (yes/no)? 
Should they combine (yes/no)? Suggest title.

Messages:
${messageTexts}

Respond JSON only: 
{"isInformational": bool, "shouldCombine": bool, "suggestedTitle": "string"}`;
```

**Use cheaper model** if available:
- Gemini Flash (current) - Fastest, free
- Gemini Pro - More capable, costs more
- Consider switching based on needs

---

### 4. Memory Optimization

**Current usage:** ~100-200MB

**If experiencing memory issues:**

```typescript
// Add garbage collection hints
if (global.gc) {
  setInterval(() => {
    global.gc();
  }, 60000);  // Every minute
}

// Run node with: node --expose-gc dist/index.js
```

**In fly.toml:**
```toml
[[vm]]
  memory = '512mb'  # Increase if needed (still free)
```

**Monitor memory:**
```typescript
// Add to health check
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'healthy',
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
    },
    timestamp: new Date().toISOString()
  });
});
```

---

### 5. Network Optimization

**Parallel publishing:**

```typescript
// Already implemented! Notion and GitHub publish in parallel
async function publishPost(postId: number, userId: number) {
  // Both publish simultaneously
  const [notionPageId, githubSha] = await Promise.all([
    settings.notion_database_id 
      ? publishToNotion(...) 
      : Promise.resolve(null),
    settings.github_repo 
      ? publishToGitHub(...) 
      : Promise.resolve(null)
  ]);
}
```

**Connection pooling** (already configured):

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## 🔍 Advanced Monitoring

### Custom Metrics

Add custom metrics to health endpoint:

```typescript
let messageCount = 0;
let publishCount = 0;
let errorCount = 0;

// Increment in relevant functions
async function processMessages() {
  messageCount++;
  // ... existing code
}

// Expose in health check
app.get('/metrics', (req, res) => {
  res.json({
    messages_processed: messageCount,
    posts_published: publishCount,
    errors: errorCount,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});
```

### External Monitoring

**Option 1: UptimeRobot** (Free)
1. Sign up: https://uptimerobot.com
2. Add monitor: `https://your-app.fly.dev/health`
3. Get alerts if bot goes down

**Option 2: Healthchecks.io** (Free)
1. Sign up: https://healthchecks.io
2. Create check with cron schedule
3. Ping from your bot:
```typescript
setInterval(() => {
  axios.get('https://hc-ping.com/YOUR_UUID');
}, 60000);  // Every minute
```

**Option 3: Better Stack** (Formerly Logtail) (Free tier)
1. Sign up: https://betterstack.com
2. Add logging:
```typescript
import pino from 'pino';
const logger = pino({
  transport: {
    target: 'pino-socket',
    options: { address: 'logs.betterstack.com', port: 1514 }
  }
});

logger.info('Bot started');
logger.error({ err }, 'Error processing message');
```

---

## 📈 Scaling Strategies

### When to Scale

**Signs you need to scale:**
- ❌ Bot frequently offline
- ❌ Response time >5 seconds
- ❌ Memory usage consistently >200MB
- ❌ Database queries slow (>1 second)
- ❌ Hitting AI rate limits frequently

**Current limits (free tier):**
- ✅ 3 shared VMs on Fly.io
- ✅ 256MB RAM per VM
- ✅ 3GB PostgreSQL storage
- ✅ 1,500 AI requests/day

---

### Horizontal Scaling

**Run multiple instances:**

```bash
# Scale to 2 instances (still free)
fly scale count 2 --app telegram-wiki-bot

# Fly.io load balances automatically
```

**⚠️ Important:** With multiple instances:
- Use database locks for message processing
- Avoid race conditions
- One instance should handle cron jobs

**Better approach:** Optimize first, scale later

---

### Vertical Scaling

**Increase memory:**

```bash
# Scale to 512MB (still free tier)
fly scale memory 512 --app telegram-wiki-bot
```

**Increase CPU:**
- Free tier: Shared CPU
- Paid: Dedicated CPU ($5-25/month)

```bash
fly scale vm dedicated-cpu-1x --app telegram-wiki-bot
```

---

### Database Scaling

**Upgrade PostgreSQL:**

```bash
# Check current size
fly postgres list

# If approaching 3GB limit:
# Option 1: Clean old data (see above)
# Option 2: Upgrade to larger plan

# View available plans
fly postgres create --help
```

**Alternative databases:**
- **Supabase**: 500MB free, PostgreSQL
- **PlanetScale**: 5GB free, MySQL
- **MongoDB Atlas**: 512MB free

---

## 🎛️ Configuration Tuning

### Bot Configuration

**Optimal settings for different use cases:**

**High Volume (100+ messages/day):**
```
Auto-publish: ON
Combine threshold: 2 minutes
Processing interval: 15 seconds
```

**Medium Volume (10-50 messages/day):**
```
Auto-publish: OFF (for review)
Combine threshold: 5 minutes
Processing interval: 30 seconds
```

**Low Volume (<10 messages/day):**
```
Auto-publish: ON
Combine threshold: 10 minutes
Processing interval: 60 seconds
```

---

### AI Prompt Optimization

**Faster, cheaper prompts:**

```typescript
// BAD: Verbose, slow
const prompt = `Please carefully analyze these messages from my Telegram channel 
and determine whether they contain informational content that would be suitable 
for publication on my blog. Consider whether the messages should be combined...`;

// GOOD: Concise, fast
const prompt = `Classify messages as informational (yes/no). 
Combine related messages (yes/no). Suggest title.
JSON only: {"isInformational": bool, "shouldCombine": bool, "title": "str"}

${messageTexts}`;
```

**Result:** 
- 3x faster response
- Same accuracy
- Lower token usage

---

## 🔋 Battery Optimization (For Self-Hosted)

If running on your own server:

**Reduce polling frequency:**
```typescript
// Night mode: slower processing
const currentHour = new Date().getHours();
const interval = (currentHour >= 23 || currentHour <= 6) 
  ? 300000  // 5 minutes at night
  : 30000;  // 30 seconds during day

setInterval(processMessages, interval);
```

**Suspend during inactivity:**
```typescript
let lastActivity = Date.now();

// Update on any activity
bot.use((ctx, next) => {
  lastActivity = Date.now();
  return next();
});

// Check for inactivity
setInterval(() => {
  const inactiveMinutes = (Date.now() - lastActivity) / 60000;
  if (inactiveMinutes > 60) {
    console.log('Sleeping due to inactivity...');
    // Reduce processing frequency
  }
}, 300000);
```

---

## 📊 Analytics & Insights

### Track Bot Usage

Add analytics to database:

```sql
-- Create analytics table
CREATE TABLE IF NOT EXISTS analytics (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50),
  user_id BIGINT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track events
INSERT INTO analytics (event_type, user_id, metadata)
VALUES ('message_processed', 123456, '{"source": "channel_name"}');

-- Query analytics
SELECT 
  event_type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM analytics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type, DATE(created_at)
ORDER BY date DESC;
```

### Popular Metrics to Track

```typescript
// Add to your bot code
async function trackMetric(type: string, userId: number, metadata: any) {
  await pool.query(
    'INSERT INTO analytics (event_type, user_id, metadata) VALUES ($1, $2, $3)',
    [type, userId, JSON.stringify(metadata)]
  );
}

// Track different events
trackMetric('message_received', userId, { source: chatTitle });
trackMetric('post_published', userId, { title: postTitle });
trackMetric('ai_analysis', userId, { duration: analysisTime });
```

### Generate Reports

```typescript
// Daily summary
bot.command('stats', async (ctx) => {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE event_type = 'message_received') as messages,
      COUNT(*) FILTER (WHERE event_type = 'post_published') as posts,
      COUNT(DISTINCT DATE(created_at)) as active_days
    FROM analytics
    WHERE user_id = $1 
      AND created_at > NOW() - INTERVAL '30 days'
  `, [ctx.from!.id]);
  
  await ctx.reply(
    `📊 *30-Day Statistics*\n\n` +
    `Messages: ${stats.rows[0].messages}\n` +
    `Posts: ${stats.rows[0].posts}\n` +
    `Active Days: ${stats.rows[0].active_days}`,
    { parse_mode: 'Markdown' }
  );
});
```

---

## 🎯 Best Practices Summary

### DO ✅

1. **Monitor regularly** - Check logs weekly
2. **Clean database** - Remove old data monthly
3. **Update dependencies** - `npm update` monthly
4. **Backup data** - Export from Notion regularly
5. **Test changes locally** - Before deploying
6. **Use indexes** - For faster queries
7. **Track metrics** - Understand usage patterns
8. **Optimize prompts** - Shorter = faster
9. **Scale gradually** - Free tier first, paid later
10. **Document changes** - For future reference

### DON'T ❌

1. **Don't over-optimize** - Start simple
2. **Don't scale prematurely** - Free tier is enough
3. **Don't ignore logs** - They show issues early
4. **Don't skip backups** - Murphy's law applies
5. **Don't hardcode values** - Use environment variables
6. **Don't neglect security** - Rotate keys regularly
7. **Don't delete data** - Archive instead
8. **Don't stress** - It's supposed to be fun!

---

## 🔧 Optimization Checklist

Before optimizing, check if you actually need to:

- [ ] Bot response time <3 seconds?
- [ ] Memory usage <200MB?
- [ ] Database size <2GB?
- [ ] No frequent crashes?
- [ ] AI calls well under 1,000/day?

**If all checked:** You're fine! Don't optimize yet.

**If issues persist:** Follow this order:

1. **Check logs** - Identify bottleneck
2. **Clean database** - Remove old data
3. **Add indexes** - Speed up queries
4. **Optimize prompts** - Reduce AI time
5. **Increase memory** - If needed (still free)
6. **Scale horizontally** - Multiple instances
7. **Consider paid tier** - Only if necessary

---

## 📚 Resources

**Performance Tools:**
- **Fly.io Metrics**: `fly dashboard`
- **Database Profiling**: `EXPLAIN ANALYZE` in PostgreSQL
- **Node.js Profiling**: `node --prof dist/index.js`
- **Memory Leaks**: `node --inspect dist/index.js`

**Monitoring Services:**
- **UptimeRobot**: https://uptimerobot.com
- **Healthchecks.io**: https://healthchecks.io
- **Better Stack**: https://betterstack.com
- **Sentry**: https://sentry.io (error tracking)

**Learning Resources:**
- **Node.js Performance**: https://nodejs.org/en/docs/guides/simple-profiling/
- **PostgreSQL Tuning**: https://wiki.postgresql.org/wiki/Performance_Optimization
- **Fly.io Scaling**: https://fly.io/docs/reference/scaling/

---

**Remember: Premature optimization is the root of all evil. Optimize only when needed!** 🚀