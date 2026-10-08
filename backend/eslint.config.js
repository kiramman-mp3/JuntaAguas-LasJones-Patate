const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // .wwebjs_*: sesiones de WhatsApp que guardaba el backend antes de existir whatsapp-service/.
  { ignores: ['node_modules/**', 'uploads/**', '.wwebjs_auth/**', '.wwebjs_cache/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart']
    }
  }
];
