/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/test/**/*.spec.ts',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '\\.e2e-spec\\.ts$',
  ],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@langchain/google-genai$': '<rootDir>/src/__mocks__/gemini.mock.ts',
  },
  collectCoverageFrom: [
    'src/clarification/**/*.ts',
    'src/architecture/diagram.service.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};
