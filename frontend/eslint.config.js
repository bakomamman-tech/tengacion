import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Ignore build artifacts
  globalIgnores(['dist', 'node_modules']),

  {
    files: ['**/*.{js,jsx}'],

    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      globals: {
        ...globals.browser,
        process: 'readonly',
        console: 'readonly',
      },

      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },

    rules: {
      /* ===== CORE QUALITY ===== */
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^_',
        },
      ],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',

      /* ===== REACT / HOOKS ===== */
      'react-hooks/exhaustive-deps': 'warn',

      /* ===== STYLE (FACEBOOK-LIKE) ===== */
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'prefer-const': 'error',

      'arrow-body-style': ['warn', 'as-needed'],
      'object-shorthand': 'warn',

      /* ===== SAFETY ===== */
      'no-unsafe-optional-chaining': 'error',
      'no-duplicate-imports': 'error',

    },
  },
])
