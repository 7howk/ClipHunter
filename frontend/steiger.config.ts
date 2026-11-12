import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Сущности повторяют домен API (clip, system), а фичи — действия пользователя.
    // Сливать их с единственным потребителем значит смешивать слои, поэтому правило выключено.
    files: ['./src/entities/**', './src/features/**'],
    rules: { 'fsd/insignificant-slice': 'off' },
  },
]);
