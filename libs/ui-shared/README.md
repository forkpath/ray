# ui-shared

Transitional Web/Native UI facade.

Theme value types, palettes, breakpoints, and `cn()` now live in the universal
`ui-core` project. Existing `@libs/ui-shared/common` imports remain compatible,
but internal and runtime consumers use `@libs/ui-core` directly.

DOM hooks and platform components remain here until the independent `ui-web`
and `ui-native` extraction pull requests are accepted.
