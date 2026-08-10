# server-rabbitmq

Node-only RabbitMQ infrastructure for Engine and Worker. It owns the Nest
connection module, exchange publisher, and bounded consumer prefetch policy.
Applications compose it only through `@libs/server-rabbitmq`.

Message retry, dead-letter, and idempotency semantics are intentionally outside
this boundary extraction and are delivered in the Worker platform wave.

Run `pnpm nx test server-rabbitmq` to execute the unit tests.
