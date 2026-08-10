# server-redis

Node-only NestJS and ioredis adapter for the shared Redis runtime contract.
Applications compose this project through `@libs/server-redis`; it owns the
client lifecycle and hash helpers while `server-kernel` owns configuration
types.

The old `srv-shared/redis` exports remain a type/export-only compatibility
bridge for one release. New runtime consumers must not import Redis through the
mixed `srv-shared` facade.

Run `pnpm nx test server-redis` to execute the unit tests.
