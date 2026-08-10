# Repository Guidelines

Central orientation for contributors working inside the neo Nx monorepo. Follow these workspace-wide rules.

## Core projects

- `apps/web` – Marketing Site + SaaS App (@tanstack/react-start)
- `apps/desktop` – Desktop application (Electron)
- `apps/mobile` - Mobile application (React Natvie + Expo)
- `apps/extension` - Browser Extension (Wxt)
- `service/engine` - Api service (Nestjs)
- `service/pulse` - Websocket service (Nestjs)
- `service/workder` - Application Context Worker (Nextjs)
- `libs/pg-dao` – Postgresql Database model (Prisma)
- `libs/mongo-dao` - MongoDB model (Mongoose)
- `libs/auth` - Auth module for app and service (Better-auth)
- `libs/common` - Shared types/utils
- `libs/email` - Email module for app and service
- `libs/i18n/src/translationns` - translation files for app and service
- `libs/ui-core` - universal theme values, breakpoints, and class-name utilities
- `libs/ui-web` - React DOM components and browser styles (Tailwind v4 and Shadcn)
- `libs/ui-shared/src/mobile` - transitional React Native UI facade
- `libs/payload/src/schemas` - req & res payload validator for app and service (Zod)
- `libs/api-client/src/domains` - Api request based on payload validator (React-query)
- `libs/studio` - page components for desktop and web

## Tooling & Commands

- Install deps: `pnpm install` (Node >= 24.0.0, pnpm >= 10.25.0).
- Dev servers: `pnpm dev:web | dev:desktop | dev:engine | dev:pulse | dev:worker`
- Local infra (Docker): `pnpm docker:dev` · stop with `pnpm docker:dev:down`
- Build: `pnpm build:web | build:desktop | build:engine | build:pulse | build:worker`.
- Tests: `nx test <project>` (Jest/Vitest); `nx e2e <project-e2e>` (Playwright).
- Formatting/Linting: `pnpm lint` (or `pnpm lint:all`), `pnpm format:write`.
- Database helpers: `pnpm db:generate`, `pnpm db:migrate <name>`, `pnpm db:seed` (requires `POSTGRES_DATABASE_URL`).

Always prefer Nx commands (`nx run`, `nx run-many`, `nx affected`) so task graph caching stays effective.

## Coding Standards

- Prettier: 2 spaces, single quotes, no semicolons, width 80. Tailwind + import-sort plugins are enabled; avoid manual formatting changes outside your diff.
- ESLint: respect `@nx/enforce-module-boundaries`. Only import from a project’s public API (lib `src/index.ts`).
- Naming: PascalCase components, camelCase variables/functions, kebab-case filenames (angular style). Group related files by feature.
- TypeScript: no `any`. Prefer interfaces over types, avoid enums (use literal unions or maps). Use guard clauses + early returns for error handling.
- Validation: Zod for payloads/forms. Model expected errors as typed results; rely on error boundaries for unexpected failures.

## Feature Development Workflows

The repository ships per-target setup guides under `.agents/commands/`,
mirrored into `.claude/commands/`, `.codex/commands/`, and `.cursor/commands/`
via `pnpm sync:commands`.

- **Backend / API features** (anything that touches `services/engine` or
  introduces a new `libs/pg-dao` model): you MUST read and follow
  `.agents/commands/setup-saas-feature.md` end-to-end **before writing any code**.
  In particular, build bottom-up: Database → Domain → Application → Infrastructure
  → Presentation → API client. Do not skip the Domain layer (entities, value
  objects, repository interfaces, domain exceptions) or the Infrastructure
  repository implementation. Skipping these violates Clean Architecture and is
  considered an incomplete feature, even if the endpoints respond correctly.
- **API data flow** (new or changed HTTP endpoints, payload schemas,
  api-client domain wrappers, CQRS commands/queries, use cases, repositories,
  Prisma/Mongo persistence, or RabbitMQ jobs): use the
  `ray-api-flow` skill. Keep the standard chain explicit:
  `libs/payload` schema → `libs/api-client` domain wrapper → engine controller
  DTO/session validation → command/query → use case → repository → PG, with
  Mongo/RabbitMQ/worker added only when the interface genuinely needs them.
  Ownership must come from Better Auth session data (`userId` plus optional
  `activeOrganizationId`/`organizationId`); do not introduce `workspaceId` or
  `projectId` abstractions unless the product model is explicitly changed.

## Nx-Specific Guidance

- Use the Nx MCP tools exposed in the Codex CLI: `nx_workspace` for topology, `nx_project_details` for project config, `nx_docs` for up-to-date Nx behavior.
- When debugging graph/config issues, always inspect the workspace via `nx_workspace` first.
- Prefer `nx run-many`/`nx affected` when touching multiple projects to leverage computation caching.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
