import { Telegraf, Context, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client } from '@notionhq/client';
import { Octokit } from '@octokit/rest';
import pg from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const { Pool } = pg;

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize clients
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Types
interface UserSettings {
  user_id: number;
  auto_publish: boolean;
  combine_threshold_minutes: number;
}

interface MonitoredSource {
  id: number;
  user_id: number;
  chat_id: number;
  chat_title: string;
  chat_type: string;
  topic_id?: number;
  is_active: boolean;
}

interface PendingMessage {
  id: number;
  source_id: number;
  message_id: number;
  text: string;
  media_urls: string[];
  sender: string;
  timestamp: Date;
  is_processed: boolean;
}

interface BlogPost {
  id: number;
  user_id: number;
  title: string;
  content: string;
  media_urls: string[];
  notion_page_id?: string;
  github_commit_sha?: string;
  status: 'pending' | 'published' | 'failed';
  created_at: Date;
}

// Database initialization
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username VARCHAR(255),
        is_authorized BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id BIGINT PRIMARY KEY REFERENCES users(user_id),
        auto_publish BOOLEAN DEFAULT false,
        combine_threshold_minutes INT DEFAULT 5,
        notion_database_id VARCHAR(255),
        github_repo VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS monitored_sources (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(user_id),
        chat_id BIGINT NOT NULL,
        chat_title VARCHAR(255),
        chat_type VARCHAR(50),
        topic_id INT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, chat_id, topic_id)
      );

      CREATE TABLE IF NOT EXISTS pending_messages (
        id SERIAL PRIMARY KEY,
        source_id INT REFERENCES monitored_sources(id),
        message_id BIGINT NOT NULL,
        text TEXT,
        media_urls TEXT[],
        sender VARCHAR(255),
        timestamp TIMESTAMP NOT NULL,
        is_processed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(user_id),
        title VARCHAR(500),
        content TEXT,
        media_urls TEXT[],
        source_messages INT[],
        notion_page_id VARCHAR(255),
        github_commit_sha VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_pending_messages_processed ON pending_messages(is_processed, timestamp);
      CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status, user_id);
    `);
    console.log('✅ Database initialized successfully');
  } finally {
    client.release();
  }
}

// User authorization check
async function isAuthorized(userId: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT is_authorized FROM users WHERE user_id = $1',
    [userId]
  );
  return result.rows.length > 0 && result.rows[0].is_authorized;
}

// Get user settings
async function getUserSettings(userId: number): Promise<UserSettings> {
  const result = await pool.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    return {
      user_id: userId,
      auto_publish: false,
      combine_threshold_minutes: 5
    };
  }
  
  return result.rows[0];
}

// AI message analysis
async function analyzeMessages(messages: PendingMessage[]): Promise<{
  shouldCombine: boolean;
  isInformational: boolean;
  suggestedTitle: string;
  combinedContent: string;
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const messageTexts = messages.map((m, i) => 
    `[Message ${i + 1}] ${m.sender} at ${m.timestamp.toISOString()}: ${m.text}`
  ).join('\n\n');
  
  const prompt = `Analyze these Telegram messages and determine:
1. Are they informational content suitable for a blog/wiki post? (vs casual conversation)
2. Should they be combined into one post or kept separate?
3. Suggest a title for the blog post
4. Create a combined, well-formatted content if they should be combined

Messages:
${messageTexts}

Respond in JSON format:
{
  "shouldCombine": boolean,
  "isInformational": boolean,
  "suggestedTitle": "string",
  "combinedContent": "string (markdown formatted)",
  "reasoning": "string"
}`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response not in expected JSON format');
  }
  
  return JSON.parse(jsonMatch[0]);
}

// Analyze image with AI
async function analyzeImage(imageUrl: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imageData = Buffer.from(imageResponse.data).toString('base64');
  
  const result = await model.generateContent([
    'Describe this image in detail for a blog post. Focus on important information, data, or content visible in the image.',
    {
      inlineData: {
        data: imageData,
        mimeType: imageResponse.headers['content-type'] || 'image/jpeg'
      }
    }
  ]);
  
  return result.response.text();
}

// Publish to Notion
async function publishToNotion(
  databaseId: string,
  title: string,
  content: string,
  mediaUrls: string[]
): Promise<string> {
  const children: any[] = [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content }
        }]
      }
    }
  ];
  
  for (const url of mediaUrls) {
    children.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: { url }
      }
    });
  }
  
  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Name: {
        title: [{
          text: { content: title }
        }]
      },
      Status: {
        select: { name: 'Published' }
      },
      Created: {
        date: { start: new Date().toISOString() }
      }
    },
    children
  });
  
  return response.id;
}

// Publish to GitHub Pages
async function publishToGitHub(
  repo: string,
  title: string,
  content: string,
  mediaUrls: string[]
): Promise<string> {
  const [owner, repoName] = repo.split('/');
  const date = new Date();
  const filename = `${date.toISOString().split('T')[0]}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  
  let markdownContent = `---
title: "${title}"
date: ${date.toISOString()}
categories: [telegram-posts]
tags: [auto-generated]
---

${content}
`;
  
  if (mediaUrls.length > 0) {
    markdownContent += '\n\n## Media\n\n';
    mediaUrls.forEach(url => {
      markdownContent += `![Image](${url})\n\n`;
    });
  }
  
  const response = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path: `_posts/${filename}`,
    message: `Add post: ${title}`,
    content: Buffer.from(markdownContent).toString('base64')
  });
  
  return response.data.commit.sha!;
}

// Main menu
function getMainMenu() {
  return Markup.keyboard([
    ['📊 Status', '⚙️ Settings'],
    ['➕ Subscribe', '📋 List Sources'],
    ['📝 Pending Posts', '👥 Manage Users']
  ]).resize();
}

// Settings menu
function getSettingsMenu(settings: UserSettings) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(
      `Auto-publish: ${settings.auto_publish ? '✅ ON' : '❌ OFF'}`,
      'toggle_auto_publish'
    )],
    [Markup.button.callback(
      `Combine time: ${settings.combine_threshold_minutes} min`,
      'set_combine_time'
    )],
    [Markup.button.callback('🔗 Set Notion Database', 'set_notion_db')],
    [Markup.button.callback('🔗 Set GitHub Repo', 'set_github_repo')],
    [Markup.button.callback('« Back', 'back_to_main')]
  ]);
}

// Bot commands
bot.start(async (ctx) => {
  const userId = ctx.from!.id;
  
  await pool.query(
    `INSERT INTO users (user_id, username, is_authorized) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, ctx.from!.username, userId === parseInt(process.env.OWNER_USER_ID!)]
  );
  
  await pool.query(
    `INSERT INTO user_settings (user_id) 
     VALUES ($1) 
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  
  if (!await isAuthorized(userId)) {
    return ctx.reply('⛔ You are not authorized to use this bot. Contact the owner for access.');
  }
  
  await ctx.reply(
    '🤖 *Telegram Wiki Bot*\n\n' +
    'I monitor your selected channels and groups, analyze messages with AI, ' +
    'and automatically create blog posts in Notion and GitHub Pages.\n\n' +
    '*Features:*\n' +
    '• AI-powered message analysis\n' +
    '• Automatic content vs conversation detection\n' +
    '• Smart message grouping\n' +
    '• Dual publishing (Notion + GitHub)\n' +
    '• Manual review option\n\n' +
    'Use the menu below to get started!',
    { parse_mode: 'Markdown', ...getMainMenu() }
  );
});

bot.hears('📊 Status', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) return;
  
  const stats = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM monitored_sources WHERE user_id = $1 AND is_active = true) as active_sources,
      (SELECT COUNT(*) FROM pending_messages pm 
       JOIN monitored_sources ms ON pm.source_id = ms.id 
       WHERE ms.user_id = $1 AND pm.is_processed = false) as pending_messages,
      (SELECT COUNT(*) FROM blog_posts WHERE user_id = $1 AND status = 'pending') as pending_posts,
      (SELECT COUNT(*) FROM blog_posts WHERE user_id = $1 AND status = 'published') as published_posts
  `, [ctx.from!.id]);
  
  const row = stats.rows[0];
  
  await ctx.reply(
    `📊 *Bot Status*\n\n` +
    `✅ Active Sources: ${row.active_sources}\n` +
    `📨 Pending Messages: ${row.pending_messages}\n` +
    `📝 Posts Awaiting Review: ${row.pending_posts}\n` +
    `✨ Published Posts: ${row.published_posts}\n\n` +
    `🤖 Bot is running and monitoring your sources.`,
    { parse_mode: 'Markdown' }
  );
});

bot.hears('⚙️ Settings', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) return;
  
  const settings = await getUserSettings(ctx.from!.id);
  
  await ctx.reply(
    '⚙️ *Bot Settings*\n\nConfigure how the bot processes and publishes content:',
    { parse_mode: 'Markdown', ...getSettingsMenu(settings) }
  );
});

bot.action('toggle_auto_publish', async (ctx) => {
  const userId = ctx.from!.id;
  
  await pool.query(
    'UPDATE user_settings SET auto_publish = NOT auto_publish WHERE user_id = $1',
    [userId]
  );
  
  const settings = await getUserSettings(userId);
  
  await ctx.editMessageReplyMarkup(getSettingsMenu(settings).reply_markup);
  await ctx.answerCbQuery(`Auto-publish ${settings.auto_publish ? 'enabled' : 'disabled'}`);
});

bot.hears('➕ Subscribe', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) return;
  
  await ctx.reply(
    '📢 *Subscribe to Channel/Group*\n\n' +
    'Forward me a message from the channel or group you want to monitor, ' +
    'or add me to the group and give me admin rights to read messages.\n\n' +
    'I will confirm once the source is added.',
    { parse_mode: 'Markdown' }
  );
});

bot.hears('📋 List Sources', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) return;
  
  const sources = await pool.query<MonitoredSource>(
    'SELECT * FROM monitored_sources WHERE user_id = $1 ORDER BY created_at DESC',
    [ctx.from!.id]
  );
  
  if (sources.rows.length === 0) {
    return ctx.reply('📭 No monitored sources yet. Use ➕ Subscribe to add some!');
  }
  
  let message = '📋 *Monitored Sources*\n\n';
  
  for (const source of sources.rows) {
    const status = source.is_active ? '✅' : '❌';
    message += `${status} *${source.chat_title}*\n`;
    message += `   Type: ${source.chat_type}\n`;
    message += `   ID: \`${source.id}\`\n\n`;
  }
  
  message += 'Use /unsubscribe <id> to remove a source';
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.hears('📝 Pending Posts', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) return;
  
  const posts = await pool.query<BlogPost>(
    'SELECT * FROM blog_posts WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 10',
    [ctx.from!.id, 'pending']
  );
  
  if (posts.rows.length === 0) {
    return ctx.reply('📭 No pending posts. All caught up!');
  }
  
  for (const post of posts.rows) {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Publish', `publish_${post.id}`),
        Markup.button.callback('❌ Reject', `reject_${post.id}`)
      ],
      [Markup.button.callback('✏️ Edit', `edit_${post.id}`)]
    ]);
    
    let message = `📝 *${post.title}*\n\n${post.content.substring(0, 500)}`;
    if (post.content.length > 500) message += '...';
    
    await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  }
});

bot.hears('👥 Manage Users', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) return;
  
  const users = await pool.query(
    'SELECT user_id, username, is_authorized FROM users ORDER BY created_at DESC'
  );
  
  let message = '👥 *User Management*\n\n';
  
  for (const user of users.rows) {
    const status = user.is_authorized ? '✅' : '❌';
    message += `${status} @${user.username || 'unknown'} (\`${user.user_id}\`)\n`;
  }
  
  message += '\nUse /authorize <user_id> to grant access\n';
  message += 'Use /revoke <user_id> to remove access';
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('authorize', async (ctx) => {
  if (ctx.from!.id !== parseInt(process.env.OWNER_USER_ID!)) {
    return ctx.reply('⛔ Only the owner can authorize users.');
  }
  
  const userId = ctx.message.text.split(' ')[1];
  if (!userId) {
    return ctx.reply('Usage: /authorize <user_id>');
  }
  
  await pool.query(
    'UPDATE users SET is_authorized = true WHERE user_id = $1',
    [parseInt(userId)]
  );
  
  await ctx.reply(`✅ User ${userId} has been authorized.`);
});

bot.command('unsubscribe', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) return;
  
  const sourceId = ctx.message.text.split(' ')[1];
  if (!sourceId) {
    return ctx.reply('Usage: /unsubscribe <source_id>');
  }
  
  await pool.query(
    'UPDATE monitored_sources SET is_active = false WHERE id = $1 AND user_id = $2',
    [parseInt(sourceId), ctx.from!.id]
  );
  
  await ctx.reply('✅ Source unsubscribed successfully.');
});

// Handle forwarded messages for subscription
bot.on(message('forward_origin'), async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) return;
  
  const forwardOrigin = ctx.message.forward_origin;
  let chatId: number;
  let chatTitle: string;
  let chatType: string;
  
  if (forwardOrigin.type === 'channel') {
    chatId = forwardOrigin.chat.id;
    chatTitle = forwardOrigin.chat.title!;
    chatType = 'channel';
  } else {
    return ctx.reply('❌ Please forward a message from a channel.');
  }
  
  await pool.query(
    `INSERT INTO monitored_sources (user_id, chat_id, chat_title, chat_type, is_active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (user_id, chat_id, topic_id) DO UPDATE SET is_active = true`,
    [ctx.from!.id, chatId, chatTitle, chatType]
  );
  
  await ctx.reply(
    `✅ Successfully subscribed to *${chatTitle}*!\n\n` +
    `I will now monitor messages from this ${chatType} and create wiki posts.`,
    { parse_mode: 'Markdown' }
  );
});

// Process pending messages periodically
async function processMessages() {
  try {
    const users = await pool.query('SELECT DISTINCT user_id FROM user_settings');
    
    for (const user of users.rows) {
      const settings = await getUserSettings(user.user_id);
      
      const messages = await pool.query<PendingMessage>(
        `SELECT pm.* FROM pending_messages pm
         JOIN monitored_sources ms ON pm.source_id = ms.id
         WHERE ms.user_id = $1 AND pm.is_processed = false
         ORDER BY pm.timestamp ASC`,
        [user.user_id]
      );
      
      if (messages.rows.length === 0) continue;
      
      const timeThreshold = new Date(
        Date.now() - settings.combine_threshold_minutes * 60 * 1000
      );
      
      const recentMessages = messages.rows.filter(
        m => m.timestamp >= timeThreshold
      );
      
      if (recentMessages.length === 0) continue;
      
      const analysis = await analyzeMessages(recentMessages);
      
      if (!analysis.isInformational) {
        await pool.query(
          'UPDATE pending_messages SET is_processed = true WHERE id = ANY($1)',
          [recentMessages.map(m => m.id)]
        );
        continue;
      }
      
      const mediaUrls = recentMessages.flatMap(m => m.media_urls || []);
      
      const postResult = await pool.query(
        `INSERT INTO blog_posts (user_id, title, content, media_urls, source_messages, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          user.user_id,
          analysis.suggestedTitle,
          analysis.combinedContent,
          mediaUrls,
          recentMessages.map(m => m.id),
          settings.auto_publish ? 'publishing' : 'pending'
        ]
      );
      
      await pool.query(
        'UPDATE pending_messages SET is_processed = true WHERE id = ANY($1)',
        [recentMessages.map(m => m.id)]
      );
      
      if (settings.auto_publish) {
        const postId = postResult.rows[0].id;
        await publishPost(postId, user.user_id);
      }
    }
  } catch (error) {
    console.error('Error processing messages:', error);
  }
}

async function publishPost(postId: number, userId: number) {
  try {
    const post = await pool.query<BlogPost>(
      'SELECT * FROM blog_posts WHERE id = $1',
      [postId]
    );
    
    if (post.rows.length === 0) return;
    
    const postData = post.rows[0];
    const settings = await getUserSettings(userId);
    
    let notionPageId, githubSha;
    
    if (settings.notion_database_id) {
      notionPageId = await publishToNotion(
        settings.notion_database_id,
        postData.title,
        postData.content,
        postData.media_urls || []
      );
    }
    
    if (settings.github_repo) {
      githubSha = await publishToGitHub(
        settings.github_repo,
        postData.title,
        postData.content,
        postData.media_urls || []
      );
    }
    
    await pool.query(
      `UPDATE blog_posts 
       SET status = 'published', notion_page_id = $1, github_commit_sha = $2, published_at = NOW()
       WHERE id = $3`,
      [notionPageId, githubSha, postId]
    );
    
    await bot.telegram.sendMessage(
      userId,
      `✅ Published: *${postData.title}*\n\n` +
      `${notionPageId ? '📝 Notion: Published\n' : ''}` +
      `${githubSha ? '🔗 GitHub: Committed\n' : ''}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error publishing post:', error);
    await pool.query(
      'UPDATE blog_posts SET status = $1 WHERE id = $2',
      ['failed', postId]
    );
  }
}

// Publish action handlers
bot.action(/publish_(\d+)/, async (ctx) => {
  const postId = parseInt(ctx.match![1]);
  await publishPost(postId, ctx.from!.id);
  await ctx.answerCbQuery('✅ Publishing post...');
  await ctx.deleteMessage();
});

bot.action(/reject_(\d+)/, async (ctx) => {
  const postId = parseInt(ctx.match![1]);
  await pool.query('DELETE FROM blog_posts WHERE id = $1', [postId]);
  await ctx.answerCbQuery('❌ Post rejected');
  await ctx.deleteMessage();
});

// Health check endpoint
const express = require('express');
const app = express();

app.get('/health', (req: any, res: any) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Health check server running on port ${PORT}`);
});

// Start bot
async function main() {
  try {
    await initDatabase();
    await bot.launch();
    console.log('✅ Bot started successfully');
    
    setInterval(processMessages, 30000);
    
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

main();