import { defineConfig } from 'eslint-config-hyoban'

export default defineConfig(
  {
    formatting: false,
  },
  {
    rules: {
      'antfu/top-level-function': 'off',
      'unicorn/prefer-event-target': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/prefer-for-of': 'off',
      'unicorn/no-for-loop': 'off',
    },
  },
)
