# AI Builder Platform

A comprehensive AI-powered development platform with built-in database management, CLI auto-deployment, and intelligent chat interface.

## 🚀 Features

### Core Capabilities
- **Project Scaffolding**: Create projects from customizable templates
- **Automated Builds**: Intelligent build system with dependency management
- **Multi-Platform Deployment**: Deploy to local, Docker, AWS, Azure, GCP, and custom servers
- **Real-time Monitoring**: Health checks, alerts, and deployment tracking
- **Database Integration**: Built-in SQLite with migration and backup support
- **AI Chat Assistant**: Natural language project management via chat interface
- **Configuration Management**: Secure, encrypted configuration storage
- **Plugin System**: Extensible architecture with custom hooks

### CLI Commands
```bash
# Initialize new project
ai-builder init express-api my-api

# Build project
ai-builder build

# Deploy to target environment
ai-builder deploy production

# Check deployment status
ai-builder status

# View logs
ai-builder logs

# Rollback deployment
ai-builder rollback v1.0.0

# Manage configuration
ai-builder config set aws.region us-east-1
ai-builder config get aws.region

# List and manage templates
ai-builder templates list
ai-builder templates install custom-template
```

### Chat Interface
```bash
# Start chat interface
ai-builder chat

# Natural language commands
"Deploy my-api to production"
"What's the status of the web-app deployment?"
"Create a new React project called dashboard"
"Rollback the latest deployment if it failed"
```

## 📋 Requirements

- Node.js 18+ 
- npm 8+
- Git
- Docker (for container deployments)
- Cloud provider credentials (for cloud deployments)

## 🛠️ Installation

### From Source
```bash
git clone https://github.com/your-org/ai-builder.git
cd ai-builder
npm install
npm run build
npm link
```

### Global Installation
```bash
npm install -g ai-builder
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Interface Layer                      │
├─────────────────────────────────────────────────────────────┤
│  Command Parser  │  Interactive UI  │  Progress Display    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Core Service Layer                        │
├─────────────────────────────────────────────────────────────┤
│ Project Manager │ Deployment Engine │ Config Manager        │
│ Template Engine │ Health Monitor    │ Log Collector         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Integration Layer                          │
├─────────────────────────────────────────────────────────────┤
│ Cloud APIs     │ Database Layer    │ Container Runtime     │
│ CI/CD Systems  │ SSH Clients       │ Monitoring Services   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
ai-builder/
├── src/
│   ├── cli/                 # CLI interface and commands
│   ├── core/               # Core business logic
│   ├── integrations/       # Database and chat integrations
│   ├── monitoring/         # Deployment monitoring
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── templates/              # Project templates
├── tests/                  # Test suite
├── docs/                   # Documentation
└── examples/               # Usage examples
```

## 🚀 Quick Start

### 1. Initialize a New Project
```bash
ai-builder init express-api my-api
cd my-api
```

### 2. Configure Deployment Targets
```bash
# Edit .ai-builder/project.json
ai-builder config set deploy.targets.local.type local
ai-builder config set deploy.targets.aws.type aws
```

### 3. Build and Deploy
```bash
ai-builder build
ai-builder deploy local
```

### 4. Monitor Deployment
```bash
ai-builder status --deployments
ai-builder logs my-api
```

## 📊 Available Templates

### Backend Templates
- **express-api**: Express.js REST API with TypeScript
- **fastapi**: Python FastAPI with async support
- **nestjs**: NestJS framework with microservices
- **serverless**: AWS Lambda serverless functions

### Frontend Templates
- **react-app**: React with Vite and TypeScript
- **vue-app**: Vue 3 with Composition API
- **angular-app**: Angular with standalone components
- **nextjs-app**: Next.js with App Router

### Full-Stack Templates
- **fullstack-ai**: AI application with database integration
- **microservices**: Multi-service architecture
- **jamstack**: Static site with serverless functions

### Database Templates
- **sqlite-app**: SQLite with migrations
- **postgresql-app**: PostgreSQL with Prisma
- **mongodb-app**: MongoDB with Mongoose

## 🔧 Configuration

### Global Configuration
```json
{
  "cli": {
    "default_region": "us-east-1",
    "auto_confirm": false,
    "verbose": false
  },
  "build": {
    "parallel": true,
    "timeout": 300000
  },
  "deploy": {
    "health_check_enabled": true,
    "auto_rollback": false,
    "max_retries": 3
  }
}
```

### Project Configuration
```json
{
  "name": "my-api",
  "template": "express-api",
  "version": "1.0.0",
  "build": {
    "command": "npm run build",
    "outputDir": "dist",
    "environment": {
      "NODE_ENV": "production"
    }
  },
  "deploy": {
    "targets": [
      {
        "name": "production",
        "type": "aws",
        "config": {
          "region": "us-east-1",
          "service": "lambda"
        }
      }
    ]
  }
}
```

## 🌐 Deployment Targets

### Local Deployment
```bash
ai-builder deploy local
```
- Runs on local machine
- Uses Docker containers
- Automatic port management

### Docker Deployment
```bash
ai-builder deploy docker
```
- Builds Docker images
- Manages container lifecycle
- Supports docker-compose

### AWS Deployment
```bash
ai-builder deploy aws
```
- Lambda functions
- ECS containers
- API Gateway integration

### Custom SSH Deployment
```bash
ai-builder deploy production
```
- SSH server deployment
- Custom scripts
- Health checks

## 📈 Monitoring & Logging

### Health Checks
- Automatic endpoint monitoring
- Response time tracking
- Error rate monitoring
- System metrics collection

### Alerts
- Email notifications
- Slack integration
- Webhook callbacks
- Custom alert rules

### Logging
- Structured JSON logs
- Log aggregation
- Real-time streaming
- Log retention policies

## 🤖 AI Chat Interface

### Natural Language Commands
```bash
# Start chat
ai-builder chat

# Examples
"Deploy my-api to production and notify me when done"
"Check if the web-app is healthy"
"Create a new React project with TypeScript"
"Rollback the last deployment if error rate > 5%"
"List all projects and their deployment status"
```

### Chat Features
- Context-aware responses
- Action confirmation
- Progress updates
- Error handling
- Multi-user sessions

## 🔌 Plugin System

### Creating Plugins
```typescript
import { Plugin, PluginHooks } from 'ai-builder';

export class CustomPlugin implements Plugin {
  name = 'custom-plugin';
  version = '1.0.0';
  description = 'Custom deployment plugin';
  
  hooks: PluginHooks = {
    async beforeBuild(project) {
      console.log(`Building ${project.name}...`);
    },
    
    async afterDeploy(deployment) {
      await this.notifyTeam(deployment);
    }
  };
  
  async notifyTeam(deployment: Deployment) {
    // Custom notification logic
  }
}
```

### Plugin Hooks
- `beforeBuild`: Before project build
- `afterBuild`: After successful build
- `beforeDeploy`: Before deployment
- `afterDeploy`: After successful deployment
- `beforeRollback`: Before rollback
- `afterRollback`: After rollback

## 🗄️ Database Integration

### Supported Databases
- SQLite (built-in)
- PostgreSQL
- MySQL
- MongoDB

### Migration Management
```bash
# Create migration
ai-builder db migration create add_users_table

# Run migrations
ai-builder db migrate

# Rollback migration
ai-builder db rollback
```

### Database Operations
```bash
# Seed database
ai-builder db seed production-data.json

# Create backup
ai-builder db backup

# Restore backup
ai-builder db restore backup_2023-01-01.sql
```

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

### Test Structure
```
tests/
├── unit/                  # Unit tests
├── integration/           # Integration tests
├── e2e/                  # End-to-end tests
└── fixtures/              # Test data
```

## 📚 Examples

### Basic API Deployment
```bash
# Create Express API
ai-builder init express-api user-service

# Add environment variables
ai-builder config set env.DB_URL postgresql://localhost/db

# Build and deploy
ai-builder build
ai-builder deploy production

# Monitor
ai-builder status user-service
```

### Full-Stack Application
```bash
# Create full-stack app
ai-builder init fullstack-ai my-app

# Configure database
ai-builder db migrate
ai-builder db seed

# Deploy frontend and backend
ai-builder deploy frontend --target netlify
ai-builder deploy backend --target aws

# Setup monitoring
ai-builder monitor enable my-app
```

### CI/CD Integration
```yaml
# .github/workflows/deploy.yml
name: Deploy
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install -g ai-builder
      - run: ai-builder build
      - run: ai-builder deploy production
```

## 🔧 Advanced Configuration

### Custom Templates
```bash
# Create template
ai-builder templates create my-template

# Template structure
templates/my-template/
├── template.json          # Template configuration
├── files/                 # Template files
│   ├── src/
│   ├── package.json.hbs   # Handlebars template
│   └── README.md.hbs
└── scripts/               # Template scripts
```

### Custom Cloud Providers
```typescript
import { CloudProvider } from 'ai-builder';

export class CustomProvider implements CloudProvider {
  name = 'custom';
  type = 'custom';
  
  async deploy(config) {
    // Custom deployment logic
  }
  
  async getStatus(deploymentId) {
    // Status check logic
  }
  
  async rollback(deploymentId, version) {
    // Rollback logic
  }
}
```

## 🐛 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build logs
ai-builder build --verbose

# Validate project
ai-builder validate

# Clear cache
ai-builder clean
```

#### Deployment Issues
```bash
# Check deployment status
ai-builder status --deployments

# View deployment logs
ai-builder logs <deployment-id>

# Test connection
ai-builder test-connection <target>
```

#### Configuration Issues
```bash
# Validate configuration
ai-builder config validate

# Reset configuration
ai-builder config reset

# Export configuration
ai-builder config export
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=ai-builder:* ai-builder deploy production

# Verbose output
ai-builder --verbose deploy production
```

## 📖 API Reference

### CLI Commands
- `ai-builder init` - Initialize new project
- `ai-builder build` - Build project
- `ai-builder deploy` - Deploy project
- `ai-builder status` - Show status
- `ai-builder logs` - View logs
- `ai-builder rollback` - Rollback deployment
- `ai-builder config` - Manage configuration
- `ai-builder templates` - Manage templates

### Configuration Options
See [Configuration Documentation](docs/configuration.md)

### Plugin API
See [Plugin Development Guide](docs/plugins.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

### Development Setup
```bash
git clone https://github.com/your-org/ai-builder.git
cd ai-builder
npm install
npm run dev
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 Support

- 📖 [Documentation](https://ai-builder.dev/docs)
- 💬 [Discord Community](https://discord.gg/ai-builder)
- 🐛 [Issue Tracker](https://github.com/your-org/ai-builder/issues)
- 📧 [Email Support](mailto:support@ai-builder.dev)

## 🗺️ Roadmap

### Version 1.1
- [ ] Kubernetes deployment support
- [ ] Advanced monitoring dashboard
- [ ] Multi-region deployments
- [ ] Template marketplace

### Version 1.2
- [ ] GraphQL API integration
- [ ] Performance profiling
- [ ] Cost optimization
- [ ] Team collaboration features

### Version 2.0
- [ ] Visual project editor
- [ ] AI-powered optimization
- [ ] Advanced security features
- [ ] Enterprise SSO integration
