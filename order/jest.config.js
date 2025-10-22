/**
 * Jest configuration for the Order service.
 * - Uses Node test environment
 * - Loads test setup (in-memory Mongo, env)
 */
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js', '**/tests/**/*.test.js'],
  clearMocks: true,
  verbose: false,
};
