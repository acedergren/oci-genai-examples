// @ts-expect-error oracledb ships no type declarations
import oracledb from 'oracledb';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

// Thin mode: no Oracle Client needed. Set global defaults.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

export interface OracleConfig {
  user: string;
  password: string;
  connectString: string;
  walletLocation?: string;
  walletPassword?: string;
  poolMin?: number;
  poolMax?: number;
  poolIncrement?: number;
  poolTimeout?: number;
}

export interface OracleConnection {
  close(): Promise<void>;
  execute<T = Record<string, unknown>>(
    sql: string,
    binds?: unknown,
    options?: unknown
  ): Promise<{ rows?: T[] }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface OraclePool {
  getConnection(): Promise<OracleConnection>;
  close(drainTime?: number): Promise<void>;
  connectionsOpen: number;
  connectionsInUse: number;
  poolMin: number;
  poolMax: number;
}

declare module 'fastify' {
  interface FastifyInstance {
    oracle: OraclePool;
    withConnection: <T>(fn: (conn: OracleConnection) => Promise<T>) => Promise<T>;
  }
}

function resolveConfig(opts: OracleConfig): OracleConfig {
  return {
    user: opts.user || process.env.ORACLE_USER || '',
    password: opts.password || process.env.ORACLE_PASSWORD || '',
    connectString:
      opts.connectString ||
      process.env.ORACLE_CONNECT_STRING ||
      process.env.ORACLE_DSN ||
      '',
    walletLocation: opts.walletLocation ?? process.env.ORACLE_WALLET_LOCATION,
    walletPassword: opts.walletPassword ?? process.env.ORACLE_WALLET_PASSWORD,
    poolMin: opts.poolMin,
    poolMax: opts.poolMax,
    poolIncrement: opts.poolIncrement,
    poolTimeout: opts.poolTimeout,
  };
}

const oraclePlugin: FastifyPluginAsync<OracleConfig> = async (fastify, opts) => {
  const config = resolveConfig(opts);

  const poolAttrs: Record<string, unknown> = {
    user: config.user,
    password: config.password,
    connectString: config.connectString,
    poolMin: config.poolMin ?? 2,
    poolMax: config.poolMax ?? 10,
    poolIncrement: config.poolIncrement ?? 2,
    poolTimeout: config.poolTimeout ?? 60,
  };

  if (config.walletLocation) {
    poolAttrs.configDir = config.walletLocation;
    poolAttrs.walletLocation = config.walletLocation;
    poolAttrs.walletPassword = config.walletPassword;
  }

  const pool: OraclePool = await oracledb.createPool(poolAttrs);

  fastify.decorate('oracle', pool);

  fastify.decorate('withConnection', async <T>(fn: (conn: OracleConnection) => Promise<T>): Promise<T> => {
    const conn = await pool.getConnection();
    try {
      return await fn(conn);
    } finally {
      await conn.close();
    }
  });

  fastify.addHook('onClose', async () => {
    await pool.close(10);
  });
};

export function getPoolStats(
  fastify: FastifyInstance
): { connectionsOpen: number; connectionsInUse: number; poolMin: number; poolMax: number } | null {
  if (!fastify.hasDecorator('oracle')) {
    return null;
  }

  const pool = fastify.oracle;
  return {
    connectionsOpen: pool.connectionsOpen,
    connectionsInUse: pool.connectionsInUse,
    poolMin: pool.poolMin,
    poolMax: pool.poolMax,
  };
}

export default fp(oraclePlugin, {
  name: 'oracle',
  fastify: '5.x',
});
