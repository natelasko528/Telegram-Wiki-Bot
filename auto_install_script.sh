#!/bin/bash

################################################################################
# Autonomous Claude Installation Script
# This script sets up everything needed to make Claude autonomous
# Usage: bash install-autonomous-claude.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log file
LOG_FILE="$HOME/claude-setup-$(date +%Y%m%d-%H%M%S).log"
INSTALL_DIR="$HOME/claude-deployment-agent"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}❌ ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt for input
prompt_input() {
    local prompt="$1"
    local var_name="$2"
    local default="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        eval "$var_name=\"${input:-$default}\""
    else
        read -p "$prompt: " input
        eval "$var_name=\"$input\""
    fi
}

# Function to prompt for secret (hidden input)
prompt_secret() {
    local prompt="$1"
    local var_name="$2"
    
    read -s -p "$prompt: " input
    echo ""
    eval "$var_name=\"$input\""
}

################################################################################
# MAIN INSTALLATION
################################################################################

log ""
log "╔════════════════════════════════════════════════════════════╗"
log "║         AUTONOMOUS CLAUDE INSTALLATION SCRIPT             ║"
log "║                                                            ║"
log "║  This will install everything needed to make Claude       ║"
log "║  deploy projects autonomously!                            ║"
log "╚════════════════════════════════════════════════════════════╝"
log ""
log_info "Log file: $LOG_FILE"
log_info "Installation directory: $INSTALL_DIR"
log ""

# Confirm installation
read -p "Ready to start installation? (y/n): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    log_warning "Installation cancelled"
    exit 0
fi

################################################################################
# STEP 1: Check Prerequisites
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📋 STEP 1: Checking Prerequisites"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    log_success "Node.js installed: $NODE_VERSION"
else
    log_error "Node.js not found!"
    log_info "Please install Node.js 18+ from: https://nodejs.org"
    log_info "Or use: brew install node (macOS) or apt install nodejs (Linux)"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    log_success "npm installed: $NPM_VERSION"
else
    log_error "npm not found!"
    exit 1
fi

# Check git
if command_exists git; then
    GIT_VERSION=$(git --version)
    log_success "Git installed: $GIT_VERSION"
else
    log_warning "Git not found (optional)"
fi

# Check fly (optional)
if command_exists fly; then
    FLY_VERSION=$(fly version)
    log_success "Fly CLI installed: $FLY_VERSION"
else
    log_warning "Fly CLI not found (will skip Fly.io integration)"
    SKIP_FLYIO=true
fi

################################################################################
# STEP 2: Collect Configuration
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "⚙️  STEP 2: Configuration"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log_info "I need some information to configure the MCP server."
log_info "You can skip optional items by pressing Enter."
log ""

# GitHub Token
prompt_secret "Enter your GitHub Personal Access Token (optional)" GITHUB_TOKEN
echo "$GITHUB_TOKEN" >> "$LOG_FILE.secrets"

# Fly.io Token
if [ "$SKIP_FLYIO" != "true" ]; then
    prompt_secret "Enter your Fly.io API Token (optional)" FLY_TOKEN
    echo "$FLY_TOKEN" >> "$LOG_FILE.secrets"
fi

log_success "Configuration collected"

################################################################################
# STEP 3: Create Project Structure
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📁 STEP 3: Creating Project Structure"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create installation directory
if [ -d "$INSTALL_DIR" ]; then
    log_warning "Directory already exists: $INSTALL_DIR"
    read -p "Remove and recreate? (y/n): " recreate
    if [ "$recreate" = "y" ] || [ "$recreate" = "Y" ]; then
        rm -rf "$INSTALL_DIR"
        log_info "Removed existing directory"
    else
        log_error "Installation cancelled"
        exit 1
    fi
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
log_success "Created directory: $INSTALL_DIR"

# Create subdirectories
mkdir -p src
mkdir -p build
mkdir -p logs
log_success "Created subdirectories"

################################################################################
# STEP 4: Create package.json
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📦 STEP 4: Creating package.json"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > package.json << 'EOF'
{
  "name": "claude-deployment-agent",
  "version": "1.0.0",
  "description": "MCP server for autonomous Claude deployments",
  "type": "module",
  "main": "build/index.js",
  "bin": {
    "claude-deployment-agent": "./build/index.js"
  },
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "start": "node build/index.js"
  },
  "keywords": ["mcp", "claude", "deployment"],
  "author": "Auto-generated",
  "license": "MIT",
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

log_success "Created package.json"

################################################################################
# STEP 5: Create tsconfig.json
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "⚙️  STEP 5: Creating tsconfig.json"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

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
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}
EOF

log_success "Created tsconfig.json"

################################################################################
# STEP 6: Create MCP Server Code
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🤖 STEP 6: Creating MCP Server Code"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat > src/index.ts << 'EOFCODE'
#!/usr/bin/env node
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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'deploy_to_flyio',
        description: 'Deploy a project to Fly.io',
        inputSchema: {
          type: 'object',
          properties: {
            project_path: { type: 'string', description: 'Project directory path' },
            app_name: { type: 'string', description: 'Fly.io app name' },
          },
          required: ['project_path', 'app_name'],
        },
      },
      {
        name: 'run_command',
        description: 'Run a shell command in a project directory',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to run' },
            cwd: { type: 'string', description: 'Working directory' },
          },
          required: ['command'],
        },
      },
      {
        name: 'check_project_status',
        description: 'Check if a project directory exists and is valid',
        inputSchema: {
          type: 'object',
          properties: {
            project_path: { type: 'string', description: 'Project directory path' },
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
        const { project_path, app_name } = args as any;
        
        process.chdir(project_path);
        
        // Check if fly.toml exists
        try {
          await fs.access('fly.toml');
        } catch {
          await execAsync(`fly launch --name ${app_name} --no-deploy`);
        }
        
        // Deploy
        const { stdout, stderr } = await execAsync('fly deploy');
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              app_name,
              url: `https://${app_name}.fly.dev`,
              output: stdout,
              errors: stderr || null,
            }, null, 2),
          }],
        };
      }

      case 'run_command': {
        const { command, cwd } = args as any;
        
        const options = cwd ? { cwd } : {};
        const { stdout, stderr } = await execAsync(command, options);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              command,
              output: stdout,
              errors: stderr || null,
            }, null, 2),
          }],
        };
      }

      case 'check_project_status': {
        const { project_path } = args as any;
        
        try {
          const stats = await fs.stat(project_path);
          const packageJsonPath = path.join(project_path, 'package.json');
          let hasPackageJson = false;
          let projectType = 'unknown';
          
          try {
            await fs.access(packageJsonPath);
            hasPackageJson = true;
            const packageData = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageData);
            projectType = packageJson.type || 'commonjs';
          } catch {}
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                exists: true,
                is_directory: stats.isDirectory(),
                has_package_json: hasPackageJson,
                project_type: projectType,
                path: project_path,
              }, null, 2),
            }],
          };
        } catch (error: any) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                exists: false,
                error: error.message,
              }, null, 2),
            }],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
          stack: error.stack,
        }, null, 2),
      }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Deployment Agent MCP server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
EOFCODE

log_success "Created MCP server code"

################################################################################
# STEP 7: Install Dependencies
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📦 STEP 7: Installing Dependencies"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log_info "This may take a few minutes..."

npm install >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    log_success "Dependencies installed successfully"
else
    log_error "Failed to install dependencies"
    log_info "Check log file: $LOG_FILE"
    exit 1
fi

################################################################################
# STEP 8: Build TypeScript
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🔨 STEP 8: Building TypeScript"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

npm run build >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    log_success "TypeScript compiled successfully"
else
    log_error "Failed to build TypeScript"
    log_info "Check log file: $LOG_FILE"
    exit 1
fi

# Verify build output
if [ -f "build/index.js" ]; then
    log_success "Build output verified: build/index.js"
else
    log_error "Build output not found!"
    exit 1
fi

################################################################################
# STEP 9: Configure Claude Desktop
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "⚙️  STEP 9: Configuring Claude Desktop"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Detect OS and set config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
    log_info "Detected macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CONFIG_DIR="$HOME/.config/Claude"
    log_info "Detected Linux"
else
    log_warning "Unknown OS, using Linux path"
    CONFIG_DIR="$HOME/.config/Claude"
fi

CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

# Create config directory
mkdir -p "$CONFIG_DIR"
log_success "Config directory ready: $CONFIG_DIR"

# Create or update config file
ENV_VARS=""
if [ -n "$GITHUB_TOKEN" ]; then
    ENV_VARS="\"GITHUB_TOKEN\": \"$GITHUB_TOKEN\""
fi
if [ -n "$FLY_TOKEN" ]; then
    if [ -n "$ENV_VARS" ]; then
        ENV_VARS="$ENV_VARS,
        "
    fi
    ENV_VARS="${ENV_VARS}\"FLY_API_TOKEN\": \"$FLY_TOKEN\""
fi

cat > "$CONFIG_FILE" << EOFCONFIG
{
  "mcpServers": {
    "deployment-agent": {
      "command": "node",
      "args": [
        "$INSTALL_DIR/build/index.js"
      ],
      "env": {
        ${ENV_VARS}
      }
    }
  }
}
EOFCONFIG

log_success "Claude Desktop configuration created"
log_info "Config file: $CONFIG_FILE"

################################################################################
# STEP 10: Create Helper Scripts
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🛠️  STEP 10: Creating Helper Scripts"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create test script
cat > test-mcp.sh << 'EOFTEST'
#!/bin/bash
echo "Testing MCP server..."
node build/index.js << 'EOFINPUT'
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
EOFINPUT
EOFTEST

chmod +x test-mcp.sh
log_success "Created test script: test-mcp.sh"

# Create README
cat > README.md << 'EOFREADME'
# Claude Deployment Agent MCP Server

Auto-generated MCP server that gives Claude autonomous deployment capabilities.

## What This Does

This MCP server allows Claude to:
- Deploy projects to Fly.io
- Run shell commands
- Check project status
- Execute builds and tests

## Usage

The server is automatically configured in Claude Desktop.

Just tell Claude:
- "Deploy my project to Fly.io"
- "Run npm install in ~/my-project"
- "Check status of ~/my-app"

Claude will execute these commands autonomously!

## Files

- `src/index.ts` - MCP server source code
- `build/index.js` - Compiled JavaScript
- `test-mcp.sh` - Test the server
- `logs/` - Server logs

## Manual Testing

```bash
./test-mcp.sh
```

## Rebuild

```bash
npm run build
```

## Logs

Server logs are in: `logs/`
Installation log: Check your home directory

## Configuration

Config file: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or: `~/.config/Claude/claude_desktop_config.json` (Linux)

## Restart Claude Desktop

After installation, restart Claude Desktop to load the MCP server.

## Support

Check the installation log for any issues.
EOFREADME

log_success "Created README.md"

################################################################################
# STEP 11: Final Verification
################################################################################

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "✅ STEP 11: Final Verification"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check all required files
REQUIRED_FILES=(
    "package.json"
    "tsconfig.json"
    "src/index.ts"
    "build/index.js"
    "README.md"
    "test-mcp.sh"
)

ALL_GOOD=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "✓ $file"
    else
        log_error "✗ $file (missing)"
        ALL_GOOD=false
    fi
done

################################################################################
# INSTALLATION COMPLETE
################################################################################

log ""
log "╔════════════════════════════════════════════════════════════╗"
log "║                  INSTALLATION COMPLETE!                    ║"
log "╚════════════════════════════════════════════════════════════╝"
log ""

if [ "$ALL_GOOD" = true ]; then
    log_success "All files created successfully!"
    log ""
    log_info "Installation Summary:"
    log_info "  • MCP Server: $INSTALL_DIR"
    log_info "  • Config File: $CONFIG_FILE"
    log_info "  • Log File: $LOG_FILE"
    log ""
    log_warning "NEXT STEPS:"
    log ""
    log "  1. Restart Claude Desktop application"
    log "  2. Open Claude and say: 'Test the deployment agent'"
    log "  3. I should respond with available deployment tools!"
    log ""
    log_info "Test the server manually:"
    log "  cd $INSTALL_DIR"
    log "  ./test-mcp.sh"
    log ""
    log_info "View logs:"
    log "  cat $LOG_FILE"
    log ""
    log_success "You can now ask me to deploy projects autonomously! 🚀"
else
    log_error "Some files are missing. Check the log file:"
    log_error "$LOG_FILE"
    exit 1
fi

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Save important info to a summary file
SUMMARY_FILE="$INSTALL_DIR/INSTALLATION_SUMMARY.txt"
cat > "$SUMMARY_FILE" << EOFSUMMARY
╔════════════════════════════════════════════════════════════╗
║          CLAUDE DEPLOYMENT AGENT - INSTALLATION            ║
╚════════════════════════════════════════════════════════════╝

Date: $(date)
Installation Directory: $INSTALL_DIR
Config File: $CONFIG_FILE
Log File: $LOG_FILE

✅ Installation completed successfully!

NEXT STEPS:
1. Restart Claude Desktop
2. Tell Claude: "Test the deployment agent"
3. Start deploying autonomously!

USEFUL COMMANDS:
- Test server: cd $INSTALL_DIR && ./test-mcp.sh
- Rebuild: cd $INSTALL_DIR && npm run build
- View logs: cat $LOG_FILE

WHAT CLAUDE CAN DO NOW:
• Deploy to Fly.io
• Run shell commands
• Check project status
• Execute builds and tests

EXAMPLE COMMANDS TO TRY:
"Deploy my project at ~/my-app to Fly.io"
"Run npm install in ~/my-project"
"Check if ~/my-app exists and is valid"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For support, share these files with Claude:
- $LOG_FILE
- $SUMMARY_FILE

Happy deploying! 🚀
EOFSUMMARY

log_success "Installation summary saved to: $SUMMARY_FILE"