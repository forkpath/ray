import nx from '@nx/eslint-plugin'

import baseConfig, { noParentRelativeImports, typescriptOverrides } from '../../eslint.config.mjs'

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  typescriptOverrides,
  ...noParentRelativeImports(),
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {}
  }
]
