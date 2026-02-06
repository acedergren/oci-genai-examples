module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '.*\\.integration\\.test\\.ts$'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/index.ts', // Barrel exports don't need coverage
    '!src/types.ts', // Type definitions don't need coverage
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
  ],
  coverageDirectory: '<rootDir>/coverage',
  // Don't apply the .js -> no extension mapping to node_modules
  moduleNameMapper: {
    '^(\\.{1,2}/(?!.*node_modules).*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: false,
      },
    ],
  },
  // Fail fast on first test failure in CI
  bail: process.env.CI ? 1 : 0,
  // Show individual test results
  verbose: true,
  // Detect open handles that prevent Jest from exiting
  detectOpenHandles: true,
  // Force exit after tests complete (for OCI SDK cleanup)
  forceExit: true,
};