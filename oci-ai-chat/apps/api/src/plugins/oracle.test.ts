import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Mock oracledb before importing the plugin
const mockPool = {
  getConnection: vi.fn(),
  close: vi.fn(),
  connectionsOpen: 3,
  connectionsInUse: 1,
  poolMin: 2,
  poolMax: 10,
};

const mockConnection = {
  execute: vi.fn(),
  close: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
};

vi.mock('oracledb', () => {
  const OUT_FORMAT_OBJECT = 4001;
  return {
    default: {
      createPool: vi.fn().mockResolvedValue(mockPool),
      outFormat: OUT_FORMAT_OBJECT,
      autoCommit: true,
      OUT_FORMAT_OBJECT,
    },
  };
});

// Import plugin after mocks are set up
const { default: oraclePlugin, getPoolStats } = await import('./oracle.js');

describe('oracle plugin', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.getConnection.mockResolvedValue(mockConnection);
    mockPool.close.mockResolvedValue(undefined);
    mockConnection.close.mockResolvedValue(undefined);
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('registration', () => {
    it('initializes connection pool on ready', async () => {
      const oracledb = (await import('oracledb')).default;

      await app.register(oraclePlugin, {
        user: 'testuser',
        password: 'testpass',
        connectString: 'localhost/XEPDB1',
      });

      await app.ready();

      expect(oracledb.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'testuser',
          password: 'testpass',
          connectString: 'localhost/XEPDB1',
          poolMin: 2,
          poolMax: 10,
          poolIncrement: 2,
          poolTimeout: 60,
        })
      );
    });

    it('passes wallet config when provided', async () => {
      const oracledb = (await import('oracledb')).default;

      await app.register(oraclePlugin, {
        user: 'admin',
        password: 'secret',
        connectString: 'adb_high',
        walletLocation: '/wallets/adb',
        walletPassword: 'walletpw',
      });

      await app.ready();

      expect(oracledb.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          configDir: '/wallets/adb',
          walletLocation: '/wallets/adb',
          walletPassword: 'walletpw',
        })
      );
    });

    it('respects custom pool sizing options', async () => {
      const oracledb = (await import('oracledb')).default;

      await app.register(oraclePlugin, {
        user: 'u',
        password: 'p',
        connectString: 'db',
        poolMin: 5,
        poolMax: 20,
        poolIncrement: 5,
        poolTimeout: 120,
      });

      await app.ready();

      expect(oracledb.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          poolMin: 5,
          poolMax: 20,
          poolIncrement: 5,
          poolTimeout: 120,
        })
      );
    });
  });

  describe('fastify.oracle decorator', () => {
    it('decorates fastify with oracle pool reference', async () => {
      await app.register(oraclePlugin, {
        user: 'u',
        password: 'p',
        connectString: 'db',
      });

      await app.ready();

      expect(app.oracle).toBe(mockPool);
    });
  });

  describe('fastify.withConnection', () => {
    it('borrows connection, executes callback, and releases', async () => {
      mockConnection.execute.mockResolvedValue({ rows: [{ id: 1 }] });

      await app.register(oraclePlugin, {
        user: 'u',
        password: 'p',
        connectString: 'db',
      });

      await app.ready();

      const result = await app.withConnection(async (conn) => {
        const res = await conn.execute('SELECT 1 FROM DUAL');
        return res.rows;
      });

      expect(result).toEqual([{ id: 1 }]);
      expect(mockPool.getConnection).toHaveBeenCalledOnce();
      expect(mockConnection.close).toHaveBeenCalledOnce();
    });

    it('releases connection even when callback throws', async () => {
      await app.register(oraclePlugin, {
        user: 'u',
        password: 'p',
        connectString: 'db',
      });

      await app.ready();

      await expect(
        app.withConnection(async () => {
          throw new Error('query failed');
        })
      ).rejects.toThrow('query failed');

      expect(mockConnection.close).toHaveBeenCalledOnce();
    });

    it('propagates the original error from callback', async () => {
      await app.register(oraclePlugin, {
        user: 'u',
        password: 'p',
        connectString: 'db',
      });

      await app.ready();

      const specificError = new Error('ORA-00942: table or view does not exist');

      await expect(
        app.withConnection(async () => {
          throw specificError;
        })
      ).rejects.toThrow(specificError);
    });
  });

  describe('graceful shutdown', () => {
    it('drains and closes pool on app close', async () => {
      await app.register(oraclePlugin, {
        user: 'u',
        password: 'p',
        connectString: 'db',
      });

      await app.ready();
      await app.close();

      expect(mockPool.close).toHaveBeenCalledWith(10);
    });
  });

  describe('getPoolStats', () => {
    it('returns pool statistics after initialization', async () => {
      await app.register(oraclePlugin, {
        user: 'u',
        password: 'p',
        connectString: 'db',
      });

      await app.ready();

      const stats = getPoolStats(app);

      expect(stats).toEqual({
        connectionsOpen: 3,
        connectionsInUse: 1,
        poolMin: 2,
        poolMax: 10,
      });
    });

    it('returns null when plugin is not registered', () => {
      // app without oracle plugin
      const plainApp = Fastify();
      const stats = getPoolStats(plainApp);
      expect(stats).toBeNull();
    });
  });

  describe('env var config fallback', () => {
    it('reads config from environment when options are empty strings', async () => {
      const oracledb = (await import('oracledb')).default;

      const originalEnv = { ...process.env };
      process.env.ORACLE_USER = 'envuser';
      process.env.ORACLE_PASSWORD = 'envpass';
      process.env.ORACLE_CONNECT_STRING = 'envdb';

      try {
        await app.register(oraclePlugin, {
          user: '',
          password: '',
          connectString: '',
        });

        await app.ready();

        expect(oracledb.createPool).toHaveBeenCalledWith(
          expect.objectContaining({
            user: 'envuser',
            password: 'envpass',
            connectString: 'envdb',
          })
        );
      } finally {
        process.env = originalEnv;
      }
    });

    it('falls back to ORACLE_DSN when ORACLE_CONNECT_STRING is not set', async () => {
      const oracledb = (await import('oracledb')).default;

      const originalEnv = { ...process.env };
      delete process.env.ORACLE_CONNECT_STRING;
      process.env.ORACLE_DSN = 'dsn_fallback';
      process.env.ORACLE_USER = 'u';
      process.env.ORACLE_PASSWORD = 'p';

      try {
        await app.register(oraclePlugin, {
          user: '',
          password: '',
          connectString: '',
        });

        await app.ready();

        expect(oracledb.createPool).toHaveBeenCalledWith(
          expect.objectContaining({
            connectString: 'dsn_fallback',
          })
        );
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('oracledb global settings', () => {
    it('sets OUT_FORMAT_OBJECT and autoCommit', async () => {
      const oracledb = (await import('oracledb')).default;

      // The plugin should set these on import/registration
      await app.register(oraclePlugin, {
        user: 'u',
        password: 'p',
        connectString: 'db',
      });

      await app.ready();

      expect(oracledb.outFormat).toBe(oracledb.OUT_FORMAT_OBJECT);
      expect(oracledb.autoCommit).toBe(true);
    });
  });
});
