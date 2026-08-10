# ui-shared

One-release compatibility project. It owns no runtime source code.

- Universal theme values and `cn()` live in `ui-core`.
- React DOM components and browser styles live in `ui-web`.
- React Native components, SVG assets, and native styles live in `ui-native`.

Tracked consumers use those public project entrypoints directly. Legacy
`@libs/ui-shared/common`, `@libs/ui-shared/web`, and
`@libs/ui-shared/mobile[/...]` paths resolve through exact TypeScript aliases
to the owning project, so this compatibility project creates no graph edge.
