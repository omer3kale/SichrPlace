module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  extends: ['eslint:recommended'],
  ignorePatterns: [
    'node_modules/',
    'docs/',
    'supabase/',
    'coverage/',
    'dist/',
    'build/',
    '**/*.sql',
    '.netlify/',
    'js/backend/legacy-mongodb/',
    'js/paypalstandard/',
    'js/google-apps-script/'
  ],
  rules: {
    'no-console': 'off',
    'no-undef': 'error',
    'no-unused-vars': [
      'warn',
      {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'no-inner-declarations': 'off',
    'no-prototype-builtins': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/__tests__/**/*.js', 'tests/**/*.js'],
      env: {
        jest: true,
        mocha: true,
      },
      rules: {
        'no-unused-expressions': 'off',
      },
    },
    {
      files: ['**/*.mjs'],
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest'
      },
      env: {
        es2021: true,
        node: true
      },
      rules: {
        'no-undef': 'off' // ESM has different scope rules
      }
    },
    {
      files: ['frontend/js/**/*.js', 'frontend/__tests__/**/*.js'],
      env: {
        browser: true,
        es2021: true
      },
      parserOptions: {
        sourceType: 'module'
      }
    },
    {
      files: ['netlify/functions/**/*.mjs'],
      env: {
        node: true,
        es2021: true
      },
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest'
      }
    }
  ]
};
