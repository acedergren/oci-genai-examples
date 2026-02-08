# OCI GenAI Examples - Project Context

This repository contains examples and integrations for Oracle Cloud Infrastructure (OCI) Generative AI services.

## 🚀 Live Deployments

### Langflow on OCI (flow.solutionsedge.io)

**Status**: ✅ Deployed and Healthy
**Deployment Date**: February 4, 2026

**Infrastructure**:

- **Instance**: app01 (OCI Compute, eu-frankfurt-1)
- **Container**: Langflow with OCI GenAI custom components
- **Access**: https://flow.solutionsedge.io (via Cloudflare Tunnel)
- **Database**: Oracle Autonomous Database 26AI (langflowdb_high)
  - Vector search with VECTOR(1536, FLOAT32) support
  - Connection via wallet mounted at `/wallets/langflow`
- **Local SQLite**: `/app/data/langflow.db` for Langflow internal data

**Custom Components**:

- `/app/custom_components/embeddings/` - OCI Generative AI embeddings
- `/app/custom_components/models/` - OCI Generative AI chat models
- `/app/custom_components/vectorstores/` - Oracle 26AI vector store

**Container Configuration**:

- Image: `docker-langflow` (5.2GB, 609 Python packages)
- Port: 7860 (HTTP)
- Resources: 4GB memory, 1.0 CPU
- User: langflow (UID 1000, non-root)
- Health: Checked via `http://localhost:7860/health`

**Environment Variables**:

```bash
OCI_REGION=eu-frankfurt-1
ORACLE_CONNECT_STRING=langflowdb_high
ORACLE_CONFIG_DIR=/wallets/langflow
TNS_ADMIN=/wallets/langflow
LANGFLOW_COMPONENTS_PATH=/app/custom_components
LANGFLOW_DATABASE_URL=sqlite:////app/data/langflow.db
LANGFLOW_CONFIG_DIR=/app/data
LANGFLOW_ALEMBIC_LOG_TO_STDOUT=true
LANGFLOW_HOST=0.0.0.0
LANGFLOW_PORT=7860
LANGFLOW_LOG_LEVEL=info
```

**Secrets (OCI Vault)**:

- Oracle Database password: `oracle-admin-password`
- Oracle Wallet password: `oracle-wallet-password`
- Vault OCID: `ocid1.vault.oc1.eu-frankfurt-1.bfpizfqyaacmg...`

**Cloudflare Tunnel**:

- Tunnel Name: `app01-frankfurt`
- Tunnel ID: `33f72c7d-5b51-4a93-81a8-9c4ecac11334`
- Route: `flow.solutionsedge.io` → `http://localhost:7860`
- Status: ✅ Route configured, tunnel healthy (12 connections)
- Account ID: `3765378dd6901370e6dd...`

**Cloudflare API Tokens (OCI Vault)**:

- **Tunnel Management**: `cloudflare-edit-all-tunnels`
  - Use for: Creating/updating tunnel routes and configurations
  - Permissions: Cloudflare Tunnel:Edit
  - Account access: Primary account

- **Zone Management**: `running-days-cloudflare-api-token`
  - Use for: Reading zone information (solutionsedge.io, running-days.com)
  - Permissions: Zone:Read
  - Zone ID for solutionsedge.io: `31a5e648b4666e0fc9b28ff2071febe9`

- **Analytics (Read-Only)**: `solutionsedge-cloudflare-analytics-token`
  - Use for: Reading zone and analytics data
  - Permissions: Analytics:Read, Zone:Read

- **Global API Key**: `cloudflare-global-api-key`
  - Use for: Creating new API tokens via Cloudflare API
  - Requires: Email address (not stored in vault - needs to be provided)
  - Note: Use with X-Auth-Email and X-Auth-Key headers

**DNS Management**:
To create/modify DNS records for solutionsedge.io:

1. Use Cloudflare Dashboard (fastest method)
2. OR create a new API token with Zone.DNS:Edit permissions
3. OR use global API key with associated email address

**Manual DNS Setup Required**:

```
Type: CNAME
Name: flow
Content: 33f72c7d-5b51-4a93-81a8-9c4ecac11334.cfargotunnel.com
Proxied: Yes (orange cloud)
Comment: Langflow with OCI GenAI - Oracle 26AI vector search
```

**Monitoring**:

- Grafana Dashboard: Available (13 panels - see `/infrastructure/monitoring/grafana-dashboard-langflow.json`)
- Metrics: Container health, CPU, memory, network, disk I/O, request rate
- Logs: Via Loki integration

## 📁 Repository Structure

```
oci-genai-examples/
├── oci-genai-provider/          # AI SDK provider for OCI Generative AI
│   ├── src/
│   │   ├── language-models/     # Chat completion models
│   │   ├── embedding-models/    # Text embedding models
│   │   ├── transcription-models/# Speech-to-text models
│   │   └── speech-models/       # Text-to-speech models
│   └── tests/
│
├── oci-ai-chat/                 # Self-service portal (monorepo)
│   ├── apps/
│   │   ├── frontend/          # SvelteKit UI (adapter-node)
│   │   │   └── src/
│   │   │       ├── lib/
│   │   │       │   ├── tools/           # 60+ OCI CLI tool wrappers for AI SDK
│   │   │       │   ├── server/
│   │   │       │   │   ├── oracle/      # Connection pool, migrations, repositories
│   │   │       │   │   ├── auth/        # Better Auth, OIDC, RBAC, auth-factory
│   │   │       │   │   ├── admin/       # Admin console repositories + crypto
│   │   │       │   │   ├── workflows/   # Visual workflow executor + repository
│   │   │       │   │   └── mcp/         # MCP portal server
│   │   │       │   └── components/      # 17 portal + workflow designer components
│   │   │       └── routes/
│   │   │           ├── api/             # SvelteKit API routes (chat, sessions, tools, v1, webhooks, admin, setup, workflows)
│   │   │           ├── admin/           # Admin console UI (IDP, AI Models, Settings)
│   │   │           └── workflows/       # Workflow designer pages
│   │   └── api/               # Fastify 5 backend (Phase 9 migration)
│   │       └── src/
│   │           ├── plugins/    # oracle, session, rbac, cors, helmet, rate-limit, error-handler, request-logger
│   │           ├── routes/     # health, sessions, activity, tools/execute, tools/approve
│   │           ├── services/   # approvals, tools adapter
│   │           └── config.ts   # Centralized env config with validation
│   └── packages/
│       └── shared/             # Shared types (PortalError hierarchy, RBAC, API types)
│           └── src/
│               ├── errors.ts   # PortalError, ValidationError, AuthError, etc.
│               └── rbac.ts     # Roles, permissions, type guards
│
├── kyc-intelligence/            # KYC platform with vector embeddings
│   ├── src/
│   ├── data/                    # Customer data and embeddings
│   └── scripts/
│
├── kyc-platform/                # Base KYC platform infrastructure
│
└── langflow/                    # Langflow custom components (DEPLOYED)
    ├── custom_components/
    │   ├── embeddings/          # OCI GenAI embedding components
    │   ├── models/              # OCI GenAI chat model components
    │   └── vectorstores/        # Oracle 26AI vector store
    ├── infrastructure/
    │   ├── docker/
    │   │   ├── Dockerfile.langflow
    │   │   └── docker-compose.langflow.yml
    │   ├── monitoring/
    │   │   ├── grafana-dashboard-langflow.json
    │   │   └── README.md
    │   └── cloudflare/
    │       ├── tunnel-config.yml
    │       └── README.md
    ├── scripts/
    │   ├── deploy-to-app01.sh
    │   ├── verify-prerequisites.sh
    │   └── store-secrets.sh
    └── docs/
        └── DEPLOYMENT.md
```

## 🏗️ Infrastructure & Key Management

### OCI Resources

**Compartment**:

- OCID: `ocid1.compartment.oc1..aaaaaaaarekfofhmfup6d33agbnicuop2waas3ssdwdc7qjgencirdgvl3iq`
- Name: Main development compartment
- Region: eu-frankfurt-1

**Compute Instance (app01)**:

- OCID: `ocid1.instance.oc1.eu-frankfurt-1.antheljthhxc6pyc3erceplnzvmloeu6gty5gnxni7iuycqgljoarv7bcxea`
- Private IP: `10.0.3.113`
- OS User: `ubuntu`
- Access: Via OCI Bastion session

**OCI Bastion**:

- OCID: `ocid1.bastion.oc1.eu-frankfurt-1.amaaaaaahhxc6pyau5chxhy6lqlj6zgh5nec7h56ddpiwutjwkfxefw4c5rq`
- Name: `gha-bastion`
- Session TTL: 10800 seconds (3 hours)
- SSH Key: `~/.ssh/bastion_app01` (ed25519)

**Oracle Autonomous Database**:

- Service Name: `langflowdb_high`
- Database Type: Oracle 26AI with vector search
- Features: VECTOR(1536, FLOAT32) support
- Wallet Location: `/data/wallets/langflow` (on app01)

**OCI Vault**:

- OCID: `ocid1.vault.oc1.eu-frankfurt-1.bfpizfqyaacmg.abtheljtdamq6fycneeey5q4sfeoek6esnjvvkmno6obhv4pmwn4vzjcuprq`
- Region: eu-frankfurt-1
- Usage: Centralized secret storage for all credentials

### Secret Management

All secrets are stored in OCI Vault and retrieved programmatically. **Never hardcode credentials.**

**OCI Secrets (Vault)**:

| Secret Name                         | Purpose                | Usage               | OCID                                                                                                |
| ----------------------------------- | ---------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `oracle-admin-password`             | Oracle DB password     | Database connection | `ocid1.vaultsecret...`                                                                              |
| `oracle-wallet-password`            | Oracle wallet password | Wallet decryption   | `ocid1.vaultsecret...`                                                                              |
| `cloudflare-edit-all-tunnels`       | Cloudflare API token   | Tunnel management   | `ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pya7wekuzmasatmllrwcrko4pthfuywrxxghbhxop6nyslq` |
| `cloudflare-account-id-v2`          | Cloudflare account ID  | API authentication  | `ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pyasqjslrvk7aq43jvv7p2yft43pub6e5yuf4kearacimva` |
| `running-days-cloudflare-api-token` | Cloudflare zone token  | Zone read access    | `ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pyancuf2xk2v6xyrgjjfwvmho6dcemy6tvwmjbtvs5etgaa` |
| `cloudflare-global-api-key`         | Cloudflare global key  | Full account access | `ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pyasmvx3ejgbkrn4lmq2pj4rrezfzgsubp3bh6ron2uz2ra` |

**Retrieving Secrets**:

```bash
# Standard pattern for retrieving secrets
# Replace with actual OCID from table above
SECRET_OCID="<secret-ocid-from-table>"
SECRET_VALUE=$(oci secrets secret-bundle get \
  --secret-id "$SECRET_OCID" \
  --query 'data."secret-bundle-content".content' \
  --raw-output | base64 -d)
```

**Creating/Updating Secrets**:

```bash
# Create a new secret
oci vault secret create-base64 \
  --compartment-id "$COMPARTMENT_ID" \
  --vault-id "$VAULT_OCID" \
  --secret-name "my-secret-name" \
  --description "Secret description" \
  --secret-content-content "$(echo -n 'secret-value' | base64)"

# Update existing secret (creates new version)
oci vault secret update-base64 \
  --secret-id "$SECRET_OCID" \
  --secret-content-content "$(echo -n 'new-secret-value' | base64)"
```

### SSH Key Management

**Bastion Session Keys**:

- Location: `~/.ssh/bastion_app01` (private), `~/.ssh/bastion_app01.pub` (public)
- Type: ED25519
- Purpose: OCI Bastion managed SSH sessions
- TTL: Session-based (expires with bastion session)

**Creating Bastion Sessions**:

```bash
SESSION_JSON=$(oci bastion session create-managed-ssh \
  --bastion-id "$BASTION_OCID" \
  --ssh-public-key-file "$HOME/.ssh/bastion_app01.pub" \
  --target-resource-id "$INSTANCE_OCID" \
  --target-os-username "ubuntu" \
  --session-ttl 10800 \
  --display-name "deployment-$(date +%Y%m%d-%H%M%S)")

SESSION_ID=$(echo "$SESSION_JSON" | jq -r '.data.id')

# Connect via bastion
ssh -i ~/.ssh/bastion_app01 \
  -o ProxyCommand="ssh -i ~/.ssh/bastion_app01 -W %h:%p -p 22 ${SESSION_ID}@host.bastion.eu-frankfurt-1.oci.oraclecloud.com" \
  -p 22 ubuntu@10.0.3.113
```

### Infrastructure Access Patterns

**1. Deploying to app01**:

```bash
# Full deployment workflow
cd langflow/scripts
./deploy-to-app01.sh

# Manual deployment steps:
# 1. Create bastion session
# 2. Transfer files via SCP
# 3. Fetch secrets from vault
# 4. Build Docker image
# 5. Start container
# 6. Verify health
```

**2. Accessing Running Container**:

```bash
# Via bastion session
ssh -i ~/.ssh/bastion_app01 \
  -o ProxyCommand="ssh -i ~/.ssh/bastion_app01 -W %h:%p ${SESSION_ID}@host.bastion.eu-frankfurt-1.oci.oraclecloud.com" \
  ubuntu@10.0.3.113 "sudo docker exec -it langflow bash"
```

**3. Managing Cloudflare**:

```bash
# Retrieve credentials from vault
TUNNEL_TOKEN=$(oci secrets secret-bundle get \
  --secret-id "ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pya7wekuzmasatmllrwcrko4pthfuywrxxghbhxop6nyslq" \
  --query 'data."secret-bundle-content".content' \
  --raw-output | base64 -d)

ACCOUNT_ID=$(oci secrets secret-bundle get \
  --secret-id "ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pyasqjslrvk7aq43jvv7p2yft43pub6e5yuf4kearacimva" \
  --query 'data."secret-bundle-content".content' \
  --raw-output | base64 -d)

# Update tunnel configuration
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/33f72c7d-5b51-4a93-81a8-9c4ecac11334/configurations" \
  -H "Authorization: Bearer ${TUNNEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @new-config.json
```

### Environment Configuration

**Docker Compose Environment** (`/tmp/langflow.env` on app01):

```bash
# OCI Configuration
OCI_REGION=eu-frankfurt-1
OCI_COMPARTMENT_OCID=ocid1.compartment.oc1..aaaaaaaarekfofhmfup6d33agbnicuop2waas3ssdwdc7qjgencirdgvl3iq

# Oracle Database Configuration (passwords from vault)
ORACLE_USER=ADMIN
ORACLE_PASSWORD=${ORACLE_PASSWORD}  # From vault
ORACLE_DSN=langflowdb
ORACLE_WALLET_LOCATION=/wallets/langflow
ORACLE_WALLET_PASSWORD=${ORACLE_WALLET_PASSWORD}  # From vault

# Langflow Configuration
LANGFLOW_AUTO_LOGIN=false
LANGFLOW_SUPERUSER=admin
LANGFLOW_WORKERS=1
```

### Backup & Recovery

**Database Backups**:

- Oracle Autonomous Database: Automatic backups enabled
- Retention: 60 days
- Manual backup: Via OCI Console or CLI

**Langflow Data Backups**:

```bash
# Backup SQLite database from container
ssh ubuntu@10.0.3.113 "sudo docker exec langflow tar czf - /app/data" > langflow-backup-$(date +%Y%m%d).tar.gz

# Restore backup
scp langflow-backup-20260204.tar.gz ubuntu@10.0.3.113:/tmp/
ssh ubuntu@10.0.3.113 "sudo docker cp /tmp/langflow-backup-20260204.tar.gz langflow:/tmp/ && \
  sudo docker exec langflow tar xzf /tmp/langflow-backup-20260204.tar.gz -C /"
```

**Wallet Backup**:

```bash
# Oracle wallet is stored at /data/wallets/langflow on app01
ssh ubuntu@10.0.3.113 "sudo tar czf - /data/wallets/langflow" > oracle-wallet-backup-$(date +%Y%m%d).tar.gz
```

## 🔐 Security

- All secrets stored in OCI Vault
- Container runs as non-root user (UID 1000)
- Database credentials retrieved at runtime
- Cloudflare Tunnel for zero-trust network access
- No public IP exposure for Langflow service

## 🛠️ Development

### Prerequisites

- OCI CLI configured
- Docker installed
- SSH access to app01 instance via OCI Bastion
- Cloudflare API token for tunnel management

### Deployment

See `/langflow/docs/DEPLOYMENT.md` for complete deployment runbook.

Quick deploy:

```bash
cd langflow/scripts
./deploy-to-app01.sh
```

### Accessing Services

- **Langflow UI**: https://flow.solutionsedge.io
- **Grafana Monitoring**: https://observability.solutionsedge.io
- **Docker Management**: https://docker.solutionsedge.io

## 📊 Monitoring & Operations

### Health Checks

```bash
# Check container health
docker ps --filter name=langflow

# Check Langflow health endpoint
curl http://localhost:7860/health

# View logs
docker logs langflow --tail 100
```

### Grafana Dashboards

Import `/infrastructure/monitoring/grafana-dashboard-langflow.json` to monitor:

- Container status and uptime
- Resource usage (CPU, memory, network, disk)
- Application metrics (request rate, errors)
- Recent logs from Loki

### Troubleshooting

Common issues and solutions documented in `/langflow/docs/DEPLOYMENT.md#troubleshooting`

## 🔄 Future Enhancements

### Pending Tasks

- [ ] Add DNS CNAME record for flow.solutionsedge.io (manual via Cloudflare Dashboard)
  - Type: CNAME, Name: flow, Content: `33f72c7d-5b51-4a93-81a8-9c4ecac11334.cfargotunnel.com`
- [ ] Import Grafana dashboard to observability.solutionsedge.io
- [ ] Test Langflow UI access at https://flow.solutionsedge.io
- [ ] Verify Oracle 26AI vector search integration
- [ ] Set up automated backups for SQLite database
- [ ] Add Prometheus alerts for container health
- [ ] Create Cloudflare API token with DNS edit permissions and store in vault

### Phase 3 (Planned)

- Oracle Database integration testing
- Vector search examples
- Custom component documentation
- API authentication and rate limiting

## 🔧 Cloudflare API Automation

### Retrieving API Tokens from OCI Vault

```bash
# Set vault details (see Infrastructure section for actual OCIDs)
VAULT_OCID="<vault-ocid-from-infrastructure-section>"
COMPARTMENT_ID="<compartment-ocid-from-infrastructure-section>"

# Get tunnel management token (OCID from Secret Management table)
TUNNEL_TOKEN_OCID="<cloudflare-edit-all-tunnels-ocid>"
CLOUDFLARE_TOKEN=$(oci secrets secret-bundle get \
  --secret-id "$TUNNEL_TOKEN_OCID" \
  --query 'data."secret-bundle-content".content' \
  --raw-output | base64 -d)

# Get account ID (OCID from Secret Management table)
ACCOUNT_ID_OCID="<cloudflare-account-id-v2-ocid>"
ACCOUNT_ID=$(oci secrets secret-bundle get \
  --secret-id "$ACCOUNT_ID_OCID" \
  --query 'data."secret-bundle-content".content' \
  --raw-output | base64 -d)
```

### Managing Tunnel Routes

```bash
TUNNEL_ID="33f72c7d-5b51-4a93-81a8-9c4ecac11334"

# Get current tunnel configuration
curl -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.result.config.ingress'

# Update tunnel configuration (add new route)
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @tunnel-config.json

# Check tunnel status
curl -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}" \
  -H "Authorization: Bearer ${CLOUDFLARE_TOKEN}" | jq -r '.result.status'
```

### Reading Zone Information

```bash
# Use running-days token for zone access (OCID from Secret Management table)
ZONE_TOKEN_OCID="<running-days-cloudflare-api-token-ocid>"
ZONE_TOKEN=$(oci secrets secret-bundle get \
  --secret-id "$ZONE_TOKEN_OCID" \
  --query 'data."secret-bundle-content".content' \
  --raw-output | base64 -d)

# Zone ID for solutionsedge.io (from Cloudflare Tunnel section)
ZONE_ID="31a5e648b4666e0fc9b28ff2071febe9"

# List DNS records for solutionsedge.io
curl -X GET \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${ZONE_TOKEN}" | jq -r '.result[] | {name, type, content}'
```

### Token Permission Matrix

| Token Name                                 | Tunnel Config | Zone Read | DNS Edit | Analytics |
| ------------------------------------------ | ------------- | --------- | -------- | --------- |
| `cloudflare-edit-all-tunnels`              | ✅            | ❌        | ❌       | ❌        |
| `running-days-cloudflare-api-token`        | ❌            | ✅        | ❌       | ❌        |
| `solutionsedge-cloudflare-analytics-token` | ❌            | ✅        | ❌       | ✅        |
| `cloudflare-global-api-key`                | ✅            | ✅        | ✅       | ✅        |

**Note**: DNS modifications require either:

- Cloudflare Dashboard access
- Global API key with associated email
- Custom API token with `Zone.DNS:Edit` permission

## 🔍 Serena (Semantic Code Intelligence)

Serena is an MCP server that provides **semantic code analysis** via the TypeScript language server. It understands symbols, types, references, and the structure of the codebase — far beyond text search. Use it to work smarter, not harder.

### When to Use Serena vs Built-in Tools

| Task                                         | Use Serena                     | Use Built-in |
| -------------------------------------------- | ------------------------------ | ------------ |
| Find all callers of a function               | `find_referencing_symbols`     | -            |
| Get class methods without reading whole file | `find_symbol` with `depth: 1`  | -            |
| Replace an entire function body              | `replace_symbol_body`          | -            |
| Insert a new method into a class             | `insert_after_symbol`          | -            |
| Rename a variable across a file              | `replace_content` (regex mode) | -            |
| Quick text search across all files           | -                              | Grep         |
| Read a specific file by path                 | -                              | Read         |
| Find files by glob pattern                   | -                              | Glob         |

### Key Serena Workflows

**1. Understanding a Symbol's Impact (Before Refactoring)**

```
find_symbol("consumeApproval", relative_path="apps/frontend/src/lib/server/approvals.ts", include_body=true)
→ See full function signature and body

find_referencing_symbols("consumeApproval", relative_path="apps/frontend/src/lib/server/approvals.ts")
→ See every file/function that calls it + code snippets around each call
```

This shows the blast radius before changing a function. Critical for our oracle-adapter, rbac, and auth modules where changes ripple.

**2. Exploring a Module's API Surface**

```
get_symbols_overview(relative_path="apps/frontend/src/lib/server/workflows/repository.ts")
→ Lists all exported functions, interfaces, types — without reading 500+ lines

find_symbol("workflowRepository", relative_path="apps/frontend/src/lib/server/workflows/repository.ts", depth=1)
→ Shows all methods: create, getById, getByIdForUser, update, updateForUser, delete, list...
```

Use this to understand what a module offers before importing from it.

**3. Precise Symbol-Level Editing**

```
# Replace entire function (safer than text-matching with Edit tool)
replace_symbol_body("consumeApproval", relative_path="apps/frontend/src/lib/server/approvals.ts", body="...")

# Add a new method after an existing one
insert_after_symbol("getById", relative_path="apps/frontend/src/lib/server/workflows/repository.ts", body="...")

# Add imports before the first symbol
insert_before_symbol("<first_export>", relative_path="...", body="import { X } from '...';\n")
```

**4. Regex-Powered Edits (When Symbol Tools Don't Fit)**

```
# Rename a variable across a file
replace_content(relative_path="...", needle="oldName", repl="newName", mode="literal", allow_multiple_occurrences=true)

# Replace a multi-line block using regex wildcards
replace_content(relative_path="...", needle="function old\\(.*?\\}", repl="function new() { ... }", mode="regex")
```

Regex mode with `.*?` wildcards avoids quoting entire blocks — faster and less error-prone than literal replacement.

**5. Serena Memory (Cross-Session Knowledge)**

```
write_memory(name="auth-patterns", content="Better Auth uses svelteKitHandler...")
list_memories()
read_memory(name="auth-patterns")
```

Store architectural decisions, gotchas, or patterns that should persist across sessions. Useful for complex modules like auth, oracle-adapter, and workflows.

### Serena Tips for This Codebase

- **Name paths use `/`**: `WorkflowExecutor/execute` finds the `execute` method inside `WorkflowExecutor` class
- **Substring matching**: Set `substring_matching: true` to find `WorkflowExecutor/execute*` matching `executeNode`, `executeConditionNode`, etc.
- **Restrict with `relative_path`**: Always pass a directory or file to `find_symbol` to avoid scanning the entire codebase. E.g., `relative_path="src/lib/server/"` for backend-only
- **LSP symbol kinds**: Filter by kind — 5=Class, 6=Method, 12=Function, 13=Variable, 11=Interface. Use `include_kinds` to narrow results
- **`include_body: false` first**: Get the overview, then read specific symbol bodies. Saves tokens.
- **Serena project is `oci-ai-chat`**: If multiple projects are configured, activate with `activate_project("oci-ai-chat")`

### Configuration

Serena config at `oci-ai-chat/.serena/project.yml`:

- Language: TypeScript (language server handles `.ts`, `.svelte`, `.js`)
- Encoding: UTF-8
- Respects `.gitignore`

## 📚 Related Documentation

**Project docs** (in `oci-ai-chat/docs/`):

- [Architecture Overview](oci-ai-chat/docs/ARCHITECTURE.md) — System design, data flow, service layers, deployment
- [Security Model](oci-ai-chat/docs/SECURITY.md) — Auth, RBAC, input validation, IDOR prevention, crypto, audit trail
- [Testing Guide](oci-ai-chat/docs/TESTING.md) — Test stack, patterns, how to run, quality gates
- [Development Roadmap](oci-ai-chat/docs/ROADMAP.md) — Phase planning, status, test counts

**External docs**:

- [OCI Generative AI Documentation](https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm)
- [Oracle Database 26AI Vector Search](https://docs.oracle.com/en/database/oracle/oracle-database/26/index.html)
- [Langflow Documentation](https://docs.langflow.org/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)

## 🤖 Agent Team Requirements

When spawning agent teams (via TeamCreate + Task tool), ALL teammates MUST follow these requirements:

### Skill Usage

- Before starting work, teammates should review the locally available skills list and use any that fit their task
- Common skills: `/semgrep`, `/coderabbit`, `/codeql`, `/security-review`, `/nodejs-backend`, `/tanstack-query`, `/monorepo-management`, `/zod`, `/systematic-debugging`, `/ai-sdk`, `/auth-implementation-patterns`
- If no local skill fits, use `/find-skills` to search for one

### Model Selection by Role

- **Sonnet**: Implementation agents (backend, frontend, mover, scaffolder) — code writing, file operations, git moves
- **Opus**: Architecture and exploration agents (architect, security reviewer, code explorer) — design decisions, codebase analysis
- **Haiku**: Documentation and unit test agents (QA, doc writer) — writing tests, docs, lightweight tasks

### Commit Discipline

- **Commit early and often**: After each logical unit of work (e.g., after deleting a file, after rewriting a module, after fixing tests)
- **Stage specific files**: Never use `git add -A` or `git add .` — always stage specific files by name
- **Commit message format**:

  ```
  git commit -m "$(cat <<'EOF'
  feat(phaseX.Y): <description>

  Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

### Quality Gates (Per Commit)

Before EVERY commit, teammates must run ALL of these and fix any issues:

1. **Lint**: `pnpm lint` in the relevant app directory
2. **Type check**: `svelte-check` (frontend) or `tsc --noEmit` (API/shared)
3. **Semgrep**: Use `/semgrep` skill on changed files for security scanning
4. **CodeRabbit**: Use `/coderabbit` skill for AI code review
5. **CodeQL**: Use `/codeql` skill for security vulnerability detection
6. **Tests**: `pnpm test` or `npx vitest run` for relevant test files
7. **Doc sync** (phase completion): Run `/doc-sync fix` after completing a phase or security sprint — updates ARCHITECTURE.md, SECURITY.md, TESTING.md, ROADMAP.md

### Team Structure

- Teams of 4-6: architect + backend + frontend + QA + security (+ optional EM)
- Architect delivers interfaces/types first, others build on them
- Security specialist reviews previous phases before new implementation begins
- Phase validation: `pnpm lint` + `svelte-check` + `pnpm build` + `vitest run`

## 📏 Naming Conventions & Engineering Standards

These conventions are derived from the actual codebase — follow them for consistency.

### File Naming

| Category           | Convention                       | Example                                         |
| ------------------ | -------------------------------- | ----------------------------------------------- |
| TypeScript modules | `kebab-case.ts`                  | `oracle-adapter.ts`, `error-handler.ts`         |
| Svelte components  | `PascalCase.svelte`              | `SearchBox.svelte`, `AgentWorkflowPanel.svelte` |
| SvelteKit routes   | `+server.ts`, `+page.svelte`     | `routes/api/v1/workflows/+server.ts`            |
| Tests              | `[module].test.ts` (colocated)   | `rbac.test.ts` next to `rbac.ts`                |
| Migrations         | `NNN-name.sql` (zero-padded)     | `006-api-keys.sql`, `009-admin.sql`             |
| Fastify plugins    | `kebab-case.ts` + `fp()` wrapper | `plugins/rate-limit.ts`                         |

### TypeScript Naming

| Category              | Convention                         | Example                                                        |
| --------------------- | ---------------------------------- | -------------------------------------------------------------- |
| Types & interfaces    | `PascalCase`                       | `SessionResponse`, `PortalError`, `ActivityRow`                |
| Classes               | `PascalCase`                       | `WorkflowExecutor`, `ValidationError`                          |
| Functions             | `camelCase`                        | `requireCompartmentId()`, `toPortalError()`                    |
| Scalar constants      | `UPPER_SNAKE_CASE`                 | `MAX_CONCURRENT_CLI`, `MAX_STEPS`                              |
| Zod schemas           | `PascalCaseSchema`                 | `SessionResponseSchema`, `ActivityQuerySchema`                 |
| Schema type inference | `type X = z.infer<typeof XSchema>` | `type SessionResponse = z.infer<typeof SessionResponseSchema>` |
| Object/map constants  | `UPPER_SNAKE_CASE`                 | `PERMISSIONS`, `ROLE_PERMISSIONS`                              |
| Enum/union values     | `lowercase`                        | `'draft' \| 'published' \| 'archived'`                         |
| Permissions           | `resource:action`                  | `'tools:read'`, `'admin:all'`, `'workflows:execute'`           |
| Error codes           | `UPPER_SNAKE_CASE`                 | `VALIDATION_ERROR`, `AUTH_ERROR`, `OCI_ERROR`                  |
| Fastify plugins       | `camelCasePlugin`                  | `errorHandlerPlugin`, `oraclePlugin`                           |

### Database Naming (Oracle)

| Category           | Convention                    | Example                                             |
| ------------------ | ----------------------------- | --------------------------------------------------- |
| Tables             | `snake_case` (plural)         | `chat_sessions`, `workflow_definitions`, `api_keys` |
| Columns            | `snake_case`                  | `created_at`, `org_id`, `token_hash`, `duration_ms` |
| Primary keys       | `id UUID`                     | `id UUID PRIMARY KEY`                               |
| Foreign keys       | `[table]_id`                  | `user_id`, `org_id`, `session_id`                   |
| Timestamps         | `TIMESTAMP(6) WITH TIME ZONE` | `created_at`, `updated_at`, `expires_at`            |
| Check constraints  | `chk_[table]_[purpose]`       | `chk_exec_args`, `chk_approval_level`               |
| Unique constraints | `uq_[table]_[fields]`         | `uq_api_key_hash`, `uq_org_oidc_issuer_subject`     |
| Indexes            | `idx_[table]_[purpose]`       | `idx_chat_sessions_user`, `idx_workflow_runs_org`   |
| Hashes             | `VARCHAR2(64)`                | SHA-256 hex = 64 chars                              |
| JSON columns       | `IS JSON` constraint          | `CHECK (config IS JSON)`                            |

### API Routes

| Convention              | Example                                     |
| ----------------------- | ------------------------------------------- |
| Versioned base path     | `/api/v1/`                                  |
| Resource collections    | `/api/v1/workflows` (GET=list, POST=create) |
| Resource instances      | `/api/v1/workflows/[id]` (GET, PUT, DELETE) |
| Actions on resources    | `/api/v1/workflows/[id]/run` (POST)         |
| Query params: camelCase | `?limit=50&offset=0&search=text`            |
| Route params: camelCase | `[id]`, `[runId]`, `[name]`                 |

### Import Order

```typescript
// 1. Node built-ins / external packages
import { execFile } from "child_process";
import { z } from "zod";

// 2. Framework imports
import { json } from "@sveltejs/kit";
import type { FastifyPluginAsync } from "fastify";

// 3. Local $lib / package imports
import { OCIError } from "$lib/server/errors.js";
import { createLogger } from "$lib/server/logger.js";

// 4. Relative imports
import { errorResponse } from "../errors.js";
```

- Always use `.js` extensions in import paths (ESM requirement)
- Use `type` keyword for type-only imports: `import type { SessionUser } from './session.js'`

### Error Hierarchy

```
PortalError (base)
├── ValidationError   → 400 VALIDATION_ERROR
├── AuthError         → 401/403 AUTH_ERROR
├── NotFoundError     → 404 NOT_FOUND
├── RateLimitError    → 429 RATE_LIMIT
├── OCIError          → 502 OCI_ERROR
└── DatabaseError     → 503 DATABASE_ERROR
```

- `toJSON()` → Pino structured logs (includes stack)
- `toSentryExtras()` → Sentry context (excludes stack)
- `toResponseBody()` → HTTP response (never exposes internals)
- `isPortalError()` → type guard
- `toPortalError(err)` → wraps unknown errors as `INTERNAL_ERROR(500)`

### Git Commit Format

```
type(scope): description [optional-tracking-id]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
**Scopes**: `security`, `phaseX.Y`, `api`, `frontend`, `database`, `auth`, `workflows`
**Tracking IDs**: `(S-11)`, `(RL-9)`, `(M-3)` for security/issue references

### Environment Variables

- Always `UPPER_SNAKE_CASE`: `ORACLE_CONNECT_STRING`, `BETTER_AUTH_SECRET`, `CORS_ORIGIN`
- Validate with Zod at startup via `loadConfig()` in `apps/api/src/config.ts`
- Never hardcode — use OCI Vault for secrets, `.env` for local dev

## ⚠️ Anti-Patterns & Gotchas

### Oracle Database

- **NEVER combine `--all` and `--limit`** in OCI CLI tools (Zod defaults always emit both flags)
- **UPPERCASE column keys**: `OUT_FORMAT_OBJECT` returns UPPERCASE — use `fromOracleRow()` for camelCase
- **NEVER SELECT-then-INSERT/UPDATE**: Use `MERGE INTO` for atomic upserts (TOCTOU vulnerability)
- **Fire-and-forget updates**: Must use a separate `withConnection()` call, not reuse a closing connection
- **LIKE injection**: Always escape `%`, `_`, `\` in user search terms + add `ESCAPE '\'` clause

### SvelteKit / Build

- **Non-HTTP exports in +server.ts**: Must prefix with `_` (e.g., `_MODEL_ALLOWLIST`) or build fails
- **Server/client boundary**: +page.svelte cannot import from `$lib/server/`; use +page.server.ts load()
- **BETTER_AUTH_SECRET**: Required at build time; SvelteKit runs builds with NODE_ENV=production
- **npm 403 vs pnpm**: `npm` CLI hits 403 with expired `~/.npmrc` auth token; `pnpm` resolves same packages

### Security

- **NEVER grant default permissions** on auth errors — fail to 503/redirect
- **NEVER trust client-supplied approval flags** — use server-side `recordApproval()`/`consumeApproval()`
- **NEVER interpolate user input into SQL** — use bind parameters (`:paramName`)
- **Column/table names can't be bind variables** — validate with `validateColumnName()`/`validateTableName()`

### Fastify

- **Plugin registration order matters**: error-handler → request-logger → helmet → cors → rate-limit → cookie → oracle → session → rbac. Moving a plugin out of order causes hard-to-debug failures.
- **`skipAuth` + `testUser` for testing**: `buildApp({ skipAuth: true, testUser: {...} })` bypasses Oracle/session/RBAC plugins in tests. Stubs are registered so route modules can reference decorators.
- **`PUBLIC_ROUTES` set**: All unauthenticated endpoints must be listed in the deny-by-default auth gate in `app.ts`. Forgetting an entry results in 401s.
- **Type provider**: Route modules use `fastify.withTypeProvider<ZodTypeProvider>()` to enable Zod schema validation on `schema: { querystring, body, params }`.
- **`withConnection()` decorator**: Provided by oracle plugin. Check `fastify.hasDecorator("withConnection")` before using — returns graceful fallback when DB unavailable.

### Git & Workflow

- **NEVER `git add -A` or `git add .`** — always stage specific files by name
- **When tests fail after refactor**: Question whether the TESTS are wrong first, not just the code
- **Commit early and often**: After each logical unit of work, not batched at the end

## 🔧 Claude Code Automations

### Hooks (`.claude/settings.json`)

**PreToolUse (blockers)**:

- **Pre-commit** (`Bash`): Lint staged files + typecheck — blocks on failure
- **Pre-push** (`Bash`): Semgrep security scan — blocks on findings
- **Block bulk staging** (`Bash`): Rejects `git add -A` / `git add .`
- **Doc drift warning** (`Bash`): On `git push`, warns if architecture/security/migration files changed without corresponding doc updates (advisory, non-blocking)
- **Sensitive file blocker** (`Edit|Write`): Blocks edits to `.env`, `.pem/.key`, wallet, credential files
- **Migration validator** (`Edit|Write`): Validates `NNN-name.sql` pattern, warns on version gaps

**PostToolUse (auto-fixers)**:

- **Prettier** (`Edit|Write`): Runs `prettier --write` after edits (non-blocking)
- **ESLint fix** (`Edit|Write`): Runs `eslint --fix` on `.ts`/`.svelte` (non-blocking)
- **Related tests** (`Edit|Write`): Finds and runs matching `.test.ts` file (60s timeout)

### Skills (`.claude/skills/`)

- `/oracle-migration <name> - <description>` — Scaffold Oracle migration with correct DDL patterns
- `/phase-kickoff <N> - <title>` — Create branch, test shells, roadmap entry for new phase
- `/doc-sync [audit|fix]` — Audit all docs against codebase for drift; `fix` auto-updates stale sections

### Subagents (`.claude/agents/`)

- `security-reviewer` (Opus) — OWASP Top 10 + project-specific security review
- `oracle-query-reviewer` (Opus) — Oracle-specific SQL pitfalls and patterns

### MCP Servers (`.mcp.json`)

- `sentry` — Investigate production errors (requires `SENTRY_DSN`)

## 🤝 Contributing

This is a personal project repository. For issues or suggestions, contact Alex Cedergren.

---

Last updated: February 8, 2026
