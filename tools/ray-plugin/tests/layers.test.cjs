const assert = require('node:assert/strict')
const { test } = require('node:test')
const { checkLayers, checkWorkspace } = require('../src/check-layers.cjs')
const { resolve } = require('node:path')

test('generated resources obey layer boundaries in this workspace', () => {
  assert.deepEqual(checkWorkspace(resolve(__dirname, '../../..')), [])
})
test('detects forbidden direct, alias, barrel, type, dynamic and require dependencies', () => {
  for (const [entry, source, extra] of [
    ['domain/note/entity.ts', "import { prisma } from '@libs/pg-dao'"],
    [
      'domain/note/entity.ts',
      "export * from './barrel'",
      ['domain/note/barrel.ts', "export * from '~/infrastructure/repositories/note/repository'"]
    ],
    [
      'application/use-cases/note/use-case.ts',
      "import { Repository } from '~/infrastructure/repositories/note/repository'"
    ],
    ['application/commands/note/handler.ts', "const db = require('@libs/pg-dao')"],
    ['application/queries/note/handler.ts', "const db = import('@libs/pg-dao')"],
    ['domain/note/entity.ts', "type Record = import('@libs/pg-dao').Prisma"],
    ['application/use-cases/note/use-case.ts', 'const driver = import(variable)']
  ]) {
    const path = 'services/engine/src/' + entry
    const files = new Map([[path, source]])
    if (extra) files.set('services/engine/src/' + extra[0], extra[1])
    assert.ok(checkLayers(files, [path], { '~/*': ['services/engine/src/*'] }).length, source)
  }
})
test('permits pure domain/use case dependencies and CQRS adapters', () => {
  const files = new Map([
    [
      'services/engine/src/application/commands/note/create.ts',
      "import { Command } from '@nestjs/cqrs'; import { Create } from '../../use-cases/note/create'"
    ],
    [
      'services/engine/src/application/use-cases/note/create.ts',
      "import { Entity } from '../../../domain/note/entity'"
    ],
    ['services/engine/src/domain/note/entity.ts', 'export class Entity {}']
  ])
  assert.deepEqual(checkLayers(files, [...files.keys()]), [])
})
