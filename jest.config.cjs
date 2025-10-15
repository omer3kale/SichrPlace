/** @type {import('jest').Config} */
module.exports = {
  testTimeout: 15000,
  coverageProvider: 'v8',
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'js/backend/**/*.js',
    'netlify/functions/**/*.{js,mjs}',
    'frontend/**/*.js',
    '!**/*.test.{js,mjs}',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/.netlify/**'
  ],
  forceExit: true,
  detectOpenHandles: true,
  projects: [
    {
      displayName: 'backend-commonjs',
      rootDir: '<rootDir>',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/js/backend/tests/**/*.test.js'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/.netlify/',
        '/js/backend/tests/integration/',
        '/js/backend/tests/step9-.*\\.test\\.js',
        '/js/backend/tests/.*-real-.*\\.test\\.js',
        '/js/backend/tests/step[0-9]+-.*\\.test\\.js',
        '/js/backend/tests/analytics-dashboard-service\\.test\\.js',
        '/js/backend/tests/analytics-dashboard-service\\.mocked\\.test\\.js'
      ],
      setupFiles: ['dotenv/config'],
      setupFilesAfterEnv: ['<rootDir>/js/backend/tests/test-setup.js'],
      transform: {},
      transformIgnorePatterns: ['/node_modules/(?!(chai)/)'],
      moduleNameMapper: {
        '^~/(.*)$': '<rootDir>/$1'
      },
      maxWorkers: 1
    },
    {
      displayName: 'netlify-functions',
      rootDir: '<rootDir>',
  testEnvironment: 'node',
      testMatch: [
        '<rootDir>/netlify/functions/**/*.test.js',
        '<rootDir>/netlify/functions/**/*.test.mjs'
      ],
      testPathIgnorePatterns: ['/node_modules/', '/.netlify/'],
      setupFiles: ['dotenv/config'],
      setupFilesAfterEnv: ['<rootDir>/netlify/functions/__tests__/setup.js'],
      transform: {
        '^.+\\.(js|mjs)$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]], babelrc: false, configFile: false }]
      },
      transformIgnorePatterns: ['/node_modules/'],
      moduleNameMapper: {
        '^~/(.*)$': '<rootDir>/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1'
      },
      maxWorkers: 1
    },
    {
      displayName: 'frontend-js',
      rootDir: '<rootDir>',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/frontend/**/*.test.js'],
      testPathIgnorePatterns: ['/node_modules/', '/.netlify/'],
      setupFilesAfterEnv: ['<rootDir>/frontend/__tests__/setup.js'],
      transform: {
        '^.+\\.js$': ['babel-jest']
      },
      moduleNameMapper: {
        '^~/(.*)$': '<rootDir>/$1'
      }
    }
  ]
};

