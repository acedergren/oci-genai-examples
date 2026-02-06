# OCI Langflow RAG Demo Deployment - Product Requirements Document (PRD)

## Requirements Description

### Background
- **Business Problem**: Deploy a visual RAG (Retrieval-Augmented Generation) demonstration platform that showcases OCI Generative AI capabilities through Langflow's low-code interface. This provides a user-friendly way to build and prototype AI applications without extensive coding.
- **Target Users**: Developers, solution architects, and technical stakeholders evaluating OCI GenAI services for RAG use cases.
- **Value Proposition**:
  - Visual flow builder for RAG pipelines reduces development time
  - Demonstrates OCI GenAI integration patterns (embeddings, chat, vector store)
  - Provides production-ready infrastructure following established patterns from app01
  - Enables rapid prototyping and iteration on AI workflows

### Feature Overview
- **Core Features**:
  1. Langflow visual interface for building RAG flows
  2. OCI GenAI custom components (embeddings, chat, vector store)
  3. Oracle Database 26AI vector store for semantic search
  4. Secure deployment on OCI Compute with Docker
  5. Full infrastructure automation via Terraform
  6. Production-grade observability and monitoring
  7. Cloudflare Tunnel for secure web access

- **Feature Boundaries**:
  - **Included**: Infrastructure provisioning, Docker deployment, monitoring setup, secrets management, example RAG flows
  - **Not Included**: Custom Langflow components beyond OCI integration, multi-tenancy, autoscaling, production SLA guarantees (this is a demo platform)

- **User Scenarios**:
  1. Developer browses to Langflow UI, drags-and-drops OCI components to build a RAG flow
  2. Solution architect demos OCI GenAI capabilities to stakeholders using visual interface
  3. Technical team tests different embedding models and chat models without code changes
  4. Operations team monitors Langflow deployment health via Grafana dashboards

### Detailed Requirements

#### Input/Output
- **Inputs**:
  - OCI compartment ID and region
  - VCN ID (reuse charlstn-vcn: 10.0.0.0/16)
  - Deployment target: app01 (existing) or app03 (new instance)
  - Cloudflare Tunnel token (for web access)
  - OCI Vault secrets for database credentials

- **Outputs**:
  - Accessible Langflow web UI via Cloudflare Tunnel (e.g., `https://langflow.example.com`)
  - Grafana dashboards showing Langflow metrics, container health, infrastructure status
  - Oracle Database 26AI instance with vector search enabled
  - Example RAG flows pre-loaded in Langflow

#### User Interaction
1. Access Langflow UI through secure Cloudflare Tunnel (protected by Cloudflare Access)
2. Use visual flow builder to create RAG pipelines:
   - Add OCI Embeddings component (Cohere-based)
   - Add OCI Vector Store component (Oracle DB 26AI)
   - Add OCI Chat component (Meta Llama or Cohere)
   - Connect components to create end-to-end RAG flow
3. Upload documents or connect data sources for semantic search
4. Test and iterate on flows in real-time
5. Monitor deployment health via Grafana dashboards

#### Data Requirements
- **Configuration Data**:
  - Terraform variables: compartment_id, vcn_id, subnet_cidr, instance_shape
  - OCI Vault secrets: database password, wallet content, Cloudflare tunnel token
  - Environment variables: OCI region, compartment ID, database connection string

- **Vector Data**:
  - Document embeddings stored in Oracle Database 26AI vector tables
  - Text chunks indexed for semantic search
  - Metadata for document tracking and filtering

- **Component Data**:
  - Langflow custom components (Python files) for OCI integration
  - Flow definitions (JSON) for example RAG pipelines

#### Edge Cases
1. **Database Connection Failure**: Langflow should show clear error message, health check reports degraded state, alerts fired
2. **OCI GenAI Rate Limiting**: Components should handle throttling gracefully with retry logic
3. **Large Document Upload**: Implement chunking strategy for documents >10MB
4. **Instance Failure**: Auto-restart Docker containers via Docker Compose restart policies
5. **Vector Search Performance**: Index optimization for >100K embeddings
6. **Concurrent Users**: Support 5-10 simultaneous Langflow sessions (demo capacity)

## Design Decisions

### Technical Approach
- **Architecture Choice**:
  - Separate repository (`oci-langflow-demo`) independent from oci-genai-examples monorepo
  - Rationale: Python-focused tooling, different deployment target, cleaner separation of concerns

- **Deployment Pattern**: Follow app01 infrastructure model
  - Terraform for infrastructure provisioning
  - Docker Compose for application orchestration
  - Cloud-init for instance bootstrapping
  - OCI Vault for secrets management
  - Cloudflare Tunnel for ingress (no public IPs)

- **Key Components**:
  1. **OCI Compute Instance** (app03 or app01)
     - Shape: VM.Standard.E4.Flex (2 OCPU, 16GB RAM) - Langflow requires more resources than typical apps
     - OS: Ubuntu 22.04 LTS
     - Storage: 100GB block volume mounted at `/data` (logs, Langflow flows, Prometheus TSDB)

  2. **Oracle Autonomous Database 26AI**
     - Database: Always Free tier or OCPU-based (shared infrastructure)
     - Vector Search: Enabled with 1536-dimensional embeddings (Cohere default)
     - Wallet: Downloaded via cloud-init and mounted in Docker container

  3. **Langflow Container**
     - Base: Python 3.11 with Conda
     - Package manager: uv (faster than pip for Langflow dependencies)
     - Custom components: OCI embeddings, chat, vector store
     - Port: 7860 (internal, accessed via Cloudflare Tunnel)

  4. **Observability Stack**
     - Prometheus: Metrics collection (Langflow, container, system)
     - Grafana: Visualization dashboards
     - Alertmanager: Email alerts for critical issues
     - Loki: Log aggregation
     - cAdvisor: Container metrics
     - node-exporter: System metrics

- **Data Storage**:
  - **Vector Embeddings**: Oracle Database 26AI with VECTOR data type
  - **Langflow Flows**: SQLite database in `/data/langflow/flows.db`
  - **Configuration**: Environment variables in `/data/compose/.env`
  - **Secrets**: OCI Vault (pulled on instance boot via cloud-init)

- **Interface Design**:
  - **Langflow UI**: Accessed via `https://langflow.example.com` (Cloudflare Tunnel)
  - **Grafana**: Accessed via `https://grafana.example.com` (Cloudflare Access protected)
  - **Prometheus/Alertmanager**: Internal only, accessible via Grafana proxy

### Constraints

#### Performance Requirements
- **Langflow UI Response Time**: <2s for flow editing operations
- **RAG Query Latency**:
  - Embedding generation: <500ms for 512 tokens
  - Vector search: <200ms for top-10 results
  - Chat completion: <3s for 512-token response (streaming)
- **Concurrent Users**: Support 5-10 simultaneous sessions
- **Database Query Performance**: Vector similarity search <200ms for 100K embeddings

#### Compatibility
- **Python Version**: 3.11 (Langflow requirement)
- **OCI Services**: GenAI (Cohere embeddings, Meta/Cohere chat), Autonomous Database 26AI
- **Docker Engine**: 24.0+
- **Docker Compose**: 2.20+
- **OCI CLI**: 3.40+
- **Terraform**: 1.7+
- **Browser Support**: Chrome/Firefox/Safari (latest 2 versions)

#### Security
- **Network Isolation**:
  - Langflow instance on private subnet (no public IP)
  - All traffic routed through Cloudflare Tunnel (zero trust)
  - Database accessible only from Langflow instance (VCN security lists)

- **Authentication**:
  - Cloudflare Access with email-based authentication for Langflow UI
  - GitHub OAuth for Grafana access
  - OCI instance principal for Vault/database access (no API keys in code)

- **Secrets Management**:
  - All secrets stored in OCI Vault (database password, wallet, tunnel token)
  - Secrets pulled via instance principal at boot (no hardcoded credentials)
  - Wallet files chmod 600, directory chmod 700

- **Data Protection**:
  - Database connections use mTLS (Oracle wallet)
  - Cloudflare Tunnel uses TLS 1.3
  - No sensitive data in Docker logs or Git history

#### Scalability
- **Current Scope**: Single-instance deployment (demo/prototype)
- **Future Considerations**:
  - Horizontal scaling via OCI Container Instances
  - Shared database for multi-instance Langflow deployments
  - Load balancer for high-availability

### Risk Assessment

#### Technical Risks
1. **Langflow Dependency Hell** (High)
   - **Risk**: Langflow has 100+ Python dependencies, prone to conflicts
   - **Mitigation**: Use `uv` package manager (faster, better dependency resolution), pin all versions in requirements.txt, test installations in clean Conda environment

2. **OCI GenAI Rate Limits** (Medium)
   - **Risk**: Demo users hit per-minute rate limits during heavy testing
   - **Mitigation**: Implement rate limiting in Langflow components, display clear error messages, document rate limits in UI

3. **Vector Search Performance** (Medium)
   - **Risk**: Slow similarity search with large embedding datasets (>100K vectors)
   - **Mitigation**: Use Oracle DB 26AI vector indexes, optimize query patterns, test with realistic dataset sizes

4. **Docker Memory Exhaustion** (Medium)
   - **Risk**: Langflow + Prometheus + Grafana + Loki consumes >12GB RAM under load
   - **Mitigation**: Use VM.Standard.E4.Flex with 16GB RAM, set container memory limits, configure swap

#### Dependency Risks
1. **Oracle Database 26AI Availability** (Low)
   - **Risk**: 26AI may not be available in all OCI regions
   - **Dependency**: OCI Autonomous Database service
   - **Alternative**: Fall back to 23AI if 26AI unavailable, ensure vector search feature parity

2. **Cloudflare Tunnel Token** (Low)
   - **Risk**: Token expiration or rotation breaks ingress
   - **Dependency**: Cloudflare account and Tunnel service
   - **Alternative**: Use OCI API Gateway as fallback ingress method

3. **OCI Vault Secrets** (Low)
   - **Risk**: Vault unavailable during instance boot
   - **Dependency**: OCI Vault service in same region
   - **Mitigation**: Retry logic in cloud-init script, fallback to manual secret injection

#### Schedule Risks
1. **Terraform Debugging Time** (Medium)
   - **Risk**: Unforeseen Terraform issues add 2-3 days to deployment
   - **Response Strategy**: Allocate buffer time, test Terraform modules incrementally, reuse app01 patterns

2. **Database Provisioning Delays** (Low)
   - **Risk**: Oracle Autonomous Database creation takes 10-15 minutes
   - **Response Strategy**: Provision database early in Phase 1, parallelize with compute provisioning

## Acceptance Criteria

### Functional Acceptance
- [ ] **Infrastructure Provisioned**:
  - OCI Compute instance (app03) or Docker containers on app01 running
  - Oracle Autonomous Database 26AI created with vector search enabled
  - 100GB block volume attached and mounted at `/data`
  - Private subnet configured in charlstn-vcn
  - OCI Bastion session configured for SSH access

- [ ] **Langflow Accessible**:
  - Langflow UI accessible at `https://langflow.example.com` via Cloudflare Tunnel
  - Protected by Cloudflare Access (email authentication)
  - Visual flow builder loads without errors
  - No console errors in browser developer tools

- [ ] **OCI Components Functional**:
  - OCI Embeddings component generates embeddings for test text
  - OCI Vector Store component stores and retrieves embeddings from Oracle DB 26AI
  - OCI Chat component returns responses from Meta Llama or Cohere models
  - Example RAG flow executes end-to-end (document upload → embedding → search → chat)

- [ ] **Monitoring Operational**:
  - Grafana dashboards accessible at `https://grafana.example.com`
  - System metrics dashboard shows CPU, memory, disk usage
  - Container metrics dashboard shows Langflow container health
  - Alertmanager sends test email successfully
  - Prometheus scrapes Langflow metrics (if exposed via /metrics endpoint)

- [ ] **Secrets Management**:
  - Cloud-init successfully pulls secrets from OCI Vault
  - `/data/compose/.env` contains all required secrets (database password, wallet password, tunnel token)
  - Oracle wallet extracted to `/data/wallets/langflow` with correct permissions
  - No secrets visible in Docker logs or Git history

### Quality Standards
- [ ] **Code Quality**:
  - Terraform modules follow app01 patterns (variables.tf, outputs.tf, main.tf structure)
  - Docker Compose file uses named volumes, health checks, restart policies
  - Cloud-init script is idempotent and includes error handling
  - All scripts have comments explaining purpose and usage

- [ ] **Test Coverage**:
  - Terraform `validate` and `plan` pass without errors
  - Docker Compose `config` validates syntax
  - Manual test: Create RAG flow, upload document, query and verify results
  - Manual test: Restart Docker containers, verify Langflow state persists
  - Manual test: Trigger alert (e.g., stop container), verify email sent

- [ ] **Performance Metrics**:
  - Langflow UI page load <3s
  - RAG query end-to-end latency <5s (embedding + search + chat)
  - Vector search for 10K embeddings <200ms
  - Grafana dashboard refresh <1s

- [ ] **Security Review**:
  - No API keys or passwords in Terraform files, Docker Compose, or Git history
  - Langflow accessible only via Cloudflare Tunnel (no port 7860 exposed)
  - Database accessible only from Langflow instance (security list rules verified)
  - Cloudflare Access policies configured correctly (test with unauthorized email)

### User Acceptance
- [ ] **User Experience**:
  - First-time user can create a RAG flow in <10 minutes without documentation
  - Error messages are clear and actionable (e.g., "Database connection failed. Check wallet configuration.")
  - Example flows demonstrate key capabilities (document Q&A, semantic search)

- [ ] **Documentation**:
  - README includes: Prerequisites, quick start, architecture diagram, troubleshooting
  - Runbook includes: Deployment steps, SSH access via bastion, restarting services, checking logs
  - Architecture diagram shows: VCN topology, compute instance, database, Cloudflare Tunnel flow

- [ ] **Training Materials** (Optional):
  - Video walkthrough: Creating first RAG flow (5 minutes)
  - Example flows: Document Q&A, semantic search, conversational memory

## Execution Phases

### Phase 1: Environment Preparation & Repository Setup
**Goal**: Create repository structure, configure development environment, provision Oracle Database

**Tasks**:
- [ ] Create `oci-langflow-demo` GitHub repository with MIT license
- [ ] Set up repository structure:
  ```
  oci-langflow-demo/
  ├── infrastructure/
  │   ├── terraform/
  │   │   ├── main.tf
  │   │   ├── variables.tf
  │   │   ├── outputs.tf
  │   │   ├── cloud-init.yaml
  │   │   └── terraform.tfvars.example
  │   ├── docker/
  │   │   ├── docker-compose.yml
  │   │   ├── Dockerfile.langflow
  │   │   └── .dockerignore
  │   └── observability/
  │       ├── prometheus/
  │       │   ├── prometheus.yml
  │       │   └── alerts.yml
  │       ├── grafana/
  │       │   ├── provisioning/
  │       │   └── dashboards/
  │       ├── loki/
  │       │   └── loki-config.yml
  │       └── alertmanager/
  │           └── alertmanager.yml
  ├── langflow/
  │   ├── custom_components/
  │   │   ├── embeddings/
  │   │   ├── models/
  │   │   └── vectorstores/
  │   └── example_flows/
  │       ├── document-qa.json
  │       └── semantic-search.json
  ├── docs/
  │   ├── architecture.md
  │   ├── deployment-runbook.md
  │   └── troubleshooting.md
  └── README.md
  ```
- [ ] Copy OCI custom components from upstream repo:
  - `oci_embeddings_components.py`
  - `oci_chat_component.py`
  - `oci_vs_component.py`
- [ ] Provision Oracle Autonomous Database 26AI via OCI Console:
  - Compartment: `ac`
  - Database name: `langflowdb`
  - Workload type: Transaction Processing (ATP)
  - Version: 26AI
  - Storage: 20GB (expandable)
  - OCPU: 1 (scale up to 2 if needed)
  - Enable vector search feature
  - Download admin wallet ZIP
- [ ] Store database credentials in OCI Vault:
  - Secret: `langflow-oracle-password`
  - Secret: `langflow-oracle-wallet-password`
  - Secret: `langflow-oracle-wallet-content` (base64-encoded wallet ZIP)
- [ ] Test database connection using SQL Developer or sqlplus

**Deliverables**:
- GitHub repository with directory structure
- Oracle Database 26AI provisioned and accessible
- OCI Vault secrets created
- Custom Langflow components copied

**Time Estimate**: Not provided per guidelines

---

### Phase 2: Infrastructure as Code (Terraform)
**Goal**: Create Terraform modules to provision compute instance, networking, storage, and IAM policies

**Tasks**:
- [ ] Create Terraform variables file (`variables.tf`):
  - `tenancy_id`, `compartment_id`, `region`
  - `vcn_id` (charlstn-vcn)
  - `app_subnet_cidr` (e.g., 10.0.3.0/24 for app03)
  - `bastion_subnet_cidr` (reuse existing if deploying to app01)
  - `instance_shape` (VM.Standard.E4.Flex)
  - `instance_ocpus` (2)
  - `instance_memory_in_gbs` (16)
  - `block_volume_size_in_gbs` (100)
  - `database_wallet_secret_id`
  - `database_password_secret_id`
  - `cloudflare_tunnel_token_secret_id`

- [ ] Create Terraform main configuration (`main.tf`):
  - **Subnet**: Private subnet for app03 (or reuse app01 subnet)
  - **Compute Instance**:
    - Name: `app03-langflow` (or `app01` if reusing)
    - Shape: VM.Standard.E4.Flex (2 OCPU, 16GB RAM)
    - Image: Ubuntu 22.04
    - User data: Reference cloud-init.yaml
    - Assign to private subnet (no public IP)
  - **Block Volume**:
    - Size: 100GB
    - Attachment: `/dev/oracleoci/oraclevdb`
    - Backup policy: Daily incremental (30-day retention)
  - **IAM Dynamic Group**:
    - Match rule: `instance.id = '<instance-ocid>'`
  - **IAM Policy**:
    - Allow dynamic group to read secrets from Vault
    - Allow dynamic group to use autonomous-database-family in compartment
  - **Bastion**: Reuse existing app01-bastion if deploying to app01

- [ ] Create cloud-init script (`cloud-init.yaml`):
  - Install packages: Docker, Docker Compose, OCI CLI, postfix (for email alerts)
  - Format and mount block volume to `/data`
  - Create directories: `/data/compose`, `/data/langflow`, `/data/wallets`, `/data/prometheus`, `/data/grafana`, `/data/loki`
  - Write `/usr/local/bin/langflow-fetch-secrets.sh` script:
    - Use OCI CLI with instance principal to fetch secrets
    - Decode and extract Oracle wallet to `/data/wallets/langflow`
    - Write `/data/compose/.env` with all secrets
  - Execute secret fetch script
  - Write `/usr/local/bin/langflow-bootstrap.sh` script:
    - Clone oci-langflow-demo repository
    - Copy docker-compose.yml to `/data/compose/`
    - Copy observability configs to `/data/prometheus`, `/data/grafana`, etc.
    - Start Docker Compose stack
  - Schedule bootstrap script to run on first boot

- [ ] Create Terraform outputs (`outputs.tf`):
  - `instance_id`: OCID of compute instance
  - `instance_private_ip`: Private IP address
  - `block_volume_id`: OCID of block volume
  - `database_connection_string`: e.g., `langflowdb_high`
  - `bastion_session_command`: OCI CLI command to create SSH session

- [ ] Create example tfvars (`terraform.tfvars.example`)

- [ ] Validate Terraform configuration:
  ```bash
  terraform init
  terraform validate
  terraform plan
  ```

**Deliverables**:
- Complete Terraform module ready for `terraform apply`
- Cloud-init script with secret bootstrapping
- Terraform plan output reviewed and approved

**Time Estimate**: Not provided per guidelines

---

### Phase 3: Docker Containerization
**Goal**: Create Docker Compose configuration for Langflow, observability stack, and supporting services

**Tasks**:
- [ ] Create Dockerfile for Langflow (`Dockerfile.langflow`):
  ```dockerfile
  FROM python:3.11-slim

  # Install system dependencies
  RUN apt-get update && apt-get install -y \
      gcc g++ make \
      curl wget \
      git \
      && rm -rf /var/lib/apt/lists/*

  # Install uv package manager
  RUN pip install uv

  # Install Langflow and OCI SDK
  RUN uv pip install langflow
  RUN pip install oci -U

  # Set working directory
  WORKDIR /app

  # Copy OCI custom components
  COPY langflow/custom_components /app/custom_components

  # Set environment variable for components path
  ENV LANGFLOW_COMPONENTS_PATH=/app/custom_components

  # Expose Langflow port
  EXPOSE 7860

  # Run Langflow
  CMD ["uv", "run", "langflow", "run", "--host", "0.0.0.0", "--port", "7860"]
  ```

- [ ] Create Docker Compose file (`docker-compose.yml`):
  ```yaml
  version: '3.8'

  services:
    langflow:
      build:
        context: .
        dockerfile: infrastructure/docker/Dockerfile.langflow
      container_name: langflow
      restart: unless-stopped
      environment:
        - LANGFLOW_COMPONENTS_PATH=/app/custom_components
        - OCI_REGION=${OCI_REGION}
        - OCI_COMPARTMENT_ID=${OCI_COMPARTMENT_ID}
        - ORACLE_USER=ADMIN
        - ORACLE_PASSWORD=${ORACLE_PASSWORD}
        - ORACLE_CONNECT_STRING=langflowdb_high
        - ORACLE_CONFIG_DIR=/wallets/langflow
      volumes:
        - /data/langflow:/app/data
        - /data/wallets/langflow:/wallets/langflow:ro
      ports:
        - "7860:7860"
      healthcheck:
        test: ["CMD", "curl", "-f", "http://localhost:7860/health"]
        interval: 30s
        timeout: 10s
        retries: 3
      networks:
        - langflow-net

    prometheus:
      image: prom/prometheus:v2.50.0
      container_name: prometheus
      restart: unless-stopped
      volumes:
        - /data/prometheus/config:/etc/prometheus
        - /data/prometheus/data:/prometheus
      command:
        - '--config.file=/etc/prometheus/prometheus.yml'
        - '--storage.tsdb.path=/prometheus'
        - '--storage.tsdb.retention.time=15d'
        - '--web.enable-lifecycle'
      ports:
        - "9090:9090"
      networks:
        - langflow-net

    grafana:
      image: grafana/grafana:10.2.3
      container_name: grafana
      restart: unless-stopped
      environment:
        - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
        - GF_AUTH_DISABLE_LOGIN_FORM=true
        - GF_AUTH_OAUTH_AUTO_LOGIN=true
      volumes:
        - /data/grafana/data:/var/lib/grafana
        - /data/grafana/provisioning:/etc/grafana/provisioning
        - /data/grafana/dashboards:/var/lib/grafana/dashboards
      ports:
        - "3000:3000"
      networks:
        - langflow-net

    alertmanager:
      image: prom/alertmanager:v0.27.0
      container_name: alertmanager
      restart: unless-stopped
      volumes:
        - /data/alertmanager/config:/etc/alertmanager
        - /data/alertmanager/data:/alertmanager
      command:
        - '--config.file=/etc/alertmanager/alertmanager.yml'
        - '--storage.path=/alertmanager'
      ports:
        - "9093:9093"
      networks:
        - langflow-net

    loki:
      image: grafana/loki:2.9.3
      container_name: loki
      restart: unless-stopped
      volumes:
        - /data/loki/config:/etc/loki
        - /data/loki/data:/loki
      command: -config.file=/etc/loki/loki-config.yml
      ports:
        - "3100:3100"
      networks:
        - langflow-net

    promtail:
      image: grafana/promtail:2.9.3
      container_name: promtail
      restart: unless-stopped
      volumes:
        - /var/log:/var/log:ro
        - /var/lib/docker/containers:/var/lib/docker/containers:ro
        - /data/promtail/config:/etc/promtail
      command: -config.file=/etc/promtail/config.yml
      networks:
        - langflow-net

    node-exporter:
      image: prom/node-exporter:v1.7.0
      container_name: node-exporter
      restart: unless-stopped
      command:
        - '--path.rootfs=/host'
      volumes:
        - /:/host:ro,rslave
      ports:
        - "9100:9100"
      networks:
        - langflow-net

    cadvisor:
      image: gcr.io/cadvisor/cadvisor:v0.47.2
      container_name: cadvisor
      restart: unless-stopped
      privileged: true
      volumes:
        - /:/rootfs:ro
        - /var/run:/var/run:ro
        - /sys:/sys:ro
        - /var/lib/docker/:/var/lib/docker:ro
      ports:
        - "8080:8080"
      networks:
        - langflow-net

    cloudflared:
      image: cloudflare/cloudflared:latest
      container_name: cloudflared
      restart: unless-stopped
      command: tunnel --no-autoupdate run
      environment:
        - TUNNEL_TOKEN=${CF_TUNNEL_TOKEN}
      networks:
        - langflow-net

  networks:
    langflow-net:
      driver: bridge
  ```

- [ ] Create Prometheus configuration (`prometheus.yml`):
  - Scrape targets: langflow (if /metrics exposed), node-exporter, cadvisor, prometheus
  - Load alert rules from `alerts.yml`
  - Set scrape interval to 15s

- [ ] Create Alertmanager configuration (`alertmanager.yml`):
  - Route alerts by severity (critical, warning, info)
  - Email receiver: `alex@solutionsedge.io` via localhost:25 (postfix)
  - Grouping: by alertname, component, instance
  - Inhibition rules: suppress container alerts if host alert fires

- [ ] Create alert rules (`alerts.yml`):
  - LangflowDown: Langflow container not running
  - LangflowHighMemory: Container using >80% memory
  - DatabaseConnectionFailed: Health check reports DB unavailable
  - HighCPUUsage, CriticalMemoryUsage, HighDiskUsage (inherit from app01)

- [ ] Create Grafana dashboards:
  - System metrics dashboard (CPU, memory, disk from node-exporter)
  - Container metrics dashboard (Langflow, Prometheus, Grafana health)
  - Langflow application dashboard (if custom metrics exposed)

- [ ] Test Docker Compose locally (if possible):
  ```bash
  docker-compose config  # Validate syntax
  docker-compose up -d   # Start services
  docker-compose ps      # Check status
  docker-compose logs langflow  # Check Langflow logs
  ```

**Deliverables**:
- Dockerfile for Langflow with OCI components
- docker-compose.yml with full observability stack
- Prometheus/Grafana/Alertmanager configurations
- Alert rules and dashboards

**Time Estimate**: Not provided per guidelines

---

### Phase 4: Cloudflare Tunnel Setup
**Goal**: Configure Cloudflare Tunnel for secure ingress to Langflow and Grafana UIs

**Tasks**:
- [ ] Create Cloudflare Tunnel in Cloudflare dashboard:
  - Navigate to Networks → Tunnels
  - Click "Create a tunnel"
  - Name: `langflow-tunnel`
  - Copy tunnel token

- [ ] Store tunnel token in OCI Vault:
  - Secret name: `langflow-cloudflare-tunnel-token`
  - Secret value: Tunnel token from Cloudflare

- [ ] Configure tunnel routes in Cloudflare dashboard:
  - Public hostname: `langflow.example.com`
  - Service: `http://langflow:7860`
  - TLS: No TLS Verify (internal traffic)

  - Public hostname: `grafana.example.com`
  - Service: `http://grafana:3000`
  - TLS: No TLS Verify

- [ ] Configure Cloudflare Access policies:
  - Policy for `langflow.example.com`:
    - Authentication method: One-time PIN or OAuth (email-based)
    - Allow: Specific email addresses (e.g., `alex@solutionsedge.io`)

  - Policy for `grafana.example.com`:
    - Authentication method: GitHub OAuth
    - Allow: GitHub username or organization

- [ ] Update cloud-init script to pull tunnel token from Vault:
  ```bash
  CF_TUNNEL_TOKEN=$(oci secrets secret-bundle get \
    --secret-id ${CF_TUNNEL_TOKEN_SECRET_ID} \
    --query 'data."secret-bundle-content".content' \
    --raw-output | base64 -d)
  echo "CF_TUNNEL_TOKEN=${CF_TUNNEL_TOKEN}" >> /data/compose/.env
  ```

- [ ] Test tunnel connectivity:
  - Start Docker Compose stack
  - Access `https://langflow.example.com` from browser
  - Verify Cloudflare Access authentication prompt
  - Verify Langflow UI loads after authentication

**Deliverables**:
- Cloudflare Tunnel configured with routes
- Cloudflare Access policies protecting UIs
- Tunnel token stored in OCI Vault
- Successful end-to-end connectivity test

**Time Estimate**: Not provided per guidelines

---

### Phase 5: Deployment & Testing
**Goal**: Deploy infrastructure, validate all components, and perform end-to-end testing

**Tasks**:
- [ ] Deploy infrastructure with Terraform:
  ```bash
  cd infrastructure/terraform
  terraform init
  terraform plan -out=tfplan
  terraform apply tfplan
  ```

- [ ] Wait for instance provisioning and cloud-init to complete (~10-15 minutes)

- [ ] Verify instance is accessible via OCI Bastion:
  ```bash
  # Create bastion session
  oci bastion session create-managed-ssh \
    --bastion-id <bastion-ocid> \
    --target-resource-id <instance-ocid> \
    --ssh-public-key-file ~/.ssh/id_rsa.pub

  # SSH to instance
  ssh -i ~/.ssh/id_rsa -o ProxyCommand="ssh -W %h:%p <bastion-session>" ubuntu@<private-ip>
  ```

- [ ] Check Docker containers are running:
  ```bash
  docker ps -a
  docker-compose -f /data/compose/docker-compose.yml ps
  ```

- [ ] Check cloud-init logs for errors:
  ```bash
  sudo tail -100 /var/log/cloud-init-output.log
  ```

- [ ] Verify secrets are populated:
  ```bash
  cat /data/compose/.env | grep -v PASSWORD  # Show env vars (hide passwords)
  ls -l /data/wallets/langflow  # Check wallet files
  ```

- [ ] Test Langflow accessibility:
  - Navigate to `https://langflow.example.com`
  - Authenticate via Cloudflare Access
  - Verify Langflow UI loads without errors
  - Open browser console (F12), check for JavaScript errors

- [ ] Test OCI custom components:
  - Create new flow in Langflow
  - Add "OCI Embeddings" component, configure with test text
  - Verify embeddings are generated (check component output)
  - Add "OCI Vector Store" component, configure database connection
  - Verify connection succeeds (no error messages)
  - Add "OCI Chat" component, send test prompt
  - Verify response is returned from OCI GenAI model

- [ ] Test example RAG flow:
  - Import `document-qa.json` flow
  - Upload sample document (e.g., PDF or TXT)
  - Run embedding generation
  - Perform semantic search query
  - Verify search results are returned
  - Send chat query referencing document
  - Verify RAG response includes document context

- [ ] Test monitoring and alerting:
  - Access Grafana at `https://grafana.example.com`
  - Verify all dashboards load (System, Containers, Langflow)
  - Check Prometheus targets are up (Status → Targets)
  - Trigger test alert: Stop Langflow container
    ```bash
    docker stop langflow
    ```
  - Wait 2 minutes, check email for alert
  - Restart container, verify alert resolves
    ```bash
    docker start langflow
    ```

- [ ] Performance testing:
  - Run 10 concurrent RAG queries, measure latency
  - Verify p95 latency <5s
  - Check Grafana for CPU/memory spikes
  - Verify no container restarts during load

- [ ] Document any issues found and resolution steps

**Deliverables**:
- Fully deployed and operational Langflow environment
- All components tested and working
- Test results documented
- Known issues and workarounds documented

**Time Estimate**: Not provided per guidelines

---

### Phase 6: Documentation & Handoff
**Goal**: Create comprehensive documentation for deployment, operations, and troubleshooting

**Tasks**:
- [ ] Write README.md:
  - Project overview and purpose
  - Architecture diagram (draw.io or Mermaid)
  - Prerequisites (OCI account, Cloudflare account, Terraform, Docker)
  - Quick start guide (clone repo → configure tfvars → terraform apply → access UI)
  - Configuration reference (environment variables, Terraform variables)
  - Links to detailed documentation

- [ ] Write architecture documentation (`docs/architecture.md`):
  - Component diagram showing: VCN, subnets, compute, database, Cloudflare Tunnel
  - Data flow diagram: User → Cloudflare → Tunnel → Langflow → OCI GenAI → Database
  - Security model: Network isolation, authentication, secrets management
  - Technology stack with versions

- [ ] Write deployment runbook (`docs/deployment-runbook.md`):
  - Step-by-step deployment process
  - Prerequisites checklist
  - Terraform commands with explanations
  - Verification steps after deployment
  - Rollback procedures
  - Common deployment errors and fixes

- [ ] Write operations guide (`docs/operations.md`):
  - How to access instance via OCI Bastion
  - How to check container logs
  - How to restart services
  - How to update Langflow components
  - How to backup and restore Langflow flows
  - How to rotate secrets (database password, tunnel token)

- [ ] Write troubleshooting guide (`docs/troubleshooting.md`):
  - Langflow not accessible: Check Cloudflare Tunnel status, check container logs
  - Database connection failed: Verify wallet files, check security lists, test sqlplus
  - OCI GenAI errors: Check rate limits, verify compartment OCID, check IAM policies
  - High memory usage: Check container stats, prune Docker images/volumes
  - Alert not firing: Check Prometheus targets, verify alert rule syntax
  - Email not received: Check postfix logs, test manual email send

- [ ] Create video walkthrough (optional):
  - Screen recording: Deploying infrastructure with Terraform
  - Screen recording: Creating first RAG flow in Langflow
  - Upload to YouTube or internal video platform

- [ ] Prepare handoff materials:
  - OCI resource OCIDs (instance, database, vault secrets)
  - Cloudflare Tunnel token location
  - Admin credentials (Grafana, if not using OAuth)
  - Contact information for support escalation

**Deliverables**:
- Complete documentation set (README, architecture, runbook, operations, troubleshooting)
- Video walkthrough (optional)
- Handoff materials for operations team

**Time Estimate**: Not provided per guidelines

---

## Clarification History

This PRD was developed through systematic clarification across 4 rounds:

**Round 1**: Established basic requirements
- Deployment target: OCI Langflow from oracle-devrel repository
- Action: Update existing codebase accordingly
- Initial clarity score: 35/100

**Round 2**: Defined deployment and integration approach
- Deployment: OCI Compute instance with Docker or OCI Container Instances
- Integration: New standalone package (not related to oci-genai-provider)
- Scope: RAG demo application
- Database: Follow repository setup instructions
- Repository: Open to separate repo if better
- Clarity score: 55/100

**Round 3**: Specified infrastructure patterns and automation
- Repository: Separate repo (`oci-langflow-demo`)
- Automation: Full Terraform + Docker + Cloud-init
- Database: Provision new Oracle Autonomous Database
- Infrastructure: Follow app01 patterns (VCN reuse, private subnets, Vault secrets, Cloudflare Tunnel)
- Compartment: `ac`
- Compute: Reuse app01 or deploy new app03
- Reference documents: app01 Terraform, cloud-init, Docker Compose, observability patterns
- Clarity score: 85/100

**Round 4**: Added database version constraint
- Database: Oracle Database 26AI (latest version, not 23AI)
- Final clarity score: 100/100

---

**Document Version**: 1.0
**Created**: 2026-02-03
**Clarification Rounds**: 4
**Quality Score**: 100/100
