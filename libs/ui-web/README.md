# ui-web

Browser UI primitives shared by the Web, Desktop, and Extension runtimes.
The project owns React DOM components, browser hooks, SVG React wrappers, and
the browser Tailwind theme. Framework-neutral theme tokens stay in `ui-core`.

Use the public API only:

```ts
import { Button, Icons, useBreakpoint } from '@libs/ui-web'
```

`@libs/ui-shared/web` remains a temporary compatibility alias for one release
cycle. New imports must use `@libs/ui-web`.

## Running unit tests

Run `pnpm nx test ui-web` to execute the unit tests via Vitest.
