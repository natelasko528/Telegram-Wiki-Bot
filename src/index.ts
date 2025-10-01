import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Client as NotionClient } from '@notionhq/client';
import { Octokit } from '@octokit/rest';
import { Pool } from 'pg';
import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import type { Context } from 'telegraf';
import type { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import type { Chat, Message, PhotoSize, User } from 'telegraf/typings/core/types/typegram';

dotenv.config();

interface UserSettings {
  user_id: number;
  auto_publish: boolean;
  combine_threshold_minutes: number;
  notion_database_id: string | null;
  github_repo: string | null;
}

interface MonitoredSource {
  id: number;
  user_id: number;
  chat_id: number;
  chat_title: string | null;
  chat_type: string;
  topic_id: number | null;
  is_active: boolean;
}

interface PendingMessageRow {
  id: number;
  source_id: number;
  message_id: number;
  text: string | null;
  media_urls: string[] | null;
  sender: string | null;
  timestamp: Date | string;
  is_processed: boolean;
}

interface BlogPostRow {
  id: number;
  user_id: number;
  title: string;
  content: string;
  media_urls: string[] | null;
  notion_page_id: string | null;
  github_commit_sha: string | null;
  status: 'pending' | 'publishing' | 'published' | 'failed';
  created_at: Date | string;
}

interface AnalysisResult {
  shouldCombine: boolean;
  isInformational: boolean;
  suggestedTitle: string;
  combinedContent: string;
}

type SupportedMessage = Message.CommonMessage;

type UserState =
  | { type: 'set_notion_db' }
  | { type: 'set_github_repo' }
  | { type: 'set_combine_time' }
  | { type: 'edit_post'; postId: number };

const REQUIRED_ENV_VARS = [
  'TELEGRAM_BOT_TOKEN',
  'DATABASE_URL',
  'GOOGLE_AI_API_KEY',
  'OWNER_USER_ID'
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIsoString(value: Date | string): string {
  return toDate(value).toISOString();
}

function getSenderName(message: SupportedMessage): string {
  if ('author_signature' in message && message.author_signature) {
    return message.author_signature;
  }

  if ('sender_chat' in message && message.sender_chat) {
    const senderChat = message.sender_chat as Chat.ChannelChat | Chat.SupergroupChat | Chat.GroupChat;
    if ('title' in senderChat && senderChat.title) {
      return senderChat.title;
    }
  }

  const from = message.from as User | undefined;
  if (!from) {
    return 'Unknown';
  }

  if (from.username) {
    return `@${from.username}`;
  }

  const parts = [from.first_name, from.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : from.id.toString();
}

function extractMessageText(message: SupportedMessage): string {
  const textCandidate = (message as { text?: string }).text;
  if (typeof textCandidate === 'string' && textCandidate.length > 0) {
    return textCandidate;
  }

  const captionCandidate = (message as { caption?: string }).caption;
  if (typeof captionCandidate === 'string' && captionCandidate.length > 0) {
    return captionCandidate;
  }

  return '';
}

function getTopicId(message: SupportedMessage): number | null {
  return 'message_thread_id' in message && typeof message.message_thread_id === 'number'
    ? message.message_thread_id
    : null;
}

async function extractMediaUrls(ctx: Context, message: SupportedMessage): Promise<string[]> {
  const urls: string[] = [];

  const collectFile = async (fileId: string | undefined): Promise<void> => {
    if (!fileId) {
      return;
    }

    try {
      const link = await ctx.telegram.getFileLink(fileId);
      urls.push(link.href);
    } catch (error) {
      console.warn('Failed to resolve Telegram file link', error);
    }
  };

  if ('photo' in message && Array.isArray(message.photo)) {
    const largestPhoto: PhotoSize | undefined = message.photo[message.photo.length - 1];
    if (largestPhoto) {
      await collectFile(largestPhoto.file_id);
    }
  }

  if ('document' in message) {
    const document = (message as { document?: { file_id?: string } }).document;
    await collectFile(document?.file_id);
  }

  if ('video' in message) {
    const video = (message as { video?: { file_id?: string } }).video;
    await collectFile(video?.file_id);
  }

  if ('animation' in message) {
    const animation = (message as { animation?: { file_id?: string } }).animation;
    await collectFile(animation?.file_id);
  }

  if ('audio' in message) {
    const audio = (message as { audio?: { file_id?: string } }).audio;
    await collectFile(audio?.file_id);
  }

  return urls;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
const bot = new Telegraf(botToken);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '');
const notion = new NotionClient({ auth: process.env.NOTION_API_KEY ?? undefined });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN ?? undefined });

const userStates = new Map<number, UserState>();

async function initDatabase(): Promise<void> {
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (source_id, message_id)
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

async function isAuthorized(userId: number): Promise<boolean> {
  const result = await pool.query<{ is_authorized: boolean }>(
    'SELECT is_authorized FROM users WHERE user_id = $1',
    [userId]
  );
  return result.rows.length > 0 && result.rows[0].is_authorized === true;
}

async function getUserSettings(userId: number): Promise<UserSettings> {
  const result = await pool.query<UserSettings>(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return {
      user_id: userId,
      auto_publish: false,
      combine_threshold_minutes: 5,
      notion_database_id: null,
      github_repo: null
    };
  }

  return result.rows[0];
}

async function analyzeMessages(messages: PendingMessageRow[]): Promise<AnalysisResult> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const messageTexts = messages
    .map((m, index) => {
      const timestamp = toIsoString(m.timestamp);
      const sender = m.sender ?? 'Unknown';
      const text = m.text ?? '';
      return `[Message ${index + 1}] ${sender} at ${timestamp}: ${text}`;
    })
    .join('\n\n');

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
  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response not in expected JSON format');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<AnalysisResult>;
  return {
    shouldCombine: Boolean(parsed.shouldCombine),
    isInformational: Boolean(parsed.isInformational),
    suggestedTitle: parsed.suggestedTitle?.trim() ?? '',
    combinedContent: parsed.combinedContent?.trim() ?? ''
  };
}

async function publishToNotion(
  databaseId: string,
  title: string,
  content: string,
  mediaUrls: string[]
): Promise<string> {
  const children: BlockObjectRequest[] = [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content }
          }
        ]
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
        title: [
          {
            text: { content: title }
          }
        ]
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

async function publishToGitHub(
  repo: string,
  title: string,
  content: string,
  mediaUrls: string[]
): Promise<string> {
  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    throw new Error('GitHub repo must be in the format owner/repo');
  }

  const date = new Date();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = `${date.toISOString().split('T')[0]}-${slug}.md`;

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
    for (const url of mediaUrls) {
      markdownContent += `![Image](${url})\n\n`;
    }
  }

  const response = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path: `_posts/${filename}`,
    message: `Add post: ${title}`,
    content: Buffer.from(markdownContent).toString('base64')
  });

  return response.data.commit.sha ?? '';
}

function getMainMenu() {
  return Markup.keyboard([
    ['📊 Status', '⚙️ Settings'],
    ['➕ Subscribe', '📋 List Sources'],
    ['📝 Pending Posts', '👥 Manage Users']
  ]).resize();
}

function getSettingsMenu(settings: UserSettings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `Auto-publish: ${settings.auto_publish ? '✅ ON' : '❌ OFF'}`,
        'toggle_auto_publish'
      )
    ],
    [
      Markup.button.callback(
        `Combine time: ${settings.combine_threshold_minutes} min`,
        'set_combine_time'
      )
    ],
    [Markup.button.callback('🔗 Set Notion Database', 'set_notion_db')],
    [Markup.button.callback('🔗 Set GitHub Repo', 'set_github_repo')],
    [Markup.button.callback('« Back', 'back_to_main')]
  ]);
}

async function upsertUser(userId: number, username: string | undefined): Promise<void> {
  await pool.query(
    `INSERT INTO users (user_id, username, is_authorized)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, username ?? null, userId === Number(process.env.OWNER_USER_ID)]
  );

  await pool.query(
    `INSERT INTO user_settings (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function storePendingMessage(
  ctx: Context,
  source: MonitoredSource,
  message: SupportedMessage
): Promise<void> {
  const text = extractMessageText(message);
  const mediaUrls = await extractMediaUrls(ctx, message);

  if (!text && mediaUrls.length === 0) {
    return;
  }

  const timestamp = new Date((message.date ?? Math.floor(Date.now() / 1000)) * 1000);

  await pool.query(
    `INSERT INTO pending_messages (source_id, message_id, text, media_urls, sender, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source_id, message_id) DO NOTHING`,
    [
      source.id,
      message.message_id,
      text || null,
      mediaUrls,
      getSenderName(message),
      timestamp
    ]
  );
}

async function handleIncomingMessage(ctx: Context, message: SupportedMessage): Promise<void> {
  const chat = ctx.chat as Chat.ChannelChat | Chat.GroupChat | Chat.SupergroupChat | null;
  if (!chat) {
    return;
  }

  const topicId = getTopicId(message);
  const sources = await pool.query<MonitoredSource>(
    `SELECT * FROM monitored_sources
     WHERE chat_id = $1 AND is_active = true AND ($2::INT IS NULL OR topic_id IS NULL OR topic_id = $2)`,
    [chat.id, topicId]
  );

  if (sources.rows.length === 0) {
    return;
  }

  for (const source of sources.rows) {
    await storePendingMessage(ctx, source, message);
  }
}

async function publishPost(postId: number, userId: number): Promise<void> {
  await pool.query('UPDATE blog_posts SET status = $1 WHERE id = $2', ['publishing', postId]);

  try {
    const postResult = await pool.query<BlogPostRow>(
      'SELECT * FROM blog_posts WHERE id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (postResult.rows.length === 0) {
      return;
    }

    const post = postResult.rows[0];
    const settings = await getUserSettings(userId);

    const notionPageId = settings.notion_database_id
      ? await publishToNotion(settings.notion_database_id, post.title, post.content, post.media_urls ?? [])
      : null;

    const githubSha = settings.github_repo
      ? await publishToGitHub(settings.github_repo, post.title, post.content, post.media_urls ?? [])
      : null;

    await pool.query(
      `UPDATE blog_posts
       SET status = 'published', notion_page_id = $1, github_commit_sha = $2, published_at = NOW()
       WHERE id = $3`,
      [notionPageId, githubSha, postId]
    );

    await bot.telegram.sendMessage(
      userId,
      `✅ Published: *${post.title}*\n\n` +
        `${notionPageId ? '📝 Notion: Published\n' : ''}` +
        `${githubSha ? '🔗 GitHub: Committed\n' : ''}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await pool.query('UPDATE blog_posts SET status = $1 WHERE id = $2', ['failed', postId]);
    console.error('Error publishing post:', error);
  }
}

async function processMessages(): Promise<void> {
  try {
    const users = await pool.query<{ user_id: number }>('SELECT DISTINCT user_id FROM user_settings');

    for (const user of users.rows) {
      const settings = await getUserSettings(user.user_id);
      const messagesResult = await pool.query<PendingMessageRow>(
        `SELECT pm.* FROM pending_messages pm
         JOIN monitored_sources ms ON pm.source_id = ms.id
         WHERE ms.user_id = $1 AND pm.is_processed = false
         ORDER BY pm.timestamp ASC`,
        [user.user_id]
      );

      if (messagesResult.rows.length === 0) {
        continue;
      }

      const timeThreshold = new Date(Date.now() - settings.combine_threshold_minutes * 60 * 1000);
      const recentMessages = messagesResult.rows.filter((message) => toDate(message.timestamp) >= timeThreshold);

      if (recentMessages.length === 0) {
        continue;
      }

      const analysis = await analyzeMessages(recentMessages);

      if (!analysis.isInformational) {
        await pool.query('UPDATE pending_messages SET is_processed = true WHERE id = ANY($1)', [
          recentMessages.map((m) => m.id)
        ]);
        continue;
      }

      const mediaUrls = recentMessages.flatMap((m) => m.media_urls ?? []);
      let content = analysis.combinedContent;

      if (!content) {
        content = recentMessages
          .map((m) => `**${m.sender ?? 'Unknown'}** (${toIsoString(m.timestamp)}):\n${m.text ?? ''}`)
          .join('\n\n');
      }

      const title = analysis.suggestedTitle || `Telegram Update ${new Date().toISOString()}`;

      const postInsert = await pool.query<{ id: number }>(
        `INSERT INTO blog_posts (user_id, title, content, media_urls, source_messages, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          user.user_id,
          title,
          content,
          mediaUrls,
          recentMessages.map((m) => m.id),
          settings.auto_publish ? 'publishing' : 'pending'
        ]
      );

      await pool.query('UPDATE pending_messages SET is_processed = true WHERE id = ANY($1)', [
        recentMessages.map((m) => m.id)
      ]);

      if (settings.auto_publish) {
        const postId = postInsert.rows[0]?.id;
        if (postId) {
          await publishPost(postId, user.user_id);
        }
      } else {
        await bot.telegram.sendMessage(
          user.user_id,
          `📝 New draft ready: *${title}*\nUse the Pending Posts menu to review and publish.`,
          { parse_mode: 'Markdown' }
        );
      }
    }
  } catch (error) {
    console.error('Error processing messages:', error);
  }
}

bot.start(async (ctx) => {
  await upsertUser(ctx.from!.id, ctx.from?.username);

  if (!await isAuthorized(ctx.from!.id)) {
    await ctx.reply('⛔ You are not authorized to use this bot. Contact the owner for access.');
    return;
  }

  await ctx.reply(
    '🤖 *Telegram Wiki Bot*\n\n' +
      'I monitor your selected channels and groups, analyze messages with AI, and automatically create blog posts.\n\n' +
      '*Features:*\n' +
      '• AI-powered message analysis\n' +
      '• Automatic content vs conversation detection\n' +
      '• Smart message grouping\n' +
      '• Dual publishing (Notion + GitHub)\n' +
      '• Manual review option\n\n' +
      'Use the menu below to get started!',
    { parse_mode: 'Markdown', reply_markup: getMainMenu().reply_markup }
  );
});

bot.hears('📊 Status', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    return;
  }

  const stats = await pool.query<{
    active_sources: string;
    pending_messages: string;
    pending_posts: string;
    published_posts: string;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM monitored_sources WHERE user_id = $1 AND is_active = true) as active_sources,
      (SELECT COUNT(*) FROM pending_messages pm
       JOIN monitored_sources ms ON pm.source_id = ms.id
       WHERE ms.user_id = $1 AND pm.is_processed = false) as pending_messages,
      (SELECT COUNT(*) FROM blog_posts WHERE user_id = $1 AND status = 'pending') as pending_posts,
      (SELECT COUNT(*) FROM blog_posts WHERE user_id = $1 AND status = 'published') as published_posts`,
    [ctx.from!.id]
  );

  const row = stats.rows[0];
  const activeSources = Number(row?.active_sources ?? 0);
  const pendingMessages = Number(row?.pending_messages ?? 0);
  const pendingPosts = Number(row?.pending_posts ?? 0);
  const publishedPosts = Number(row?.published_posts ?? 0);

  await ctx.reply(
    `📊 *Bot Status*\n\n` +
      `✅ Active Sources: ${activeSources}\n` +
      `📨 Pending Messages: ${pendingMessages}\n` +
      `📝 Posts Awaiting Review: ${pendingPosts}\n` +
      `✨ Published Posts: ${publishedPosts}\n\n` +
      '🤖 Bot is running and monitoring your sources.',
    { parse_mode: 'Markdown' }
  );
});

bot.hears('⚙️ Settings', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    return;
  }

  const settings = await getUserSettings(ctx.from!.id);

  await ctx.reply(
    '⚙️ *Bot Settings*\n\nConfigure how the bot processes and publishes content:',
    { parse_mode: 'Markdown', reply_markup: getSettingsMenu(settings).reply_markup }
  );
});

bot.action('toggle_auto_publish', async (ctx) => {
  const userId = ctx.from!.id;
  if (!await isAuthorized(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  await pool.query(
    'UPDATE user_settings SET auto_publish = NOT auto_publish, updated_at = NOW() WHERE user_id = $1',
    [userId]
  );

  const settings = await getUserSettings(userId);

  await ctx.answerCbQuery(`Auto-publish ${settings.auto_publish ? 'enabled' : 'disabled'}`);
  await ctx.editMessageReplyMarkup(getSettingsMenu(settings).reply_markup);
});

bot.action('set_combine_time', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  userStates.set(ctx.from!.id, { type: 'set_combine_time' });
  await ctx.answerCbQuery();
  await ctx.reply('⌛ Send the number of minutes the bot should wait before grouping messages together.');
});

bot.action('set_notion_db', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  userStates.set(ctx.from!.id, { type: 'set_notion_db' });
  await ctx.answerCbQuery();
  await ctx.reply('🔗 Send the Notion database ID to publish posts into.');
});

bot.action('set_github_repo', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  userStates.set(ctx.from!.id, { type: 'set_github_repo' });
  await ctx.answerCbQuery();
  await ctx.reply('🔗 Send the GitHub repository in the format `owner/repo` for publishing.');
});

bot.action('back_to_main', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  await ctx.reply('Main menu reopened.', { reply_markup: getMainMenu().reply_markup });
});

bot.hears('➕ Subscribe', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    return;
  }

  await ctx.reply(
    '📢 *Subscribe to Channel/Group*\n\n' +
      'Forward me a message from the channel or group you want to monitor, or add me to the group and give me access to read messages.\n\n' +
      'I will confirm once the source is added.',
    { parse_mode: 'Markdown' }
  );
});

bot.hears('📋 List Sources', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    return;
  }

  const sources = await pool.query<MonitoredSource>(
    'SELECT * FROM monitored_sources WHERE user_id = $1 ORDER BY created_at DESC',
    [ctx.from!.id]
  );

  if (sources.rows.length === 0) {
    await ctx.reply('📭 No monitored sources yet. Use ➕ Subscribe to add some!');
    return;
  }

  let messageText = '📋 *Monitored Sources*\n\n';

  for (const source of sources.rows) {
    const status = source.is_active ? '✅' : '❌';
    messageText += `${status} *${source.chat_title ?? 'Unnamed chat'}*\n`;
    messageText += `   Type: ${source.chat_type}\n`;
    messageText += `   ID: \`${source.id}\`\n\n`;
  }

  messageText += 'Use /unsubscribe <id> to remove a source';

  await ctx.reply(messageText, { parse_mode: 'Markdown' });
});

bot.hears('📝 Pending Posts', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    return;
  }

  const posts = await pool.query<BlogPostRow>(
    'SELECT * FROM blog_posts WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 10',
    [ctx.from!.id, 'pending']
  );

  if (posts.rows.length === 0) {
    await ctx.reply('📭 No pending posts. All caught up!');
    return;
  }

  for (const post of posts.rows) {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Publish', `publish_${post.id}`),
        Markup.button.callback('❌ Reject', `reject_${post.id}`)
      ],
      [Markup.button.callback('✏️ Edit', `edit_${post.id}`)]
    ]);

    let snippet = post.content.slice(0, 500);
    if (post.content.length > 500) {
      snippet += '...';
    }

    await ctx.reply(`📝 *${post.title}*\n\n${snippet}`, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }
});

bot.hears('👥 Manage Users', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    return;
  }

  const users = await pool.query<{ user_id: number; username: string | null; is_authorized: boolean }>(
    'SELECT user_id, username, is_authorized FROM users ORDER BY created_at DESC'
  );

  let messageText = '👥 *User Management*\n\n';

  for (const user of users.rows) {
    const status = user.is_authorized ? '✅' : '❌';
    messageText += `${status} @${user.username ?? 'unknown'} (\`${user.user_id}\`)\n`;
  }

  messageText += '\nUse /authorize <user_id> to grant access\n';
  messageText += 'Use /revoke <user_id> to remove access';

  await ctx.reply(messageText, { parse_mode: 'Markdown' });
});

bot.command('authorize', async (ctx) => {
  if (ctx.from?.id !== Number(process.env.OWNER_USER_ID)) {
    await ctx.reply('⛔ Only the owner can authorize users.');
    return;
  }

  const parts = ctx.message.text.split(' ');
  const userId = Number(parts[1]);

  if (!Number.isInteger(userId)) {
    await ctx.reply('Usage: /authorize <user_id>');
    return;
  }

  await pool.query('UPDATE users SET is_authorized = true WHERE user_id = $1', [userId]);
  await ctx.reply(`✅ User ${userId} has been authorized.`);
});

bot.command('revoke', async (ctx) => {
  if (ctx.from?.id !== Number(process.env.OWNER_USER_ID)) {
    await ctx.reply('⛔ Only the owner can revoke users.');
    return;
  }

  const parts = ctx.message.text.split(' ');
  const userId = Number(parts[1]);

  if (!Number.isInteger(userId)) {
    await ctx.reply('Usage: /revoke <user_id>');
    return;
  }

  await pool.query('UPDATE users SET is_authorized = false WHERE user_id = $1', [userId]);
  await ctx.reply(`🚫 User ${userId} has been revoked.`);
});

bot.command('unsubscribe', async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    return;
  }

  const parts = ctx.message.text.split(' ');
  const sourceId = Number(parts[1]);

  if (!Number.isInteger(sourceId)) {
    await ctx.reply('Usage: /unsubscribe <source_id>');
    return;
  }

  await pool.query(
    'UPDATE monitored_sources SET is_active = false WHERE id = $1 AND user_id = $2',
    [sourceId, ctx.from!.id]
  );

  await ctx.reply('✅ Source unsubscribed successfully.');
});

bot.on(message('forward_origin'), async (ctx) => {
  if (!await isAuthorized(ctx.from!.id)) {
    return;
  }

  const forwardOrigin = ctx.message.forward_origin;
  if (!forwardOrigin) {
    await ctx.reply('❌ Forwarded message does not include origin information.');
    return;
  }

  if (forwardOrigin.type !== 'channel') {
    await ctx.reply('❌ Please forward a message from a channel.');
    return;
  }

  const chatId = forwardOrigin.chat.id;
  const forwardChat = forwardOrigin.chat as Chat.ChannelChat | Chat.SupergroupChat | Chat.GroupChat;
  const chatTitle = 'title' in forwardChat && forwardChat.title ? forwardChat.title : 'Unnamed channel';
  const chatType = 'channel';

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

bot.on('channel_post', async (ctx) => {
  const channelMessage = ctx.channelPost;
  if (channelMessage) {
    await handleIncomingMessage(ctx, channelMessage);
  }
});

bot.on(message('text'), async (ctx, next) => {
  if (ctx.chat?.type !== 'private') {
    const groupMessage = ctx.message;
    if (groupMessage) {
      await handleIncomingMessage(ctx, groupMessage);
    }
    return;
  }

  const state = ctx.from ? userStates.get(ctx.from.id) : undefined;
  if (!state) {
    await next();
    return;
  }

  const text = ctx.message.text?.trim() ?? '';

  switch (state.type) {
    case 'set_notion_db': {
      await pool.query(
        'UPDATE user_settings SET notion_database_id = $1, updated_at = NOW() WHERE user_id = $2',
        [text, ctx.from!.id]
      );
      await ctx.reply('✅ Notion database saved.');
      break;
    }
    case 'set_github_repo': {
      if (!/^[^/]+\/[^/]+$/.test(text)) {
        await ctx.reply('⚠️ Repo must be in the format `owner/repo`. Try again.');
        return;
      }

      await pool.query('UPDATE user_settings SET github_repo = $1, updated_at = NOW() WHERE user_id = $2', [
        text,
        ctx.from!.id
      ]);
      await ctx.reply('✅ GitHub repository saved.');
      break;
    }
    case 'set_combine_time': {
      const minutes = Number(text);
      if (!Number.isInteger(minutes) || minutes <= 0) {
        await ctx.reply('⚠️ Please send a positive integer for minutes.');
        return;
      }

      await pool.query(
        'UPDATE user_settings SET combine_threshold_minutes = $1, updated_at = NOW() WHERE user_id = $2',
        [minutes, ctx.from!.id]
      );
      await ctx.reply(`✅ Combine threshold updated to ${minutes} minutes.`);
      break;
    }
    case 'edit_post': {
      const postId = state.postId;
      await pool.query('UPDATE blog_posts SET content = $1 WHERE id = $2 AND user_id = $3', [
        text,
        postId,
        ctx.from!.id
      ]);
      await ctx.reply('✅ Post content updated. You can publish it from the Pending Posts menu.');
      break;
    }
    default: {
      await ctx.reply('❓ Unknown action.');
      break;
    }
  }

  userStates.delete(ctx.from!.id);
});

bot.action(/publish_(\d+)/, async (ctx) => {
  const match = ctx.match;
  if (!Array.isArray(match)) {
    await ctx.answerCbQuery('Invalid post');
    return;
  }

  const postId = Number(match[1]);
  if (!Number.isInteger(postId)) {
    await ctx.answerCbQuery('Invalid post');
    return;
  }

  await publishPost(postId, ctx.from!.id);
  await ctx.answerCbQuery('✅ Publishing post...');
  await ctx.deleteMessage();
});

bot.action(/reject_(\d+)/, async (ctx) => {
  const match = ctx.match;
  if (!Array.isArray(match)) {
    await ctx.answerCbQuery('Invalid post');
    return;
  }

  const postId = Number(match[1]);
  if (!Number.isInteger(postId)) {
    await ctx.answerCbQuery('Invalid post');
    return;
  }

  await pool.query('DELETE FROM blog_posts WHERE id = $1 AND user_id = $2', [postId, ctx.from!.id]);
  await ctx.answerCbQuery('❌ Post rejected');
  await ctx.deleteMessage();
});

bot.action(/edit_(\d+)/, async (ctx) => {
  const match = ctx.match;
  if (!Array.isArray(match)) {
    await ctx.answerCbQuery('Invalid post');
    return;
  }

  const postId = Number(match[1]);
  if (!Number.isInteger(postId)) {
    await ctx.answerCbQuery('Invalid post');
    return;
  }

  userStates.set(ctx.from!.id, { type: 'edit_post', postId });
  await ctx.answerCbQuery();
  await ctx.reply('✏️ Send the updated content for this post.');
});

bot.catch((err, ctx) => {
  console.error(`Error for update type ${ctx.updateType}:`, err);
});

const app = express();
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

let processingInterval: ReturnType<typeof setInterval> | undefined;

async function main(): Promise<void> {
  validateEnv();
  await initDatabase();
  await bot.launch();
  console.log('✅ Bot started successfully');

  processingInterval = setInterval(() => {
    void processMessages();
  }, 30000);
  void processMessages();

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`✅ Health check server running on port ${port}`);
  });
}

void main();

process.once('SIGINT', () => {
  if (processingInterval) {
    clearInterval(processingInterval);
  }
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  if (processingInterval) {
    clearInterval(processingInterval);
  }
  bot.stop('SIGTERM');
});
