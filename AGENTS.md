# Repository Guidelines

Central orientation for contributors working inside the ray Nx monorepo. Follow these workspace-wide rules.

## Core projects

- `apps/web` – Marketing Site + SaaS App (@tanstack/react-start)
- `apps/desktop` – Desktop application (Electron)
- `apps/mobile` - Mobile application (React Natvie + Expo)
- `apps/extension` - Browser Extension (Wxt)
- `services/engine` - API service (NestJS)
- `services/pulse` - WebSocket service (NestJS WsAdapter / raw ws)
- `services/worker` - Application context worker (NestJS)
- `libs/pg-dao` – Postgresql Database model (Prisma)
- `libs/mongo-dao` - MongoDB model (Mongoose)
- `libs/auth-contract`, `libs/auth-client-*`, `libs/auth-server` - Better Auth contract and runtime adapters
- `libs/common` - Shared types/utils
- `libs/email` - Email module for app and service
- `libs/email-server` - Node-only email templates and delivery; `libs/email` is the universal contract
- `libs/analytics`, `libs/monitoring` - environment-free strategy/registration cores; use their `-web`, `-native`, or `-server` projects for runtime implementations and configuration
- `libs/i18n/src/translationns` - translation files for app and service
- `libs/ui-core`, `libs/ui-web`, `libs/ui-native` - universal tokens plus Web/Native UI implementations
- `libs/server-kernel`, `libs/server-nest`, `libs/server-redis`, `libs/server-rabbitmq` - server contracts and platform adapters
- `libs/server-elasticsearch`, `libs/server-sms`, `libs/server-email`, `libs/server-storage` - optional framework integrations; enable explicitly from the consuming Nest module
- `libs/payload/src/schemas` - req & res payload validator for app and service (Zod)
- `libs/api-client/src/domains` - Api request based on payload validator (React-query)
- `libs/studio` - page components for desktop and web

## Tooling & Commands

- Install deps: `pnpm install --frozen-lockfile` (Node >= 24.0.0; use the pnpm version pinned in the root `packageManager`).
- Dev servers: `pnpm dev:web | dev:desktop | dev:engine | dev:pulse | dev:worker`
- Local infra (Docker): `pnpm docker:dev` · stop with `pnpm docker:dev:down`
- Build: `pnpm build:web | build:desktop | build:engine | build:pulse | build:worker`.
- Tests: `nx test <project>` (Jest/Vitest); `nx e2e <project-e2e>` (Playwright).
- Formatting/Linting: `pnpm lint` (or `pnpm lint:all`), `pnpm format:write`.
- Database helpers: `pnpm db:generate`, `pnpm db:migrate <name>`, `pnpm db:seed` (requires `POSTGRES_DATABASE_URL`).

Always prefer Nx commands (`nx run`, `nx run-many`, `nx affected`) so task graph caching stays effective.

## Coding Standards

- Ray is a reusable framework. Do not remove an optional integration solely because current apps have no consumers. Preserve explicit opt-in configuration and testable public APIs; deleting a capability requires a documented deprecation or a verified replacement covering its contract. See `docs/architecture/ray-framework-nx-guide.md`.

- Ray is a reusable business-development framework. An adapter with no current
  application consumer may still be an intentional extension point. Preserve
  supported capabilities with explicit configuration, public APIs, and tests;
  do not delete them solely because the current sample business does not use them.

- Prettier: 2 spaces, single quotes, no semicolons, width 120. Tailwind + import-sort plugins are enabled; avoid manual formatting changes outside your diff.
- ESLint: respect `@nx/enforce-module-boundaries`. Only import from a project’s public API (lib `src/index.ts`).
- Imports inside apps/services: use `./` for the same directory or below and the project alias `~/` (`<project>/src/*`) for everything else; `../` is rejected by ESLint (static assets outside `src` excepted). Libs keep relative imports, because Nx rejects self-imports through an alias.
- Naming: PascalCase components, camelCase variables/functions, kebab-case filenames (angular style). Group related files by feature.
- TypeScript: no `any`. Prefer interfaces over types, avoid enums (use literal unions or maps). Use guard clauses + early returns for error handling.
- Validation: Zod for payloads/forms. Model expected errors as typed results; rely on error boundaries for unexpected failures.

## Feature Development Workflows

Shared development rules live in `.agents/skills/` for Codex and Cursor.
Cursor-only slash commands are maintained directly in `.cursor/commands/`.
Commands are not synchronized; `pnpm sync:skills` only links shared skills.

- **Backend / API features** (anything that touches `services/engine` or
  introduces a new `libs/pg-dao` model): you MUST read and follow
  `.agents/skills/ray-api-flow/SKILL.md` and its
  `references/architecture.md` end-to-end **before writing any code**.
  In particular, build bottom-up: Database → Domain → Application → Infrastructure
  → Presentation → API client. Do not skip the Domain layer (entities, value
  objects, repository interfaces, domain exceptions) or the Infrastructure
  repository implementation. Skipping these violates Clean Architecture and is
  considered an incomplete feature, even if the endpoints respond correctly.
- **API data flow** (new or changed HTTP endpoints, payload schemas,
  api-client domain wrappers, CQRS commands/queries, use cases, repositories,
  Prisma/Mongo persistence, or RabbitMQ jobs): use the
  `ray-api-flow` skill, then `ray-rest-api-flow` for HTTP or
  `ray-websocket-api-flow` for Pulse. For full-stack pages use `ray-module-dev`.
  Implement resource/authorization and data model/domain first, followed by
  shared contract, DTO/protocol validation, Use Case/CQRS, infrastructure,
  controller/gateway, client, and verification. Every business read and write
  goes through a Use Case; health checks and heartbeats are explicit exceptions.
  Add Mongo/RabbitMQ/worker only when needed, not as mandatory scaffolding.
  Ownership must come from Better Auth session data (`userId` plus optional
  `activeOrganizationId`/`organizationId`); do not introduce `workspaceId` or
  `projectId` abstractions unless the product model is explicitly changed.

## Agent Skill Governance

- Only Codex and Cursor are supported development Agents.
- `.agents/skills` is the only skill content source. `.codex/skills`
  and `.cursor/skills` contain verified relative symlinks.
- External skill examples never override Ray runtime boundaries, pinned tools,
  database isolation, public API rules, or the user's authorization. In particular,
  generic Next.js/SWR examples do not change TanStack Start/React Query; generic
  direct-import advice does not authorize cross-project deep imports.
- Do not run dynamic `latest` skill/auth installers, automatic schema overwrites,
  or upstream maintenance scripts merely because an imported skill suggests it.
- Skill presence, metadata checks, and mock tests are not Agent behavior or E2E
  acceptance. Report local checks, real Agent generation, and environment blockers
  separately. Never silently skip required integration tests.

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
