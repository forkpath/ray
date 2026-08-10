import nx from '@nx/eslint-plugin'
import importPlugin from 'eslint-plugin-import'

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    plugins: {
      import: importPlugin
    }
  },
  {
    ignores: [
      '**/build',
      '**/dist',
      '**/out-tsc',
      '**/.output',
      '**/.vite',
      '**/.vite/**',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/.expo',
      '**/.wxt',
      '**/libs/pg-dao/src/generated/**'
    ]
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'runtime:universal',
              onlyDependOnLibsWithTags: ['runtime:universal', 'boundary:facade']
            },
            {
              sourceTag: 'runtime:web',
              onlyDependOnLibsWithTags: ['runtime:web', 'runtime:universal', 'boundary:facade']
            },
            {
              sourceTag: 'runtime:native',
              onlyDependOnLibsWithTags: ['runtime:native', 'runtime:universal', 'boundary:facade']
            },
            {
              sourceTag: 'runtime:node',
              onlyDependOnLibsWithTags: ['runtime:node', 'runtime:universal', 'boundary:facade']
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:data-access',
                'type:contract',
                'type:ui',
                'type:util',
                'type:platform',
                'boundary:facade'
              ]
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:data-access',
                'type:contract',
                'type:ui',
                'type:util',
                'type:platform',
                'boundary:facade'
              ]
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:contract', 'type:util', 'type:platform', 'boundary:facade']
            },
            {
              sourceTag: 'type:contract',
              onlyDependOnLibsWithTags: ['type:contract', 'type:util']
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:contract', 'type:util']
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util', 'type:contract']
            },
            {
              sourceTag: 'type:platform',
              onlyDependOnLibsWithTags: [
                'type:platform',
                'type:data-access',
                'type:contract',
                'type:util',
                'boundary:facade'
              ]
            },
            {
              sourceTag: 'domain:shared',
              onlyDependOnLibsWithTags: ['domain:shared', 'domain:platform', 'boundary:facade']
            },
            {
              sourceTag: 'domain:platform',
              onlyDependOnLibsWithTags: ['domain:platform', 'domain:shared', 'boundary:facade']
            },
            {
              sourceTag: 'domain:auth',
              onlyDependOnLibsWithTags: ['domain:auth', 'domain:shared', 'domain:platform', 'boundary:facade']
            },
            {
              sourceTag: 'domain:billing',
              onlyDependOnLibsWithTags: [
                'domain:billing',
                'boundary:auth-contract',
                'domain:shared',
                'domain:platform',
                'boundary:facade'
              ]
            },
            {
              sourceTag: 'domain:organization',
              onlyDependOnLibsWithTags: [
                'domain:organization',
                'boundary:auth-contract',
                'domain:shared',
                'domain:platform',
                'boundary:facade'
              ]
            },
            {
              sourceTag: 'domain:composition',
              onlyDependOnLibsWithTags: [
                'domain:composition',
                'domain:auth',
                'domain:billing',
                'domain:organization',
                'domain:shared',
                'domain:platform',
                'boundary:facade'
              ]
            }
          ]
        }
      ]
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    // Override or add rules here
    rules: {}
  },
  {
    files: ['*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'error',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/explicit-member-accessibility': [
        'off',
        {
          accessibility: 'explicit'
        }
      ],
      '@typescript-eslint/member-ordering': 'error',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-inferrable-types': [
        'error',
        {
          ignoreParameters: true
        }
      ],
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-shadow': [
        'error',
        {
          hoist: 'all'
        }
      ],
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/unified-signatures': 'error',
      'arrow-body-style': 'off',
      'constructor-super': 'error',
      eqeqeq: ['error', 'smart'],
      'guard-for-in': 'error',
      'id-blacklist': 'off',
      'id-match': 'off',
      'import/no-deprecated': 'warn',
      'no-bitwise': 'error',
      'no-caller': 'error',
      'no-console': [
        'error',
        {
          allow: [
            'log',
            'warn',
            'dir',
            'timeLog',
            'assert',
            'clear',
            'count',
            'countReset',
            'group',
            'groupEnd',
            'table',
            'dirxml',
            'error',
            'groupCollapsed',
            'Console',
            'profile',
            'profileEnd',
            'timeStamp',
            'context'
          ]
        }
      ],
      'no-debugger': 'error',
      'no-empty': 'off',
      'no-eval': 'error',
      'no-fallthrough': 'error',
      'no-new-wrappers': 'error',
      'no-restricted-imports': ['error', 'rxjs/Rx'],
      'no-throw-literal': 'error',
      'no-undef-init': 'error',
      'no-underscore-dangle': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      radix: 'error'
    }
  }
]
