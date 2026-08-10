# server-nest

NestJS-specific server composition and cross-cutting adapters. This project owns
runtime configuration loading, exception filters, response interceptors,
throttling guards, decorators, and the Nest i18n module.

Runtime-neutral configuration shapes remain in `server-kernel`. Applications
import this project through `@libs/server-nest`; `@libs/srv-core` remains an
exact compatibility alias for one release.
