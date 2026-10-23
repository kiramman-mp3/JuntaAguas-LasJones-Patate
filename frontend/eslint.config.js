// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/*
 * Todas las reglas son 'error': la deuda que se migraba por etapas ya está saldada y un error rompe el CI,
 * así no vuelve a acumularse (any explícitos, inyección por constructor, *ngIf, etiquetas sin control).
 */
module.exports = defineConfig([
  { ignores: ['dist/**', '.angular/**', 'coverage/**'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    // En las pruebas los dobles de servicios se escriben con `as any` a propósito.
    files: ['**/*.spec.ts', 'src/app/testing/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-empty-function': 'off' },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/label-has-associated-control': 'error',
    },
  },
]);
