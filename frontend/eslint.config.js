// ESLint v9 — Flat config
// Setup conçu pour RZI CAMP (Vite + React 18 + JSX)
//
// ⚠️ Ce setup aurait attrapé les 3 bugs successifs en prod :
//   1. `{err}` dans JSX alors que le state est `error`  → react/jsx-no-undef
//   2. `handleLogin()` non déclaré                       → no-undef
//   3. `showForgot` non déclaré                         → no-undef

import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  // 1. Fichiers à ignorer
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      '*.config.js',
      'concept-v2/**', // prototype HTML statique
    ],
  },

  // 2. Config de base
  js.configs.recommended,

  // 3. Globals navigateur
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Globaux custom du projet
        __API_BASE__: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // 4. Règles React
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: '18.2' },
    },
    rules: {
      // ════════════════════════════════════════════════
      // CRITIQUES — auraient attrapé les 3 bugs prod
      // ════════════════════════════════════════════════
      'no-undef': 'error',                  // err, handleLogin, showForgot
      'react/jsx-no-undef': 'error',        // {err}, {handleLogin}, {showForgot}

      // ════════════════════════════════════════════════
      // RECOMMANDÉES — erreurs classiques React
      // ════════════════════════════════════════════════
      'react/jsx-uses-react': 'off',        // Plus nécessaire en React 17+
      'react/react-in-jsx-scope': 'off',    // Idem
      'react/prop-types': 'warn',           // Props non validés
      'react-hooks/rules-of-hooks': 'error',  // hooks en haut, pas dans conditions
      'react-hooks/exhaustive-deps': 'warn',  // deps manquantes dans useEffect
      'react-refresh/only-export-components': 'off', // On a des helpers non-composants

      // ════════════════════════════════════════════════
      // QUALITÉ — bugs subtils
      // ════════════════════════════════════════════════
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-throw-literal': 'error',
      'no-return-await': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],  // catch {} silencieux autorisés
      'no-useless-escape': 'warn',
      'no-irregular-whitespace': 'warn',

      // JSX
      'react/jsx-key': 'warn',
      'react/jsx-no-duplicate-props': 'error',
      'react/self-closing-comp': 'warn',
      'react/no-unescaped-entities': 'off', // FR: apostrophes OK
    },
  },

  // 5. Règles spécifiques pour les fichiers de hooks/
  {
    files: ['src/hooks/**/*.{js,jsx}'],
    rules: {
      'react-hooks/exhaustive-deps': 'error', // strict en hooks/
    },
  },

  // 6. Règles spécifiques pour le code de prod (Vite env)
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]
