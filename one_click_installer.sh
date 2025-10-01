#!/bin/bash
# One-Click Claude Autonomous Agent Installer
# Download and run: curl -fsSL [URL] | bash

set -e
REPO="https://raw.githubusercontent.com/anthropics/anthropic-quickstarts/main/mcp"
INSTALL_DIR="$HOME/claude-deployment-agent"

echo "🤖 Installing Claude Deployment Agent..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install from https://nodejs.org"
    exit 1
fi

# Create directory
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download files
echo "📥 Downloading files..."
curl -fsSL "$REPO/package.json" -o package.json 2>/dev/null || cat > package.json << 'EOF'
{
  "name": "claude-deployment-agent",
  "version": "1.0.0",
  "type": "module",
  "main": "build/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node build/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.7.7"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "typescript": "^5.6.3"
  }
}
EOF

# Create tsconfig
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
EOF

# Create source
mkdir -p src
curl -fsSL "$REPO/index.ts" -o src/index.ts 2>/dev/null || cat > src/index.ts << 'EOFCODE'
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const server = new Server(
  { name: 'deployment-agent', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'deploy_to_flyio',
      description: 'Deploy a project to Fly.io',
      inputSchema: {
        type: 'object',
        properties: {
          project_path: { type: 'string' },
          app_name: { type: 'string' }
        },
        required: ['project_path', 'app_name']
      }
    },
    {
      name: 'run_command',
      description: 'Run a shell command',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          cwd: { type: 'string' }
        },
        required: ['command']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === 'deploy_to_flyio') {
      const { project_path, app_name } = args as any;
      process.chdir(project_path);
      const { stdout } = await execAsync('fly deploy');
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, output: stdout }, null, 2) }]
      };
    } else if (name === 'run_command') {
      const { command, cwd } = args as any;
      const { stdout } = await execAsync(command, cwd ? { cwd } : {});
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, output: stdout }, null, 2) }]
      };
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
EOFCODE

echo "📦 Installing dependencies..."
npm install --silent

echo "🔨 Building..."
npm run build --silent

# Configure Claude Desktop
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
else
    CONFIG_DIR="$HOME/.config/Claude"
fi

mkdir -p "$CONFIG_DIR"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

cat > "$CONFIG_FILE" << EOFCONFIG
{
  "mcpServers": {
    "deployment-agent": {
      "command": "node",
      "args": ["$INSTALL_DIR/build/index.js"]
    }
  }
}
EOFCONFIG

echo ""
echo "✅ Installation complete!"
echo ""
echo "📍 Installed to: $INSTALL_DIR"
echo "⚙️  Config: $CONFIG_FILE"
echo ""
echo "🔄 RESTART CLAUDE DESKTOP NOW"
echo ""
echo "Then tell Claude: 'Test the deployment agent'"
echo ""