import type {
  ICustomerRepository,
  ListCustomersCriteria,
  PagedCustomerResult
} from '~/domain/repositories/customer.repository.interface'

export class ListCustomersUseCase {
  constructor(private readonly repository: ICustomerRepository) {}

  execute(criteria: ListCustomersCriteria): Promise<PagedCustomerResult> {
    return this.repository.findAll(criteria)
  }
}
