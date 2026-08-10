# Better Auth test governance

The standard Nx `auth:test` target is an aggregate gate. It must run both:

- `auth:contract-test` for schema governance logic;
- `auth:integration-test` for production authentication behavior.

The integration suite builds its test instance from `createAuthBehaviorOptions`,
the same factory used by the production Prisma-backed server. Tests replace only
the database and email delivery boundary. The Better Auth `testUtils` plugin is
appended to this dedicated test instance and must never be included in the
production plugin array.

## Deterministic CI coverage

- Email/password registration, verification, sign-in, session, sign-out, and
  password reset;
- Magic Link and Email OTP sign-in with captured delivery callbacks;
- Google, GitHub, and Apple OAuth authorization-flow creation;
- Passkey registration and authentication challenge creation;
- TOTP setup, second-factor sign-in, and backup-code sign-in;
- Anonymous account upgrade after email verification;
- Admin ban, unban, and impersonation;
- Organization creation, invitation, acceptance, active organization, and
  member permission denial.

The suite intentionally uses the production `ray` cookie prefix. The generic
Better Auth cookie merger is used instead of the package's fixed-default test
sign-in helper.

## Explicit boundaries

- OAuth provider callbacks require provider sandboxes and belong in controlled
  nightly tests. CI verifies local authorization URL construction without
  contacting external providers.
- Browser authenticator ceremony requires Playwright/WebAuthn and belongs in the
  Web E2E wave. CI verifies the server-side passkey challenge contract.
- The official in-memory SQLite adapter verifies Better Auth behavior. Physical
  PostgreSQL compatibility remains governed by `auth:schema-check`, Prisma
  migration tests, and snapshot migration rehearsal.
- Better Auth creates a new formal user during anonymous upgrade and removes the
  anonymous record after verification. Before anonymous users own product data,
  a reviewed `onLinkAccount` ownership-transfer hook is required.
