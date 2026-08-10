# ui-shared

Transitional Web/Native UI facade.

Theme value types, palettes, breakpoints, and `cn()` now live in the universal
`ui-core` project. Existing `@libs/ui-shared/common` imports remain compatible,
but internal and runtime consumers use `@libs/ui-core` directly.

React DOM components, browser hooks, Web SVG wrappers, and browser styles now
live in `ui-web`. Existing `@libs/ui-shared/web` and
`@libs/ui-shared/common` imports remain compatible through exact TypeScript
path aliases that resolve directly to `ui-web`; this avoids a `ui-shared →
ui-web` graph edge. All tracked Web consumers use `@libs/ui-web` directly.

Native components remain here until the independent `ui-native` extraction
pull request is accepted.
