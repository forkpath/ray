# ui-core

Universal UI values shared by web, native, email, and service consumers.

It is tagged `type:util`, not `type:ui`, because it contains no renderable
components. This lets platform adapters consume the same tokens without
weakening the module-boundary rules; the later Web and Native component
projects use `type:ui`.

The public API contains only:

- theme modes, colors, and typed OKLCH palettes;
- the deterministic `cn()` class merger;
- breakpoint constants and theme value interfaces.

It must not import DOM, React, React Native, Expo, Node, or platform-specific
asset loaders. Browser hooks remain in the Web UI boundary, while Web and Native
components are migrated in later independent Wave 3 pull requests.

Run `pnpm nx run ui-core:lint`, `pnpm nx run ui-core:typecheck`, and
`pnpm nx run ui-core:test` to validate the boundary.
