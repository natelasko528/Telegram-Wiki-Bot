import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const execAsync = promisify(exec);

// Create MCP server
const server = new Server(
  {
    name: 'deployment-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'deploy_to_flyio',
        description: 'Deploy a project to Fly.io automatically',
        inputSchema: {
          type: 'object',
          properties: {
            project_path: {
              type: 'string',
              description: 'Path to project directory',
            },
            app_name: {
              type: 'string',
              description: 'Fly.io app name',
            },
            secrets: {
              type: 'object',
              description: 'Environment secrets to set',
            },
          },
          required: ['project_path', 'app_name'],
        },
      },
      {
        name: 'create_github_repo',
        description: 'Create a new GitHub repository and push code',
        inputSchema: {
          type: 'object',
          properties: {
            repo_name: {
              type: 'string',
              description: 'Repository name',
            },
            description: {
              type: 'string',
              description: 'Repository description',
            },
            project_path: {
              type: 'string',
              description: 'Path to project directory',
            },
            private: {
              type: 'boolean',
              description: 'Make repository private',
              default: false,
            },
          },
          required: ['repo_name', 'project_path'],
        },
      },
      {
        name: 'setup_project',
        description: 'Create a complete project from template',
        inputSchema: {
          type: 'object',
          properties: {
            project_type: {
              type: 'string',
              enum: ['telegram-bot', 'web-app', 'api-service', 'mcp-server'],
              description: 'Type of project to create',
            },
            project_name: {
              type: 'string',
              description: 'Name of the project',
            },
            output_path: {
              type: 'string',
              description: 'Where to create the project',
            },
          },
          required: ['project_type', 'project_name', 'output_path'],
        },
      },
      {
        name: 'check_deployment_status',
        description: 'Check status of deployed applications',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              enum: ['flyio', 'vercel', 'railway', 'render'],
              description: 'Deployment service to check',
            },
            app_name: {
              type: 'string',
              description: 'Application name',
            },
          },
          required: ['service', 'app_name'],
        },
      },
      {
        name: 'install_dependencies',
        description: 'Install project dependencies automatically',
        inputSchema: {
          type: 'object',
          properties: {
            project_path: {
              type: 'string',
              description: 'Path to project',
            },
            package_manager: {
              type: 'string',
              enum: ['npm', 'yarn', 'pnpm'],
              default: 'npm',
            },
          },
          required: ['project_path'],
        },
      },
      {
        name: 'run_tests',
        description: 'Run project tests and return results',
        inputSchema: {
          type: 'object',
          properties: {
            project_path: {
              type: 'string',
              description: 'Path to project',
            },
          },
          required: ['project_path'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'deploy_to_flyio': {
        const { project_path, app_name, secrets } = args as any;
        
        // Navigate to project
        process.chdir(project_path);
        
        // Check if fly.toml exists
        try {
          await fs.access('fly.toml');
        } catch {
          // Create fly app if doesn't exist
          await execAsync(`fly launch --name ${app_name} --no-deploy`);
        }
        
        // Set secrets if provided
        if (secrets) {
          const secretArgs = Object.entries(secrets)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ');
          await execAsync(`fly secrets set ${secretArgs}`);
        }
        
        // Deploy
        const { stdout, stderr } = await execAsync('fly deploy');
        
        // Get status
        const { stdout: statusOut } = await execAsync('fly status --json');
        const status = JSON.parse(statusOut);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                app_name,
                url: `https://${app_name}.fly.dev`,
                status: status.Status,
                deployment_output: stdout,
                errors: stderr || null,
              }, null, 2),
            },
          ],
        };
      }

      case 'create_github_repo': {
        const { repo_name, description, project_path, private: isPrivate } = args as any;
        
        // Get GitHub token from environment
        const githubToken = process.env.GITHUB_TOKEN;
        if (!githubToken) {
          throw new Error('GITHUB_TOKEN not set in environment');
        }
        
        // Create repo via GitHub API
        const response = await axios.post(
          'https://api.github.com/user/repos',
          {
            name: repo_name,
            description: description || '',
            private: isPrivate || false,
          },
          {
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
        
        const repoUrl = response.data.clone_url;
        const htmlUrl = response.data.html_url;
        
        // Initialize git if needed
        process.chdir(project_path);
        try {
          await execAsync('git rev-parse --git-dir');
        } catch {
          await execAsync('git init');
        }
        
        // Add remote and push
        await execAsync(`git remote add origin ${repoUrl}`);
        await execAsync('git add .');
        await execAsync('git commit -m "Initial commit via MCP deployment agent"');
        await execAsync('git branch -M main');
        await execAsync('git push -u origin main');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                repo_name,
                repo_url: htmlUrl,
                clone_url: repoUrl,
                message: 'Repository created and code pushed successfully',
              }, null, 2),
            },
          ],
        };
      }

      case 'setup_project': {
        const { project_type, project_name, output_path } = args as any;
        
        const projectPath = path.join(output_path, project_name);
        await fs.mkdir(projectPath, { recursive: true });
        
        // Create project structure based on type
        const templates: Record<string, any> = {
          'telegram-bot': {
            files: {
              'package.json': {
                name: project_name,
                version: '1.0.0',
                main: 'dist/index.js',
                scripts: {
                  build: 'tsc',
                  start: 'node dist/index.js',
                  dev: 'ts-node src/index.ts',
                },
                dependencies: {
                  telegraf: '^4.16.3',
                  dotenv: '^16.4.5',
                },
                devDependencies: {
                  typescript: '^5.6.3',
                  'ts-node': '^10.9.2',
                  '@types/node': '^22.9.0',
                },
              },
              'src/index.ts': `import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.start((ctx) => ctx.reply('Hello! Bot is running!'));

bot.launch();
console.log('Bot started successfully');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));`,
              '.env.example': 'BOT_TOKEN=your_bot_token_here',
              'tsconfig.json': {
                compilerOptions: {
                  target: 'ES2022',
                  module: 'commonjs',
                  outDir: './dist',
                  rootDir: './src',
                  strict: true,
                  esModuleInterop: true,
                },
              },
            },
            directories: ['src', 'dist'],
          },
          'mcp-server': {
            files: {
              'package.json': {
                name: project_name,
                version: '1.0.0',
                type: 'module',
                bin: {
                  [project_name]: './build/index.js',
                },
                scripts: {
                  build: 'tsc',
                  watch: 'tsc --watch',
                },
                dependencies: {
                  '@modelcontextprotocol/sdk': '^1.0.0',
                },
                devDependencies: {
                  typescript: '^5.6.3',
                  '@types/node': '^22.9.0',
                },
              },
              'src/index.ts': `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: '${project_name}', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Add your tools here

const transport = new StdioServerTransport();
await server.connect(transport);`,
            },
            directories: ['src', 'build'],
          },
        };
        
        const template = templates[project_type];
        if (!template) {
          throw new Error(`Unknown project type: ${project_type}`);
        }
        
        // Create directories
        for (const dir of template.directories) {
          await fs.mkdir(path.join(projectPath, dir), { recursive: true });
        }
        
        // Create files
        for (const [filename, content] of Object.entries(template.files)) {
          const filePath = path.join(projectPath, filename);
          const fileContent = typeof content === 'string' 
            ? content 
            : JSON.stringify(content, null, 2);
          await fs.writeFile(filePath, fileContent);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                project_path: projectPath,
                project_type,
                message: 'Project created successfully',
                next_steps: [
                  `cd ${projectPath}`,
                  'npm install',
                  'npm run dev',
                ],
              }, null, 2),
            },
          ],
        };
      }

      case 'check_deployment_status': {
        const { service, app_name } = args as any;
        
        let status;
        switch (service) {
          case 'flyio': {
            const { stdout } = await execAsync(`fly status --app ${app_name} --json`);
            status = JSON.parse(stdout);
            break;
          }
          // Add other services...
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      case 'install_dependencies': {
        const { project_path, package_manager = 'npm' } = args as any;
        
        process.chdir(project_path);
        const { stdout, stderr } = await execAsync(`${package_manager} install`);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: !stderr,
                output: stdout,
                errors: stderr || null,
              }, null, 2),
            },
          ],
        };
      }

      case 'run_tests': {
        const { project_path } = args as any;
        
        process.chdir(project_path);
        try {
          const { stdout } = await execAsync('npm test');
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  output: stdout,
                }, null, 2),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: error.message,
                  output: error.stdout,
                }, null, 2),
              },
            ],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Deployment Agent MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});