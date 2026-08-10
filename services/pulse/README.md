# Pulse runtime

Pulse exposes an authenticated Socket.IO transport at `/pulse/socket.io` and
health probes at `/health/live` and `/health/ready`.

Security and delivery rules:

- Better Auth session cookies or tokens are verified during the handshake and
  revalidated before organization subscriptions.
- Organization rooms are joined only after PostgreSQL confirms the
  `(organizationId, userId)` membership tuple. Client-provided organization IDs
  are never treated as authorization proof.
- The Socket.IO Redis adapter propagates room broadcasts between instances;
  Redis does not make authorization decisions.
- Connection rate limits, bounded outbound buffers, periodic heartbeats,
  session expiry, and graceful drain protect the runtime during load and
  releases.
- Only the versioned `platform.smoke@v1` envelope is registered. Product events
  require a separately reviewed contract and handler.

Production must set `PULSE_CORS_ORIGINS` to a comma-separated list of trusted
HTTP(S) origins. Optional limits use the `PULSE_*` variables documented by
`pulse-runtime.config.ts`.
