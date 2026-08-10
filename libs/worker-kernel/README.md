# Worker Kernel

Node platform primitives for durable message processing:

- handler registration with explicit envelope-version support;
- persistent `(consumer, messageId)` idempotency claims;
- five-attempt exponential retry policy with bounded jitter;
- terminal dead-letter state for invalid, unknown or exhausted messages;
- active/standby readiness that checks the handler registry and dependencies.

The kernel contains no product event. The first runtime adapter uses only the
`platform.smoke` event needed to verify a candidate Worker before blue/green
cutover.
