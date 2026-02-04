/**
 * Helper functions for Langflow deployment tests
 * Implements SSH access to app01 via OCI Bastion
 */

import { $ } from 'bun';

const BASTION_CONFIG = {
  sshKey: `${process.env.HOME}/.ssh/bastion_app01`,
  bastionHost: 'host.bastion.eu-frankfurt-1.oci.oraclecloud.com',
  targetIP: '10.0.3.113',
  targetUser: 'ubuntu',
  containerName: 'langflow',
};

/**
 * Get bastion session ID from temp file or environment
 */
async function getBastionSessionId(): Promise<string> {
  if (process.env.BASTION_SESSION_ID) {
    return process.env.BASTION_SESSION_ID;
  }

  const file = Bun.file('/tmp/langflow-session-id.txt');
  const text = await file.text();
  return text.trim();
}

/**
 * Execute command on app01 via bastion session
 */
async function sshExec(command: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const sessionId = await getBastionSessionId();

  const proxyCommand = `ssh -i ${BASTION_CONFIG.sshKey} -W %h:%p -p 22 ${sessionId}@${BASTION_CONFIG.bastionHost}`;

  try {
    const proc = Bun.spawn([
      'ssh',
      '-i', BASTION_CONFIG.sshKey,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', `ProxyCommand=${proxyCommand}`,
      '-p', '22',
      `${BASTION_CONFIG.targetUser}@${BASTION_CONFIG.targetIP}`,
      command
    ]);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return {
      stdout,
      stderr,
      exitCode,
    };
  } catch (error: any) {
    return {
      stdout: '',
      stderr: error.message || 'SSH execution failed',
      exitCode: 1,
    };
  }
}

/**
 * Execute command inside Docker container on app01
 */
export async function execInContainer(command: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const dockerCommand = `sudo docker exec ${BASTION_CONFIG.containerName} ${command}`;
  return sshExec(dockerCommand);
}

/**
 * Check container health status
 */
export async function checkContainerHealth(containerName: string): Promise<{
  running: boolean;
  health: string;
  restartCount: number;
}> {
  const result = await sshExec(
    `sudo docker inspect ${containerName} --format '{{.State.Running}}|{{.State.Health.Status}}|{{.RestartCount}}'`
  );

  const [running, health, restartCount] = result.stdout.trim().split('|');

  return {
    running: running === 'true',
    health: health || 'unknown',
    restartCount: parseInt(restartCount || '0', 10),
  };
}

/**
 * Get container resource limits
 */
export async function getContainerResourceLimits(containerName: string): Promise<{
  memory: string;
  nanoCpus: string;
}> {
  const result = await sshExec(
    `sudo docker inspect ${containerName} --format '{{.HostConfig.Memory}}|{{.HostConfig.NanoCpus}}'`
  );

  const [memory, nanoCpus] = result.stdout.trim().split('|');

  return {
    memory: memory || '0',
    nanoCpus: nanoCpus || '0',
  };
}

/**
 * Get container user information
 */
export async function getContainerUser(containerName: string): Promise<{
  uid: string;
  username: string;
}> {
  const result = await execInContainer('id -u && id -un');
  const [uid, username] = result.stdout.trim().split('\n');

  return {
    uid: uid.trim(),
    username: username.trim(),
  };
}

/**
 * Get container environment variables
 */
export async function getContainerEnvironment(): Promise<Record<string, string>> {
  const result = await sshExec(
    `sudo docker inspect ${BASTION_CONFIG.containerName} --format '{{range .Config.Env}}{{println .}}{{end}}'`
  );

  const env: Record<string, string> = {};

  result.stdout.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed) {
      const [key, ...valueParts] = trimmed.split('=');
      env[key] = valueParts.join('=');
    }
  });

  return env;
}

/**
 * Resolve DNS for domain
 */
export async function resolveDNS(domain: string): Promise<string[]> {
  const result = await $`dig +short ${domain}`.quiet();

  return result.stdout
    .toString()
    .split('\n')
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0);
}
