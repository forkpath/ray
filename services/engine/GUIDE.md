# Engine 业务接口开发指南

这份文档总结在 `services/engine` 中新增一个业务接口的标准流程。目标是让每个接口从 `@libs/payload` 的契约定义，到 `presentation` 层的 HTTP 入口，都遵循 Clean Architecture + CQRS 的同一条链路。

## 总体依赖方向

Engine 内部依赖只能由外向内，不能反向：

```text
presentation/http
  -> application
    -> domain

infrastructure
  -> domain
```

跨包依赖的基本规则：

```text
@libs/common  -> @libs/payload -> application/presentation
domain        -> 不依赖 @libs/*、NestJS、Prisma、payload DTO
application   -> 可依赖 domain、@libs/payload、@nestjs/cqrs
infrastructure-> 可依赖 domain、Prisma、better-auth、外部 SDK
presentation  -> 可依赖 application DTO、Command/Query、NestJS 装饰器
```

`domain` 是业务核心，不能导入 `@libs/payload`、`@nestjs/*`、`@libs/pg-dao`、`@libs/auth-server`。`repository.interface.ts` 只能使用 domain entity、VO、criteria/result 类型。

## 一条接口的落地路径

### 1. 常量定义：`libs/common`

如果新业务引入枚举式值，例如状态、角色、provider，先定义在：

```text
libs/common/src/constants/<domain>.ts
```

使用 `as const` + union type，不使用 `enum`。例如：

```typescript
export const FooStatus = {
  ACTIVE: 'active',
  DISABLED: 'disabled'
} as const

export type FooStatus = (typeof FooStatus)[keyof typeof FooStatus]
```

目的：让枚举值有唯一来源，避免 domain、payload、前端各自重复定义。

### 2. 接口契约：`@libs/payload`

先定义请求和响应 schema：

```text
libs/payload/src/schemas/<domain>/<domain>.schema.ts
libs/payload/src/schemas/<domain>/index.ts
libs/payload/src/index.ts
```

请求 schema 负责 HTTP 边界字段校验；响应 schema 负责前后端共享的接口形态。Engine 的 DTO 不重新写 schema，只包装 payload schema。

常见命名：

```typescript
export const getFoosReqSchema = ...
export type GetFoosReq = z.infer<typeof getFoosReqSchema>

export const getFoosResSchema = ...
export type GetFoosRes = z.infer<typeof getFoosResSchema>
```

目的：`payload` 是前后端接口契约，不是 domain model。它可以描述字段、分页、筛选、响应结构，但不承载业务行为。

### 3. Domain 层：业务模型与规则

目录：

```text
services/engine/src/domain/entities/<domain>.entity.ts
services/engine/src/domain/value-objects/<name>.vo.ts
services/engine/src/domain/repositories/<domain>.repository.interface.ts
services/engine/src/domain/exceptions/<domain>.exception.ts
```

#### Entity

Entity 必须是 class，不是只读 interface。它表达业务状态、行为和不变量：

```typescript
export class Foo {
  private constructor(
    private readonly fooId: FooId,
    private fooName: string
  ) {}

  static fromPersistence(data: FooPersistenceData): Foo {
    return new Foo(FooId.create(data.id), data.name)
  }

  get id(): FooId {
    return this.fooId
  }

  rename(name: string): void {
    this.fooName = name
  }
}
```

目的：业务规则集中在实体或领域服务中，而不是散落在 handler、repository 或 controller。

#### Value Object

VO 用于封装有业务含义的值，例如 ID、Email、Slug、Role、Status：

```typescript
export class FooId extends EntityId {
  private constructor(value: string) {
    super(value)
  }

  static create(id: string): FooId {
    return new FooId(id)
  }
}
```

保留 VO 的前提：它必须在 entity 字段、repository 签名或方法参数中真实使用，不能只是 `create()` 后丢弃。

#### Repository Interface

Repository interface 属于 domain，但只是抽象，不做 IO：

```typescript
export interface ListFoosCriteria {
  readonly page: number
  readonly perPage: number
  readonly q?: string
}

export interface PagedResult<T> {
  readonly list: T[]
  readonly total: number
}

export interface IFooRepository {
  findById(id: FooId): Promise<Foo | null>
  findMany(criteria: ListFoosCriteria): Promise<PagedResult<Foo>>
  update(id: FooId, data: UpdateFooData): Promise<Foo>
}

export const FOO_REPOSITORY = Symbol('FOO_REPOSITORY')
```

目的：application 只依赖抽象，infrastructure 负责实现。接口中禁止出现 `GetFoosReq`、`GetFoosRes`、`UpdateFooPayload` 等 payload 类型。

#### Domain Exception

领域异常继承 `DomainException`：

```typescript
export class FooNotFoundException extends FooDomainException {
  readonly code = 'FOO_NOT_FOUND'
  readonly i18nKey = 'foo.error.fooNotFound'
  readonly httpStatus = 404

  constructor(id: string) {
    super(`Foo with id ${id} not found`, { id })
  }
}
```

目的：领域层只表达错误语义；HTTP 状态码和 i18n key 由全局异常过滤器统一输出。

### 4. Application DTO：包装 payload schema

目录：

```text
services/engine/src/application/dtos/<domain>/<domain>.dto.ts
```

只使用 `createZodDto()` 包装 payload request schema：

```typescript
import { createZodDto } from 'nestjs-zod'
import { getFoosReqSchema, updateFooReqSchema } from '@libs/payload'

export class ListFoosQueryDto extends createZodDto(getFoosReqSchema) {}
export class UpdateFooDto extends createZodDto(updateFooReqSchema) {}
```

目的：DTO 是 HTTP 入参校验适配器，不重复定义 zod schema，不定义响应 schema。

### 5. Application Mapper：payload 与 domain 的转换边界

目录：

```text
services/engine/src/application/mappers/<domain>.mapper.ts
```

Mapper 负责两类转换：

```text
payload request -> domain criteria / command input
domain entity/result -> payload response
```

示例：

```typescript
export class FooMapper {
  static toListFoosCriteria(params: GetFoosReq): ListFoosCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      q: params.q
    }
  }

  static toFooResponse(entity: Foo): FooResponse {
    return {
      id: entity.id.toString(),
      name: entity.name
    }
  }
}
```

目的：把 `@libs/payload` 限定在 application 边界，避免 payload 类型污染 domain repository。

### 6. Application Use Case：应用编排

目录：

```text
services/engine/src/application/use-cases/<domain>/<action>.usecase.ts
```

写操作和复杂读操作放在 use case。它负责加载 entity、调用 entity 行为、调用 repository 持久化：

```typescript
export class UpdateFooUseCase {
  constructor(private readonly fooRepository: IFooRepository) {}

  async execute(input: UpdateFooInput): Promise<UpdateFooOutput> {
    const fooId = FooId.create(input.fooId)
    const foo = await this.fooRepository.findById(fooId)
    if (!foo) {
      throw new FooNotFoundException(input.fooId)
    }

    foo.rename(input.name)
    const updated = await this.fooRepository.update(fooId, { name: foo.name })
    return { foo: updated }
  }
}
```

目的：use case 表达“一次用户意图”的流程。它可以做 IO 编排，但不把业务不变量写在 handler 或 repository 中。

### 7. CQRS Query / Command Handler

目录：

```text
services/engine/src/application/queries/<domain>/<action>.query.ts
services/engine/src/application/commands/<domain>/<action>.command.ts
```

Query handler 通常读取 repository 并通过 mapper 返回 payload response：

```typescript
@QueryHandler(ListFoosQuery)
export class ListFoosHandler implements IQueryHandler<ListFoosQuery, GetFoosRes> {
  constructor(
    @Inject(FOO_REPOSITORY)
    private readonly fooRepository: IFooRepository
  ) {}

  async execute(query: ListFoosQuery): Promise<GetFoosRes> {
    const result = await this.fooRepository.findMany(FooMapper.toListFoosCriteria(query.params))
    return FooMapper.toFoosResponse(result)
  }
}
```

Command handler 应该很薄，只委托 use case，再交给 mapper：

```typescript
@CommandHandler(UpdateFooCommand)
export class UpdateFooHandler implements ICommandHandler<UpdateFooCommand, FooResponse> {
  private readonly useCase: UpdateFooUseCase

  constructor(
    @Inject(FOO_REPOSITORY)
    fooRepository: IFooRepository
  ) {
    this.useCase = new UpdateFooUseCase(fooRepository)
  }

  async execute(command: UpdateFooCommand): Promise<FooResponse> {
    const result = await this.useCase.execute(command.input)
    return FooMapper.toFooResponse(result.foo)
  }
}
```

目的：handler 是 NestJS CQRS 的适配层，不承载业务规则。

### 8. Infrastructure Repository：实现 domain 抽象

目录：

```text
services/engine/src/infrastructure/repositories/<domain>.repository.ts
```

Repository implementation 负责把 domain criteria 转成 Prisma / Better Auth / SDK 调用，并把持久化数据转回 entity：

```typescript
@Injectable()
export class FooRepository implements IFooRepository {
  async findById(id: FooId): Promise<Foo | null> {
    const row = await prisma.foo.findUnique({
      where: { id: id.getValue() }
    })

    return row ? this.mapToEntity(row) : null
  }

  private mapToEntity(row: FooRow): Foo {
    return Foo.fromPersistence({
      id: row.id,
      name: row.name
    })
  }
}
```

目的：隔离数据库、外部 SDK 和第三方服务。所有 Prisma 字段名、SQL、Better Auth API 调用都留在 infrastructure。

### 9. Presentation Controller：HTTP 入口

目录：

```text
services/engine/src/presentation/http/<domain>/<domain>.controller.ts
```

Controller 只负责 HTTP 路由、权限装饰器、DTO 接收，以及调用 `QueryBus` / `CommandBus`：

```typescript
@Controller('admin/foos')
@Roles(['admin'])
export class FooController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus
  ) {}

  @Get()
  list(@Query() query: ListFoosQueryDto): Promise<GetFoosRes> {
    return this.queryBus.execute(new ListFoosQuery(query))
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFooDto): Promise<FooResponse> {
    return this.commandBus.execute(new UpdateFooCommand({ id, ...dto }))
  }
}
```

目的：controller 是传输层适配器，不直接访问 repository，不写业务规则，不直接调用 Prisma。

### 10. Presentation Module：依赖绑定与 handler 注册

目录：

```text
services/engine/src/presentation/http/<domain>/<domain>.module.ts
```

Module 负责绑定 domain repository token 到 infrastructure 实现，并注册 CQRS handlers：

```typescript
const QueryHandlers = [ListFoosHandler]
const CommandHandlers = [UpdateFooHandler]

@Module({
  imports: [CqrsModule],
  controllers: [FooController],
  providers: [
    {
      provide: FOO_REPOSITORY,
      useClass: FooRepository
    },
    ...QueryHandlers,
    ...CommandHandlers
  ],
  exports: [FOO_REPOSITORY]
})
export class FooModule {}
```

最后在 `services/engine/src/app.module.ts` 的业务模块 imports 中注册：

```typescript
imports: [
  FooModule
]
```

目的：NestJS DI 只在模块层装配。application 依赖的是抽象 token，实际实现由 module 连接。

## 相邻层关系

### Payload 与 Application

`@libs/payload` 定义接口字段和校验规则；application DTO 包装它，mapper 把它转换为 domain criteria。payload 不进入 domain。

### Application 与 Domain

application 调用 domain entity、VO、repository interface、domain exception。domain 不知道 application 的存在。

### Domain 与 Infrastructure

domain 定义 repository interface；infrastructure 实现 interface。domain 不知道 Prisma、Better Auth 或外部 SDK。

### Application 与 Presentation

presentation 创建 Query/Command 并交给 bus；application handler 执行流程并返回 payload response。controller 不直接调用 use case 或 repository，除非该模块没有 CQRS 需求且经过明确评估。

## Better Auth 边界

`engine` 不实现登录、注册、session 管理、认证组织成员变更等认证业务。相关能力由 `@libs/auth-server` / Better Auth 负责。

`engine` 可以做的是：

- 管理端意图，例如 admin ban user、delete user、list users。
- 业务规则守卫，例如不能操作自己、不能移除 owner。
- 通过 infrastructure repository 委托 `auth.api.*` 完成实际落地。

## 验证顺序

新增或修改接口后，至少执行：

```bash
pnpm exec vitest run <相关测试文件>
pnpm nx run engine:build:development
```

如果改动影响整个 engine，再执行：

```bash
pnpm nx run engine:lint
pnpm nx test engine
```

## 开发检查清单

- [ ] 新 enum-like 值定义在 `@libs/common`，没有重复定义。
- [ ] payload schema 定义请求和响应，engine DTO 只用 `createZodDto()` 包装请求 schema。
- [ ] entity 是 class，包含私有状态、工厂方法、getter 和行为方法。
- [ ] VO 至少在 entity 字段、repository 签名或方法参数中真实使用。
- [ ] repository interface 不导入 `@libs/payload`、NestJS、Prisma 或外部 SDK。
- [ ] mapper 负责 payload request 与 domain criteria/result 的转换。
- [ ] command handler 委托 application use case，不写业务规则。
- [ ] query handler 不把 payload 类型传进 repository，而是先转换为 criteria。
- [ ] infrastructure repository 返回 domain entity，不返回裸 Prisma 对象。
- [ ] controller 只处理路由、权限、DTO 和 bus 调用。
- [ ] module 绑定 repository token、注册 handlers，并在 `app.module.ts` 注册。
- [ ] domain exception 都包含 `code`、`i18nKey`、`httpStatus`。
