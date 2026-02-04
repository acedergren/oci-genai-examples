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
├── oci-ai-chat/                 # SvelteKit chat application
│   ├── src/
│   │   ├── lib/
│   │   └── routes/
│   └── static/
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

| Secret Name | Purpose | Usage | OCID |
|------------|---------|-------|------|
| `oracle-admin-password` | Oracle DB password | Database connection | `ocid1.vaultsecret...` |
| `oracle-wallet-password` | Oracle wallet password | Wallet decryption | `ocid1.vaultsecret...` |
| `cloudflare-edit-all-tunnels` | Cloudflare API token | Tunnel management | `ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pya7wekuzmasatmllrwcrko4pthfuywrxxghbhxop6nyslq` |
| `cloudflare-account-id-v2` | Cloudflare account ID | API authentication | `ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pyasqjslrvk7aq43jvv7p2yft43pub6e5yuf4kearacimva` |
| `running-days-cloudflare-api-token` | Cloudflare zone token | Zone read access | `ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pyancuf2xk2v6xyrgjjfwvmho6dcemy6tvwmjbtvs5etgaa` |
| `cloudflare-global-api-key` | Cloudflare global key | Full account access | `ocid1.vaultsecret.oc1.eu-frankfurt-1.amaaaaaahhxc6pyasmvx3ejgbkrn4lmq2pj4rrezfzgsubp3bh6ron2uz2ra` |

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

| Token Name | Tunnel Config | Zone Read | DNS Edit | Analytics |
|-----------|--------------|-----------|----------|-----------|
| `cloudflare-edit-all-tunnels` | ✅ | ❌ | ❌ | ❌ |
| `running-days-cloudflare-api-token` | ❌ | ✅ | ❌ | ❌ |
| `solutionsedge-cloudflare-analytics-token` | ❌ | ✅ | ❌ | ✅ |
| `cloudflare-global-api-key` | ✅ | ✅ | ✅ | ✅ |

**Note**: DNS modifications require either:
- Cloudflare Dashboard access
- Global API key with associated email
- Custom API token with `Zone.DNS:Edit` permission

## 📚 Related Documentation

- [OCI Generative AI Documentation](https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm)
- [Oracle Database 26AI Vector Search](https://docs.oracle.com/en/database/oracle/oracle-database/26/index.html)
- [Langflow Documentation](https://docs.langflow.org/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)

## 🤝 Contributing

This is a personal project repository. For issues or suggestions, contact Anders Cedergran.

---

Last updated: February 4, 2026
