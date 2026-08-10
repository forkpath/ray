# ui-shared common

本模块是 Web 主题样式与 DOM hooks 的过渡兼容层。跨运行时的主题值与工具已迁移到
`@libs/ui-core`。

## 目录内容

- `styles/globals.css`: Tailwind CSS 与主题变量的入口。
- `@libs/ui-core`: 主题注册表、OKLCH 配色、类型和 `cn()`。
- `styles/themes/build.ts`: 从主题注册表生成 `variables.css`。
- `styles/themes/variables.css`: 自动生成的主题 CSS 变量文件。

## Tailwind CSS 如何集成

`styles/globals.css` 负责接入 Tailwind 与主题变量：

- `@import 'tailwindcss';` 启用 Tailwind 处理。
- `@import './themes/variables.css';` 引入生成后的主题变量。
- `@custom-variant light` 与 `@custom-variant dark` 注册基于类的变体。
- `@theme inline { ... }` 将 CSS 变量（如 `--primary`）映射为 Tailwind 主题 token
  （如 `--color-primary`），使 Tailwind 的工具类读取当前主题值。

因此 `bg-primary`、`text-foreground` 等工具类会随主题切换而变化。

## 多主题系统的原理

主题在 TypeScript 中定义，在构建时生成 CSS：

1. `@libs/ui-core` 定义各主题的 `light` / `dark` 配色（OKLCH 数值）。
2. `@libs/ui-core` 汇总为 `themes` 映射。
3. `styles/themes/build.ts` 将 `themes` 生成 CSS 并写入 `styles/themes/variables.css`。
4. `styles/themes/variables.css` 结构包含：
   - `:root` 的默认主题（取 `themes.ts` 中的第一项）
   - `[data-theme='...']` 的主题覆盖
   - 每个主题内部的 `light` / `dark` 变体

主题选择规则：

- 模式：在父节点添加 `.light` 或 `.dark` 切换模式。
- 主题色：在父节点设置 `data-theme="blue" | "orange" | ...` 切换配色。

两者可组合使用（例如 `data-theme="blue"` 且 `.dark`）。

## 使用方式

### 1) 全局引入

在应用入口（如 root layout）引入全局样式：

```ts
import '@libs/ui-shared/common/styles/globals.css'
```

### 2) 设置主题模式与颜色

在外层元素（通常为 `html` 或 `body`）设置类名与属性：

```html
<html class="light" data-theme="blue">
  ...
</html>
```

切换 `class` 即可在 light/dark 间切换；切换 `data-theme` 即可更换配色。

### 3) 使用 Tailwind 语义 token

组件中使用语义化的 Tailwind 类名：

```tsx
<button className="bg-primary text-primary-foreground">Action</button>
```

### 4) 重新生成变量文件

`styles/themes/variables.css` 为自动生成文件。修改
`@libs/ui-core` 的主题源文件后，运行
`styles/themes/build.ts` 以更新 `variables.css`。

## 导出内容

来自 `index.ts` 的导出：

- `@libs/ui-core` 的兼容再导出
- Hooks：`useMediaQuery`、`useBreakpoint`
