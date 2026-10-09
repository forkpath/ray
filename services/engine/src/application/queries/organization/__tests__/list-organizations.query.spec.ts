import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Test } from '@nestjs/testing'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ListOrganizationsHandler,
  ListOrganizationsQuery
} from '~/application/queries/organization/list-organizations.query'
import { ListOrganizationsUseCase } from '~/application/use-cases/organization/list-organizations.usecase'

describe('ListOrganizationsHandler', () => {
  let handler: ListOrganizationsHandler
  const mockRepo = { findAll: vi.fn() }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListOrganizationsHandler,
        {
          provide: ListOrganizationsUseCase,
          useValue: new ListOrganizationsUseCase(mockRepo as unknown as IOrganizationRepository)
        }
      ]
    }).compile()

    handler = module.get(ListOrganizationsHandler)
    vi.clearAllMocks()
  })

  it('should return paginated organizations with max members', async () => {
    const repoResult = {
      list: [
        {
          id: 'o1',
          name: 'Org',
          slug: 'org',
          logo: null,
          createdAt: new Date(),
          membersCount: 5
        }
      ],
      total: 1,
      max: { members: 5 }
    }
    mockRepo.findAll.mockResolvedValue(repoResult)

    const result = await handler.execute(new ListOrganizationsQuery({ page: 1, perPage: 10 }))

    expect(result.total).toBe(1)
    expect(result.max.members).toBe(5)
    expect(result.list[0].members).toBe(5)
  })

  it('should handle empty results', async () => {
    mockRepo.findAll.mockResolvedValue({
      list: [],
      total: 0,
      max: { members: 0 }
    })

    const result = await handler.execute(new ListOrganizationsQuery({ page: 1, perPage: 10 }))

    expect(result.list).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
