import { builtinModules } from 'node:module'

import nx from '@nx/eslint-plugin'
import importPlugin from 'eslint-plugin-import'

// The TypeScript compiler checks redeclarations and permits overloads and
// value/type pairs. ESLint's JS rule cannot distinguish those namespaces.
export const typescriptOverrides = {
  files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
  rules: {
    'no-redeclare': 'off',
    '@typescript-eslint/no-unsafe-declaration-merging': 'error'
  }
}

const persistenceAndSdkPackages = [
  '@libs/pg-dao',
  '@libs/mongo-dao',
  '@prisma/*',
  'mongoose',
  'ioredis',
  'amqplib',
  'stripe',
  '@aws-sdk/*'
]

function layerImportRule(layers, packages, message) {
  return [
    'error',
    {
      patterns: [
        { group: packages, message },
        { regex: `(^~/|(^|/)\\.\\.?/(.*/)?)(${layers.join('|')})(/|$)`, message }
      ]
    }
  ]
}

// Clean Architecture boundaries for a Nest service: Domain and Application
// depend on ports; persistence and SDK adapters live in infrastructure.
export function cleanArchitectureBoundaries(srcRoot = 'src') {
  return [
    {
      files: [`${srcRoot}/application/**/*.ts`],
      rules: {
        'no-restricted-imports': layerImportRule(
          ['infrastructure', 'presentation', 'app'],
          persistenceAndSdkPackages,
          'Application code depends on domain ports. Implement adapters in infrastructure.'
        )
      }
    },
    {
      files: [`${srcRoot}/domain/**/*.ts`],
      rules: {
        'no-restricted-imports': layerImportRule(
          ['application', 'infrastructure', 'presentation', 'app'],
          [...persistenceAndSdkPackages, '@nestjs/*'],
          'Domain code must stay framework- and persistence-free.'
        )
      }
    }
  ]
}

// Apps and services import their own files with `./` (same directory or below) or the
// project alias `~/` (-> <project>/src). Parent paths (`../`) are rejected; static assets
// outside src (images, JSON) stay relative. Libs keep relative imports because Nx module
// boundaries reject self-imports through an alias. A separate rule name keeps this from
// replacing the core no-restricted-imports used by cleanArchitectureBoundaries().
export function noParentRelativeImports(roots = ['src', 'tests']) {
  return [
    {
      files: roots.map(root => `${root}/**/*.{ts,tsx}`),
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                regex: '^\\.\\.(/(?!.*\\.(png|jpe?g|gif|webp|svg|json)$)|$)',
                message: "Use the project alias '~/' instead of a parent-relative path."
              }
            ]
          }
        ]
      }
    }
  ]
}

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  typescriptOverrides,
  ...noParentRelativeImports(['apps/mobile/src', 'apps/extension/src']),
  {
    files: ['libs/{email,analytics,monitoring}/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: builtinModules.filter(name => !name.startsWith('node:')),
          patterns: [
            {
              group: [
                'node:*',
                'envin',
                'envin/*',
                'posthog-*',
                '@posthog/*',
                '@sentry/*',
                '@aws-sdk/*',
                '@alicloud/*',
                '@nestjs/*',
                'react-native',
                'expo',
                'expo-*',
                'resend'
              ],
              message:
                'Universal core cannot import runtime SDKs or evaluate environment configuration. Use the matching runtime project.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['{apps,services,libs}/**/src/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', '**/tests/**', 'libs/testing-server/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportDeclaration[source.value='@libs/testing-server']",
          message: 'Server test fixtures may only be imported from test code.'
        }
      ]
    }
  },
  {
    plugins: {
      import: importPlugin
    }
  },
  {
    ignores: [
      '**/build',
      '**/build-e2e',
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
              onlyDependOnLibsWithTags: ['runtime:universal']
            },
            {
              sourceTag: 'runtime:web',
              onlyDependOnLibsWithTags: ['runtime:web', 'runtime:universal']
            },
            {
              sourceTag: 'runtime:native',
              onlyDependOnLibsWithTags: ['runtime:native', 'runtime:universal']
            },
            {
              sourceTag: 'runtime:node',
              onlyDependOnLibsWithTags: ['runtime:node', 'runtime:universal']
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util']
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
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:data-access', 'type:platform', 'type:contract', 'type:util']
            },
            {
              sourceTag: 'type:platform',
              onlyDependOnLibsWithTags: ['type:platform', 'type:data-access', 'type:ui', 'type:contract', 'type:util']
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:data-access',
                'type:ui',
                'type:platform',
                'type:contract',
                'type:util'
              ]
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:data-access',
                'type:ui',
                'type:platform',
                'type:contract',
                'type:util'
              ]
            },
            {
              sourceTag: 'domain:shared',
              onlyDependOnLibsWithTags: ['domain:shared', 'domain:platform']
            },
            {
              sourceTag: 'domain:platform',
              onlyDependOnLibsWithTags: ['domain:platform', 'domain:shared']
            },
            {
              sourceTag: 'domain:auth',
              onlyDependOnLibsWithTags: ['domain:auth', 'domain:shared', 'domain:platform']
            },
            {
              sourceTag: 'domain:billing',
              onlyDependOnLibsWithTags: ['domain:billing', 'domain:auth', 'domain:shared', 'domain:platform']
            },
            {
              sourceTag: 'domain:composition',
              onlyDependOnLibsWithTags: [
                'domain:composition',
                'domain:auth',
                'domain:billing',
                'domain:organization',
                'domain:shared',
                'domain:platform'
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
