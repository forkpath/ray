# Repository Guidelines

Central orientation for contributors working inside the neo Nx monorepo. Follow these workspace-wide rules.

## Core projects

- `apps/web` – Marketing Site (@tanstack/react-start)
- `apps/desktop` – Desktop application (Electron)
- `service/engine` - Api service (Nestjs)
- `libs/pg-dao` – Postgresql Database model (Prisma)
- `libs/mongo-dao` - MongoDB model (Mongoose)
- `libs/auth` - Auth module for app and service (Better-auth)
- `libs/common` - Shared types/utils
- `libs/email` - Email module for app and service
- `libs/i18n/src/translationns` - translation files for app and service
- `libs/ui-shared/src/web` - react components and common styles (Tailwind v4 and Shadcn)
- `libs/payload/src/schemas` - req & res payload validator for app and service (Zod)
- `libs/api-client/src/domains` - Api request based on payload validator (React-query)
- `libs/studio` - page components for desktop and web

## Tooling & Commands

- Install deps: `pnpm install` (Node >= 22.19.0, pnpm >= 10.8.1).
- Dev servers: `pnpm dev:web | dev:desktop | dev:engine`
- Build: `pnpm build:web | build:desktop | build:engine`.
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

## Nx-Specific Guidance

- Use the Nx MCP tools exposed in the Codex CLI: `nx_workspace` for topology, `nx_project_details` for project config, `nx_docs` for up-to-date Nx behavior.
- When debugging graph/config issues, always inspect the workspace via `nx_workspace` first.
- Prefer `nx run-many`/`nx affected` when touching multiple projects to leverage computation caching.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

## Cursor Cloud specific instructions

### Infrastructure services

The engine backend requires PostgreSQL, MongoDB, Redis, and RabbitMQ. These are defined in `docker/docker-compose.yml` and started via `docker compose --env-file .env up -d` from the `docker/` directory. Docker must be installed and running first (the Cloud VM does not have Docker pre-installed).

### Environment variables

Copy `.env.example` to `.env` before first run. Key adjustments for local development:
- Replace all host IPs (e.g. `72.61.126.222`) with `localhost`.
- The `POSGTRES_DATABASE_URL` and `RABBITMQ_URI` values use `${VAR}` interpolation which standard `dotenv` does not expand. Replace them with literal values:
  - `POSGTRES_DATABASE_URL="postgresql://ray_user:ray_password@localhost:5432/ray?connect_timeout=300&sslmode=disable"`
  - `RABBITMQ_URI=amqp://ray_user:ray_password@localhost:5672`
- Note: the env var name `POSGTRES_DATABASE_URL` has a typo (missing "R") — this is intentional in the codebase; do not "fix" it.

### Database setup

After infrastructure is running, generate the Prisma client and deploy migrations:
```
pnpm db:generate
npx nx run pg-dao:deploy
```

### Running services

- **Engine** (NestJS, port 8000): `pnpm dev:engine` — reads `.env` from workspace root via `@nestjs/config`.
- **Web** (TanStack React Start, port 3000): `pnpm dev:web`
- Lint: `pnpm lint` (uses `nx affected -t lint`) or `pnpm lint:all`
- Tests: `npx nx run-many -t test --projects=billing,api-core` (only projects with test files currently: `billing`, `api-core`)

### Gotchas

- `nx` is not globally installed; use `npx nx` or the `pnpm` scripts that wrap it.
- Several projects (web, common, studio, ui-shared, api-client) have Vitest configured but no test files yet; running `nx test` on them exits with code 1 ("No test files found"). This is expected.
- The `postinstall` script runs `lefthook install` which sets up pre-commit (format + lint) and commit-msg (commitlint) hooks.
- Elasticsearch is referenced in config but is optional and not included in docker-compose.
