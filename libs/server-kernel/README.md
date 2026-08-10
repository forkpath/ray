# server-kernel

Framework-neutral contracts shared by Node platform adapters and application
composition roots. It contains no NestJS decorators, environment reads,
database clients, broker clients, or filesystem access.

Runtime-specific libraries consume these contracts through the public
`@libs/server-kernel` entrypoint. Compatibility re-exports remain in the old
adapter paths for one release.
