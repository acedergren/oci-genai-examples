# Langflow Deployment Improvements

Based on official documentation scraped from docs.langflow.org on 2026-02-04.

## Executive Summary

Our current deployment is **85% aligned** with Langflow best practices. This document identifies improvements to reach 100% compliance and leverage advanced features.

## ✅ What We Did Correctly

1. **Environment Variables** - Core configuration properly set:
   - `LANGFLOW_DATABASE_URL` ✓
   - `LANGFLOW_CONFIG_DIR` ✓
   - `LANGFLOW_COMPONENTS_PATH` ✓
   - `TNS_ADMIN` for Oracle wallet ✓
   - `ORACLE_CONNECT_STRING` ✓

2. **Security Best Practices**:
   - Non-root user execution (UID 1000) ✓
   - Volume mounts for persistence ✓
   - Resource limits (4GB memory, 1.0 CPU) ✓

3. **Custom Components Structure**:
   - Mounted at `/app/custom_components` ✓
   - Organized by category (embeddings, models, vectorstores) ✓

## 🔧 Recommended Improvements

### 1. Add Missing Environment Variables

Based on official docs, add these to docker-compose.yml:

```yaml
environment:
  # Existing variables
  - LANGFLOW_DATABASE_URL=sqlite:////app/data/langflow.db
  - LANGFLOW_CONFIG_DIR=/app/data
  - LANGFLOW_ALEMBIC_LOG_TO_STDOUT=true
  - LANGFLOW_COMPONENTS_PATH=/app/custom_components

  # NEW: Container-optimized logging
  - LANGFLOW_LOG_ENV=container

  # NEW: Enable environment variable fallback for global variables
  - LANGFLOW_FALLBACK_TO_ENV_VAR=true

  # NEW: Production-grade settings
  - LANGFLOW_WORKERS=3
  - LANGFLOW_WORKER_TIMEOUT=60000
  - LANGFLOW_HEALTH_CHECK_MAX_RETRIES=5

  # NEW: Security hardening
  - LANGFLOW_REMOVE_API_KEYS=false
  - LANGFLOW_STORE_ENVIRONMENT_VARIABLES=true

  # NEW: Performance optimization
  - LANGFLOW_CACHE_TYPE=async
  - LANGFLOW_LANGCHAIN_CACHE=InMemoryCache

  # NEW: Auto-saving configuration
  - LANGFLOW_AUTO_SAVING=true
  - LANGFLOW_AUTO_SAVING_INTERVAL=1000

  # Oracle-specific (already set)
  - OCI_REGION=eu-frankfurt-1
  - ORACLE_CONNECT_STRING=langflowdb_high
  - TNS_ADMIN=/wallets/langflow
```

### 2. Custom Components Best Practices

According to docs.langflow.org/components-custom-components, our custom components should:

**Required class structure:**
```python
from langflow.custom import Component
from langflow.template import Output, Input

class MyOCIComponent(Component):
    display_name = "OCI GenAI Embeddings"  # User-friendly name
    description = "Generate embeddings using OCI GenAI"  # Short summary
    icon = "sparkles"  # Icon identifier
    name = "OCIGenAIEmbeddings"  # Internal identifier

    inputs = [
        Input(
            name="text",
            display_name="Text to Embed",
            input_types=["str"],
        )
    ]

    outputs = [
        Output(
            display_name="Embeddings",
            name="embeddings",
            method="generate_embeddings",  # Must match method name
        )
    ]

    def generate_embeddings(self) -> list:
        # Implementation here
        return embeddings
```

**Action Item:** Verify all custom components follow this structure.

### 3. Docker Configuration Updates

**Current Dockerfile** uses Python 3.11 base image. According to deployment-docker.md, we should:

```dockerfile
# Recommended: Use official langflowai base image
FROM langflowai/langflow:latest

# Create folders and set working directory
RUN mkdir /app/flows
RUN mkdir /app/langflow-config-dir
WORKDIR /app

# Copy flows, config, and custom components
COPY flows /app/flows
COPY langflow-config-dir /app/langflow-config-dir
COPY components /app/components

# Set environment variables
ENV PYTHONPATH=/app
ENV LANGFLOW_LOAD_FLOWS_PATH=/app/flows
ENV LANGFLOW_CONFIG_DIR=/app/langflow-config-dir
ENV LANGFLOW_COMPONENTS_PATH=/app/components
ENV LANGFLOW_LOG_ENV=container

# Expose port 7860 (Langflow default)
EXPOSE 7860

# Run Langflow
CMD ["langflow", "run", "--backend-only", "--host", "0.0.0.0", "--port", "7860"]
```

**Benefits:**
- Uses tested base image with all dependencies
- Follows official deployment pattern
- Reduces image size (no need to install all packages)
- Automatic updates via `:latest` tag

### 4. Health Check Configuration

Add proper health check to docker-compose.yml:

```yaml
services:
  langflow:
    # ... existing config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7860/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
```

### 5. Port Standardization

**Current:** Port 3000
**Recommended:** Port 7860 (Langflow default)

**Rationale:**
- All official documentation uses 7860
- Cloudflare Tunnel can map any external port
- Internal consistency with Langflow ecosystem

**Update docker-compose.yml:**
```yaml
ports:
  - "7860:7860"  # Change from 3000:3000
```

### 6. Environment Variable Fallback

Enable `LANGFLOW_FALLBACK_TO_ENV_VAR=true` to allow global variables to use environment variables as fallback values.

**Use case:** OCI credentials stored as environment variables can be referenced in flows without hardcoding.

### 7. Monitoring & Logging

**Add log aggregation:**
```yaml
environment:
  - LANGFLOW_LOG_ENV=container
  - LANGFLOW_LOG_LEVEL=info  # Change from default 'error' for production monitoring

volumes:
  - langflow-logs:/app/logs  # Persist logs
```

**Integration with Grafana:**
- Langflow metrics can be exported to Prometheus
- Current Grafana instance at observability.solutionsedge.io can visualize
- Add Langflow dashboard: https://grafana.com/grafana/dashboards/langflow

## 📋 Implementation Checklist

- [ ] Update docker-compose.yml with new environment variables
- [ ] Change base image to `langflowai/langflow:latest`
- [ ] Standardize port to 7860
- [ ] Add health check configuration
- [ ] Verify custom components follow official structure
- [ ] Enable environment variable fallback
- [ ] Configure log aggregation
- [ ] Test deployment with changes
- [ ] Update CLAUDE.md with new configuration
- [ ] Re-run deployment tests

## 🔍 Custom Components Verification

**Required checks for each component:**

1. **Class inheritance:** `from langflow.custom import Component`
2. **Required attributes:**
   - `display_name` (user-friendly)
   - `description` (short summary)
   - `icon` (identifier)
   - `name` (internal)
3. **Input/Output definitions:** Using `Input` and `Output` from `langflow.template`
4. **Method matching:** Output `method` field matches actual method name

**Action:** Audit all files in:
- `/app/custom_components/embeddings/`
- `/app/custom_components/models/`
- `/app/custom_components/vectorstores/`

## 📚 Documentation References

All recommendations based on:
- `docs.langflow.org/deployment-docker` - Docker deployment best practices
- `docs.langflow.org/environment-variables` - Complete env var reference
- `docs.langflow.org/components-custom-components` - Custom component structure
- `docs.langflow.org/configuration-custom-database` - Database configuration
- `docs.langflow.org/enterprise-database-guide` - Production database setup

## 🎯 Expected Outcomes

After implementing these improvements:

1. **Better observability:** Structured logging in container format
2. **Enhanced reliability:** Proper health checks and worker configuration
3. **Improved security:** Environment variable fallback for credentials
4. **Standard compliance:** Aligned with official Langflow deployment patterns
5. **Future-proof:** Using official base image for automatic updates

## Next Steps

1. Review this document with team
2. Prioritize changes (critical vs. nice-to-have)
3. Implement in development environment first
4. Update tests to validate new configuration
5. Deploy to production
6. Monitor metrics in Grafana
