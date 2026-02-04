/**
 * Langflow Deployment Integration Tests
 * 
 * Tests verify the complete deployment stack:
 * - Container health and configuration
 * - OCI GenAI custom components
 * - Oracle 26AI vector database
 * - Cloudflare Tunnel connectivity
 * 
 * Run with: bun test langflow/tests/deployment.test.ts
 */

import { describe, test, expect } from 'bun:test';
import {
  checkContainerHealth,
  getContainerResourceLimits,
  getContainerUser,
  execInContainer,
  getContainerEnvironment,
  resolveDNS,
} from './deployment-helpers';

const DEPLOYMENT_CONFIG = {
  domain: 'flow.solutionsedge.io',
  healthEndpoint: '/health',
  containerName: 'langflow',
};

describe('Langflow Deployment - Container Health', () => {
  test('container is running and healthy', async () => {
    const result = await checkContainerHealth(DEPLOYMENT_CONFIG.containerName);
    
    expect(result.running).toBe(true);
    expect(result.health).toBe('healthy');
    expect(result.restartCount).toBeLessThan(3);
  });

  test('container has correct resource limits', async () => {
    const limits = await getContainerResourceLimits(DEPLOYMENT_CONFIG.containerName);
    
    expect(limits.memory).toBe('4294967296'); // 4GB
    expect(limits.nanoCpus).toBe('1000000000'); // 1.0 CPU
  });

  test('container runs as non-root user', async () => {
    const user = await getContainerUser(DEPLOYMENT_CONFIG.containerName);
    
    expect(user.uid).toBe('1000');
    expect(user.username).toBe('langflow');
  });
});

describe('Langflow Deployment - HTTP Endpoints', () => {
  test('health endpoint returns 200 OK', async () => {
    const response = await fetch(`https://${DEPLOYMENT_CONFIG.domain}${DEPLOYMENT_CONFIG.healthEndpoint}`);
    
    expect(response.status).toBe(200);
  });

  test('health endpoint returns correct JSON', async () => {
    const response = await fetch(`https://${DEPLOYMENT_CONFIG.domain}${DEPLOYMENT_CONFIG.healthEndpoint}`);
    const data = await response.json();
    
    expect(data.status).toBe('ok');
  });

  test('health check completes within 5 seconds', async () => {
    const startTime = Date.now();
    await fetch(`https://${DEPLOYMENT_CONFIG.domain}${DEPLOYMENT_CONFIG.healthEndpoint}`);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5000);
  });
});

describe('Langflow Deployment - OCI GenAI Components', () => {
  test('custom components directory exists', async () => {
    const result = await execInContainer('ls -la /app/custom_components');
    
    expect(result.stdout).toContain('embeddings');
    expect(result.stdout).toContain('models');
    expect(result.stdout).toContain('vectorstores');
  });

  test('embeddings component files exist', async () => {
    const result = await execInContainer('find /app/custom_components/embeddings -name "*.py"');
    
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  test('models component files exist', async () => {
    const result = await execInContainer('find /app/custom_components/models -name "*.py"');
    
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  test('vectorstores component files exist', async () => {
    const result = await execInContainer('find /app/custom_components/vectorstores -name "*.py"');
    
    expect(result.stdout.length).toBeGreaterThan(0);
  });
});

describe('Langflow Deployment - Oracle 26AI Database', () => {
  test('Oracle wallet is mounted', async () => {
    const result = await execInContainer('ls -la /wallets/langflow');
    
    expect(result.stdout).toContain('tnsnames.ora');
    expect(result.stdout).toContain('cwallet.sso');
  });

  test('TNS_ADMIN environment variable is set', async () => {
    const env = await getContainerEnvironment();
    
    expect(env.TNS_ADMIN).toBe('/wallets/langflow');
    expect(env.ORACLE_CONNECT_STRING).toBe('langflowdb_high');
  });

  test('wallet files are readable', async () => {
    const result = await execInContainer('test -r /wallets/langflow/cwallet.sso && echo "readable"');
    
    expect(result.stdout).toContain('readable');
  });
});

describe('Langflow Deployment - SQLite Database', () => {
  test('SQLite database file exists', async () => {
    const result = await execInContainer('ls -lh /app/data/langflow.db');
    
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('langflow.db');
  });

  test('database file is owned by langflow user', async () => {
    const result = await execInContainer('stat -c "%U:%G" /app/data/langflow.db');
    
    expect(result.stdout.trim()).toBe('langflow:langflow');
  });

  test('database directory has correct permissions', async () => {
    const result = await execInContainer('stat -c "%a" /app/data');
    
    expect(result.stdout.trim()).toMatch(/^7[0-7]{2}$/); // 7XX permissions
  });
});

describe('Langflow Deployment - Cloudflare Tunnel', () => {
  test('DNS resolves to Cloudflare IPs', async () => {
    const ips = await resolveDNS(DEPLOYMENT_CONFIG.domain);
    
    expect(ips.length).toBeGreaterThan(0);
    expect(ips.some(ip => ip.startsWith('188.114'))).toBe(true);
  });

  test('HTTPS certificate is valid and from Cloudflare', async () => {
    const response = await fetch(`https://${DEPLOYMENT_CONFIG.domain}${DEPLOYMENT_CONFIG.healthEndpoint}`);
    
    expect(response.ok).toBe(true);
    expect(response.headers.has('cf-ray')).toBe(true); // Cloudflare header
  });

  test('connection uses Cloudflare proxy', async () => {
    const response = await fetch(`https://${DEPLOYMENT_CONFIG.domain}/`);
    
    expect(response.headers.get('server')).toContain('cloudflare');
  });
});

// Helper functions are now imported from deployment-helpers.ts
