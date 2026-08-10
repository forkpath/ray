# Deployment architecture

Ray separates infrastructure lifetime from application release lifetime.

```text
CI main/tag
  -> immutable manifest (Engine, Pulse, Worker, Web, Migrator digests)
  -> release controller
       -> backup receipt gate
       -> forward-only Migrator digest
       -> application Compose digest switch
       -> readiness + auth/billing/organization smoke
       -> installed release ledger

Infrastructure Compose
  PostgreSQL + Redis + MongoDB + RabbitMQ + persistent volumes
                  ^
                  | external named network
                  v
Application Compose
  Kong -> Web / Engine / Pulse; Worker consumes durable queues
```

The deployment target does not clone or pull the repository and does not build
application images. Application rollback replaces only application digests;
Expand migrations are retained. See
`docs/deployment/quick-rollback.md` for the executable runbook.

Blue/green routing is intentionally a later layer. The digest controller and
installed-release ledger are its prerequisites; a Contract Migration must
never share a release with traffic switching.
