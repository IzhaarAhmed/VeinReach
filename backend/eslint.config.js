// ESLint flat config (eslint 9). The `lint` script had never worked: eslint 9
// dropped .eslintrc lookup and no config file existed, so `npm run lint` exited
// with "couldn't find an eslint.config file" rather than linting anything.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module', // package.json sets "type": "module"
      globals: { ...globals.node },
    },
    rules: {
      // `_`-prefixed args are the codebase's existing convention for the
      // deliberately-unused ones Express hands you (`_req`, `_next`).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Logging goes through utils/logger.js; a bare console is almost always a
      // leftover debug statement. config/env.js opts out inline, on purpose:
      // it must report missing vars before the logger is safe to import.
      'no-console': 'warn',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    // node:test injects describe/it/before as globals under the test runner.
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    // Operator-facing CLI scripts: stdout is the interface, not stray debugging.
    files: ['src/scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
];
