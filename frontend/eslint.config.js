// ESLint flat config (eslint 9), migrated from .eslintrc.cjs.
//
// The old setup could never run: .eslintrc.cjs used the legacy format that
// eslint 9 no longer reads, and eslint itself was not even in devDependencies,
// so `npm run lint` failed with "'eslint' is not recognized".
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,

      // Carried over from .eslintrc.cjs: the automatic JSX runtime means React
      // needs no import, and prop-types are not used anywhere in this codebase.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // Apostrophes in JSX text render correctly; escaping them hurts the
      // readability of the copy without changing the output.
      'react/no-unescaped-entities': 'off',

      // react-hooks 7 ships the React-Compiler-era correctness rules. They flag
      // genuine patterns worth revisiting, but they are new rules meeting
      // pre-existing components — warn so `lint` stays a usable signal instead
      // of a wall of errors, and fix them deliberately rather than in bulk.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',

      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  {
    // react-three-fiber renders three.js objects as JSX, so <mesh geometry=…>,
    // <meshStandardMaterial roughness=…> and friends are valid elements that
    // eslint-plugin-react has no schema for — it only knows the DOM.
    files: ['src/components/landing/**/*.jsx', 'src/components/{HeroCanvas,VeinPulse}.jsx'],
    rules: { 'react/no-unknown-property': 'off' },
  },
];
