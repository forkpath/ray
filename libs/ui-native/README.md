# ui-native

React Native UI components, native SVG assets, Uniwind types, and Mobile
styles. Runtime consumers import only the public `@libs/ui-native` entrypoint.

Use `pnpm nx run ui-native:lint`, `pnpm nx run ui-native:typecheck`, and
`pnpm nx run ui-native:test` for deterministic verification. The Mobile Expo
export remains the integration proof that the source-composed native library
bundles correctly.
