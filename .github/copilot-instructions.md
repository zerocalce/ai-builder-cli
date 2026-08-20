# Copilot Instructions for AI Builder CLI

## Build, Test, and Run Commands

### Installation & Development

**Install from source:**
```bash
npm install
npm run build
npm link  # Makes 'ai-builder' available globally
```

**Global installation:**
```bash
npm install -g ai-builder
```

**Run tests:**
```bash
npm test
```

**Build only (no tests):**
```bash
npm run build
```

**Lint (currently no-op):**
```bash
npm run lint
```

### Development Server

**Run CLI in development mode:**
```bash
npm run build && node dist/index.js
```

**Run specific CLI command:**
```bash
npm run build && node dist/index.js init express-api my-api
npm run build && node dist/index.js build
npm run build && node dist/index.js deploy production
```

### CLI Commands (After Installation)

**Project scaffolding:**
```bash
ai-builder init [template] [project-name]
ai-builder init express-api my-api
ai-builder init react-web my-dashboard
```

**Build & Deploy:**
```bash
ai-builder build
ai-builder deploy [environment]
ai-builder deploy production
ai-builder deploy staging
```

**Status & Logs:**
```bash
ai-builder status
ai-builder logs [service-name]
```

**Configuration:**
```bash
ai-builder config set aws.region us-east-1
ai-builder config get aws.region
```

**Template Management:**
```bash
ai-builder templates list
ai-builder templates install custom-template
```

**Chat Interface:**
```bash
ai-builder chat
# Then type natural language commands like:
# "Deploy my-api to production"
# "Create a new React project"
# "What's the status of my deployments?"
```

### Database Operations

**Local SQLite database:**
```bash
# Stored in .ai-builder/ directory
ls -la .ai-builder/
```

**View deployment history:**
```bash
# Accessible via status command
ai-builder status
```

## High-Level Architecture

### System Overview

**AI Builder** is a **developer productivity platform** that automates project lifecycle management through:
1. **Project scaffolding** - Generate new projects from templates
2. **Intelligent builds** - Automated dependency management and compilation
3. **Multi-platform deployment** - Deploy to Docker, AWS, Azure, GCP, local servers
4. **AI chat assistant** - Natural language interface for project commands
5. **Configuration management** - Centralized encrypted config storage
6. **Deployment tracking** - History, health checks, alerts, rollbacks

Think of it as a CLI tool + database that remembers your projects and deployments, with an AI layer that understands natural language commands.

### Architecture Diagram

```
┌─────────────────────────────────────┐
│     User Interface                  │
├─────────────────────────────────────┤
│ • CLI Commands (direct)             │
│ • Chat Interface (natural language) │
│ • Config Management                 │
└────────────────────┬────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│     AI Builder Core Engine                  │
├─────────────────────────────────────────────┤
│ src/
│ ├── index.ts (CLI entry point)              │
│ ├── cli/ (command parser)                   │
│ ├── commands/ (init, build, deploy, etc)    │
│ ├── core/ (business logic)                  │
│ ├── integrations/ (cloud providers)         │
│ ├── monitoring/ (health, alerts)            │
│ └── utils/ (helpers)                        │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│     Backend Systems                         │
├─────────────────────────────────────────────┤
│ • Template Manager (load/install templates) │
│ • SQLite Database (.ai-builder/)            │
│ • Build System (npm/yarn/custom)            │
│ • Deployment Orchestrator                   │
│ • Health Monitor & Alerts                   │
│ • Configuration Manager (encrypted)         │
│ • Plugin System (extensible hooks)          │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│     Cloud & Local Infrastructure            │
├─────────────────────────────────────────────┤
│ • AWS (ECS, Lambda, S3)                     │
│ • Azure (App Service, Container Registry)   │
│ • GCP (Cloud Run, Cloud Storage)            │
│ • Docker (local containers)                 │
│ • Custom Servers (SSH/REST API)             │
│ • OpenShift & RHODS (Kubernetes)            │
└─────────────────────────────────────────────┘
```

### Core Modules

**Location:** `src/`

1. **index.ts** (entry point)
   - Parses command-line arguments
   - Routes to appropriate command handler
   - Handles global options and flags

2. **cli/** - Command line interface
   - Parses user input
   - Validates arguments
   - Formats output (colors, progress bars)

3. **commands/** - Command implementations
   - `init.ts` - Project scaffolding from templates
   - `build.ts` - Compile and bundle project
   - `deploy.ts` - Deploy to target environment
   - `status.ts` - Show deployment status
   - `logs.ts` - Stream application logs
   - `rollback.ts` - Revert to previous deployment
   - `config.ts` - Manage configuration
   - `chat.ts` - Chat interface entry point
   - `templates.ts` - List/install templates

4. **core/** - Business logic
   - Project lifecycle management
   - Deployment orchestration
   - State tracking (database queries)
   - Build coordination

5. **integrations/** - Cloud provider connectors
   - `aws_integration.ts` - AWS deployment
   - `azure_integration.ts` - Azure deployment
   - `gcp_integration.ts` - GCP deployment
   - `docker_integration.ts` - Docker/local
   - `openshift_integration.ts` - OpenShift
   - `rhods_integration.ts` - RHODS (Kubernetes)
   - Custom server support (SSH/REST)

6. **monitoring/** - Health & alerts
   - Health checks (port connectivity, API responses)
   - Alert triggers (on failure, on slow performance)
   - Metrics collection (deployment time, success rate)
   - Dashboard data aggregation

7. **types/** - TypeScript interfaces
   - Project configuration schema
   - Deployment metadata
   - Build results
   - Alert definitions
   - Cloud provider credentials

8. **utils/** - Helper functions
   - File system operations
   - Network utilities
   - Credential management
   - Environment variable handling

### Data Model

```
Project
├── name: string
├── template: string
├── base_path: string
├── config: {
│   • aws.region
│   • docker.registry
│   • environment variables
│   • custom settings
│   }
├── build_info: {
│   • build_command
│   • output_directory
│   • dependencies_locked
│   }
└── deployments: Deployment[] (SQLite)
    ├── deployment_id
    ├── environment (prod/staging/dev)
    ├── target (AWS/Azure/GCP/Docker/Custom)
    ├── timestamp
    ├── status (success/failed/rolling_back)
    ├── logs_path
    └── rollback_info
```

### Deployment Lifecycle

```
ai-builder init [template] [name]
    ↓
[Create project directory]
[Copy template files]
[Initialize git]
[Store project config in SQLite]
    ↓
Project Ready
    ↓
ai-builder build
    ↓
[Resolve dependencies]
[Run build command]
[Package artifacts]
    ↓
Artifacts Ready
    ↓
ai-builder deploy [environment]
    ↓
[Select deployment target from config]
    ↓
[Based on target type]:
• AWS: Package as container, push to ECR, deploy via ECS
• Azure: Build with App Service, deploy code
• GCP: Build, push to Container Registry, deploy to Cloud Run
• Docker: Build image, run locally
• Custom: SSH/REST API to remote server
    ↓
[Monitor health]
[Collect logs]
[Store deployment record in SQLite]
    ↓
Deployment Complete
```

### Configuration Storage

**Encrypted configuration:** Uses `.ai-builder/config.json`
- API keys (AWS, Azure, GCP)
- Deployment targets
- Custom environment variables
- Encryption key stored securely (OS keyring if available, fallback to file)

**Deployment history:** SQLite database at `.ai-builder/deployments/`
- Timestamped JSON files for each deployment
- Includes build artifacts, logs, error details
- Enables rollback and audit trail

## Key Conventions

### TypeScript Code Style

**File Structure:**
```typescript
// 1. Imports (grouped)
import fs from 'fs';
import path from 'path';
import { CloudProvider } from './types';

// 2. Type definitions
interface DeployOptions {
  environment: string;
  target: CloudProvider;
  rollback?: boolean;
}

// 3. Main class/function
export class DeploymentOrchestrator {
  // Properties
  private projectName: string;
  
  // Constructor
  constructor(projectName: string) {
    this.projectName = projectName;
  }
  
  // Methods (public first, then private)
  public async deploy(options: DeployOptions): Promise<void> {
    // Implementation
  }
  
  private async validateConfig(): Promise<boolean> {
    // Implementation
  }
}
```

**Async/Await Patterns:**
- All async operations use async/await (no .then() chains)
- Error handling with try/catch
- Timeouts for cloud API calls (30s default)

```typescript
async deploy(options: DeployOptions) {
  try {
    await this.validateConfig();
    await this.buildArtifacts();
    await this.publishToCloud();
  } catch (error) {
    console.error(`Deployment failed: ${error.message}`);
    throw error;
  }
}
```

### Command Implementation Pattern

Every command follows this structure:

```typescript
// commands/my-command.ts
import { CLIContext } from '../types';

export async function handleMyCommand(context: CLIContext, args: string[]): Promise<void> {
  // 1. Parse arguments
  const options = parseArgs(args);
  
  // 2. Validate input
  if (!options.required_param) {
    throw new Error('Missing required parameter: required_param');
  }
  
  // 3. Load project context
  const project = await loadProjectConfig(options.project_path);
  
  // 4. Execute business logic
  const result = await executeLogic(project, options);
  
  // 5. Store results (database, files)
  await storeResults(result);
  
  // 6. Provide user feedback
  console.log('✓ Command completed successfully');
}
```

### Error Handling

```typescript
class CLIError extends Error {
  constructor(
    public message: string,
    public code: string,
    public suggestion?: string
  ) {
    super(message);
  }
}

// Usage:
throw new CLIError(
  'Deployment failed',
  'DEPLOY_ERROR_001',
  'Check AWS credentials: ai-builder config get aws.access_key'
);
```

### Integration Patterns

Each cloud provider integration follows standard interface:

```typescript
interface CloudProviderIntegration {
  validateCredentials(): Promise<boolean>;
  buildArtifacts(config: ProjectConfig): Promise<string>; // returns artifact path
  deploy(artifact: string, config: ProjectConfig): Promise<DeploymentResult>;
  getStatus(deploymentId: string): Promise<DeploymentStatus>;
  rollback(deploymentId: string): Promise<void>;
}
```

### Template System

Templates are directories with:
```
template/
├── package.json (for Node.js projects)
├── Dockerfile (for container deployments)
├── .env.example (environment variables)
├── src/ (source code)
└── ai-builder.json (template metadata)
```

When initializing project:
1. Copy template to new directory
2. Replace placeholders (project name, etc.)
3. Run setup commands (npm install, git init)
4. Store template reference in SQLite

### Database Schema (SQLite)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template TEXT,
  base_path TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  environment TEXT,
  target TEXT,
  status TEXT,
  logs_path TEXT,
  created_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE configs (
  project_id TEXT,
  key TEXT,
  value TEXT (encrypted),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### Testing Conventions

```typescript
// tests/commands/deploy.test.ts
import { handleDeployCommand } from '../../src/commands/deploy';
import { createMockContext } from '../fixtures';

describe('Deploy Command', () => {
  test('deploys successfully to AWS', async () => {
    const context = createMockContext();
    await handleDeployCommand(context, ['--environment', 'production']);
    
    expect(context.database.deployments).toHaveLength(1);
    expect(context.database.deployments[0].status).toBe('success');
  });
  
  test('fails with missing credentials', async () => {
    const context = createMockContext({ credentials: {} });
    
    await expect(
      handleDeployCommand(context, ['--environment', 'production'])
    ).rejects.toThrow('Missing AWS credentials');
  });
});
```

**Test structure:**
- Unit tests for individual functions
- Integration tests for full command flows
- Mock cloud providers for CI/CD
- Use faker for test data generation

## Common Development Tasks

### Adding a New Cloud Provider

1. Create `src/integrations/new_provider_integration.ts`
2. Implement `CloudProviderIntegration` interface
3. Add to provider registry in `src/core/deployment.ts`
4. Create integration tests in `tests/integrations/`
5. Update documentation in `README.md`

### Adding a New Command

1. Create `src/commands/my-new-command.ts`
2. Implement command handler following standard pattern
3. Register in `src/index.ts` CLI router
4. Add tests in `tests/commands/`
5. Update help text

### Debugging Deployments

**Enable verbose logging:**
```bash
AI_BUILDER_DEBUG=true ai-builder deploy --verbose
```

**Check deployment logs:**
```bash
ai-builder logs deployment-id
```

**View database records:**
```bash
# Inspect SQLite database directly
sqlite3 .ai-builder/deployments.db "SELECT * FROM deployments;"
```

**Validate configuration:**
```bash
ai-builder config get --all
```

### Performance Optimization

**Current bottlenecks:**
1. Docker image builds (can be 10+ minutes for large projects)
2. Cloud provider API calls (network latency)
3. Dependency resolution (npm install can be slow)

**Optimization strategies:**
- Cache Docker layers between builds
- Parallelize independent deployment steps
- Use lock files (package-lock.json, poetry.lock)
- Implement concurrent deployments to multiple regions

### Extending with Plugins

Plugins can hook into:
- `before:build` - Run before build starts
- `after:build` - Run after successful build
- `before:deploy` - Pre-deployment validation
- `after:deploy` - Post-deployment setup
- `on:error` - Error handlers

Plugin registration in `ai-builder.json`:
```json
{
  "plugins": [
    {
      "name": "custom-plugin",
      "hooks": ["before:build", "after:deploy"]
    }
  ]
}
```

## Production Deployment

**Before going live with ai-builder:**

1. Test all cloud provider integrations with real credentials
2. Implement comprehensive error recovery (retries, rollback)
3. Set up monitoring and alerting
4. Document all configuration options
5. Create backup strategy for SQLite database
6. Implement rate limiting for API calls
7. Add authentication/authorization for multi-user environments

**Scaling considerations:**

- SQLite can handle moderate deployments; consider Postgres for enterprise
- Implement queue system for concurrent deployments
- Add caching for frequently accessed configs
- Monitor disk space (logs and artifacts accumulate)
- Consider artifact cleanup policies (age-based retention)

**Security best practices:**

- Encrypt sensitive config at rest (use OS keyring)
- Use environment variables for cloud provider credentials
- Never commit .ai-builder/ directory (add to .gitignore)
- Implement audit logging for all deployments
- Use temporary credentials when possible (assume roles)
- Validate all user input before passing to cloud APIs
