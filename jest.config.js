module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '\\.e2e\\.test\\.js$', '/tower-defense/'],
  transform: {
    'game-logic\\.js$': './jest-transform-esm.js',
  },
  collectCoverageFrom: ['bertymon/game-logic.js', '!node_modules/**'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
