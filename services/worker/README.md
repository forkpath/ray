# Worker runtime

The Worker is an HTTP-observable Nest runtime backed by RabbitMQ and the PostgreSQL `worker_inbox` table.
It currently registers only the versioned `platform.smoke` handler; product events are intentionally out of scope.

## Delivery semantics

- The queue, dead-letter exchange and dead-letter queue are durable.
- Messages are consumed with `noAck: false`; the Worker explicitly acknowledges every durable outcome.
- Successful, duplicate, busy and durably scheduled retry outcomes are acknowledged.
- Unknown, malformed, unsupported-version and exhausted messages are rejected without requeue so RabbitMQ routes them to the DLQ.
- Infrastructure failures before a durable Inbox outcome are rejected with requeue.
- Retry scheduling is stored in PostgreSQL. Active instances lease due retries and abandoned processing rows with `FOR UPDATE SKIP LOCKED`, then republish persistent messages. Failed dispatches become eligible after 60 seconds; processing is not considered abandoned until its five-minute claim lease expires.
- The handler concurrency and RabbitMQ prefetch count both come from `WORKER_CONCURRENCY` (1-16).

## Runtime modes and probes

`WORKER_RUNTIME_MODE=active` attaches the consumer and retry dispatcher. `standby` still verifies PostgreSQL, RabbitMQ and the handler registry, but never attaches a consumer or scans retries. This is the safe candidate mode for a future blue/green release.

- `GET /health/live` checks the HTTP process.
- `GET /health/ready` checks PostgreSQL, RabbitMQ and the handler registry and reports the runtime mode.

The application Compose healthcheck uses `/health/ready`. A release controller must switch a candidate from standby to active only as part of the traffic/consumer cutover; changing the environment requires recreating the Worker container.
