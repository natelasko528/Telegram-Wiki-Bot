# Telegram Wiki Bot

An AI-assisted Telegram bot that monitors configured channels or groups, groups informational updates, and turns them into publishable posts for Notion and GitHub Pages. The project is written in TypeScript and runs on Node.js.

## Features

- Monitor Telegram channels/groups and collect new messages automatically.
- AI-powered message analysis using Google Gemini to detect informational content and generate summaries.
- Optional image captioning via Gemini Vision.
- Automatic publishing to Notion databases and GitHub repositories (for static sites such as GitHub Pages).
- Manual review flow with pending posts, inline review controls, and basic editing from Telegram.
- Health-check endpoint for production deployments.

## Prerequisites

- Node.js 18 or later
- PostgreSQL database (connection string provided via `DATABASE_URL`)
- API credentials:
  - Telegram Bot Token
  - Google Generative AI API Key
  - Optional: Notion API Key & Database ID, GitHub Personal Access Token

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env` and fill in the required values.
   - The bot requires at least `TELEGRAM_BOT_TOKEN`, `OWNER_USER_ID`, `GOOGLE_AI_API_KEY`, and `DATABASE_URL` to start.

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run the bot**
   ```bash
   npm start
   ```

   During development you can also run:
   ```bash
   npm run dev
   ```

## Development Scripts

- `npm run lint` – Lint the TypeScript source using ESLint.
- `npm run build` – Compile TypeScript to JavaScript in the `dist/` directory.
- `npm test` – Run linting followed by the TypeScript build.

## Project Structure

```
├── src/
│   └── index.ts          # Main bot implementation
├── dist/                 # Compiled JavaScript (after build)
├── .env.example          # Environment variable template
├── eslint.config.mjs     # ESLint configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

The bot manages users, settings, monitored sources, pending messages, and generated blog posts inside PostgreSQL. Tables are created automatically at startup if they do not already exist.

## Deployment Notes

- The `/health` endpoint exposes a JSON status payload useful for uptime checks.
- When deploying to services such as Fly.io or Render, ensure your Telegram webhook/long polling configuration and outbound network access for Notion, GitHub, and Google APIs.

## License

This project is released under the [MIT License](LICENSE).
