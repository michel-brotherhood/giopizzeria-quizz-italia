import { defineConfig } from 'vitest/config';

// Testes unitários (sem banco). Config própria para não herdar root: 'web' do vite.config.js.
export default defineConfig({
  root: import.meta.dirname,
  test: { include: ['tests/unit/**/*.test.js'] },
});
