## 如何初始化RAY

- 利用nx构建一个基础的repo

```bash
npx create-nx-workspace --name ray --appName engine --workspaceType integrated --aiAgents claude copilot cursor codex --pm pnpm --style tailwind --formatter prettier --e2eTestRunner playwright --unitTestRunner vitest --preset nest  --useGithub --skipGitHubPush --defaultBase dev --ci github --commit.email forkpath@gmail.com --commit.name forkpath --docker
```

- 在apps目录下创建一个基础react应用

```bash
nx add @nx/react
nx g @nx/react:app apps/web --bundler=vite --style=css --globalCss --linter eslint --port 3000 --unitTestRunner vitest --e2eTestRunner playwright--tags=scope:frontend,type:app
```

计划将scope和type进行固定分类，方便后续根据tag来运行对应工作流

| Tag   | 分类                                   |
| ----- | -------------------------------------- |
| Scope | `frontend` `backend` `client` `shared` |
| Type  | `app` `lib`                            |

- 将engine移动到services中

```bash
mkdir -p services
nx g @nx/workspace:move --project engine  services/engine

# 更新scope和type
sed -i '' 's/"tags":[[:space:]]*\[\]/"tags": ["scope:backend", "type:app"]/g' services/engine/project.json
```

- 安装commit信息规范化工具及git钩子工具

```shell
pnpm add -D @commitlint/{config-conventional,cli} cz-customizable
pnpm add -D lefthook
npx lefthook install
```

- 安装lint和format工具依赖

```shell
pnpm add -D @ianvs/prettier-plugin-sort-imports prettier-plugin-tailwindcss
```

- 创建service等核心依赖core和共享模块shared

```shell
nx g @nx/nest:lib libs/srv-core --linter=eslint --tags=scope:backend,type:lib --skipTsConfig
nx g @nx/nest:lib libs/srv-shared --linter=eslint --tags=scope:backend,type:lib --skipTsConfig
```

- 创建pg-dao，用prisma作为orm

```shell
nx g @nx/js:lib libs/pg-dao --minimal --bundler=none --tags=scope:backend,type:lib --skipTsConfig
pnpm add @prisma/client @prisma/adapter-pg pg
pnpm add -D prisma @types/pg
```

- 创建mongo-dao，用mongoose作为orm

```shell
nx g @nx/js:lib libs/mongo-dao --minimal --bundler=none --tags=scope:backend,type:lib --skipTsConfig
pnpm add @nestjs/mongoose @nestjs/config mongoose
```

- 创建前后端公用的通讯载荷定义

```shell
nx g @nx/js:lib libs/payload --minimal --bundler=none --tags=scope:shared,type:lib
```

- 创建前后端共用的一些工具函数

```shell
 nx g @nx/js:lib libs/common --minimal --bundler=none --tags=scope:shared,type:lib --skipTsConfig
```

- 创建前端的接口调用方式与接口hooks集合

```shell
nx g @nx/js:lib libs/api-core --minimal --bundler=none --tags=scope:shared,type:lib --skipTsConfig
nx g @nx/js:lib libs/api-client --minimal --bundler=none --tags=scope:shared,type:lib --skipTsConfig
```

- 创建apps共用的ui组件库以及spa应用核心组件库studio

```shell
nx g @nx/react:library libs/ui-shared --unitTestRunner=vitest --linter=eslint --tags=scope:frontend,type:lib --skipTsConfig
nx g @nx/react:library libs/studio --unitTestRunner=vitest --linter=eslint --tags=scope:frontend,type:lib --skipTsConfig

# 因为该lib不会打包输出，所以不需要babel，所以删除该目录下的.babelrc
rm libs/ui-shared/.babelrc
rm libs/studio/.babelrc

# 移除对应依赖
pnpm remove @babel/core @babel/preset-react
```

- 集成i18next，构建一个i18n模块

```shell
pnpm add i18next i18next-browser-languagedetector react-i18next nextjs-i18n

nx g @nx/js:lib libs/i18n --minimal --bundler=none --tags=scope:shared,type:lib --skipTsConfig
```

- 集成resend以及nodemailer，构建一个邮件发送模块

```shell
nx g @nx/js:lib libs/email --minimal --bundler=none --tags=scope:shared,type:lib --skipTsConfig
```

- 集成better-auth实现认证授权，构建auth模块

```shell
pnpm add --save-exact better-auth@1.6.2

# 生成一个better-auth 密钥
openssl rand -base64 32

# 构建一个前后端共用的auth模块
nx g @nx/js:lib libs/auth --minimal --bundler=none --tags=scope:shared,type:lib --skipTsConfig
```

- 继承stripe和lemon-squeezy作为支付依赖

```shell
nx g @nx/js:lib libs/billing --minimal --bundler=none --tags=scope:shared,type:lib --skipTsConfig
```

- 利用shacdn构建ui-shared

```shell
# 安装必须的依赖
pnpm add class-variance-authority clsx tailwind-merge lucide-react tw-animate-css tailwindcss
pnpm add -D @tailwindcss/postcss @tailwindcss/vite

# 在根目录下创建components.json，并修改路径为ui-shared
{
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "rsc": false,
    "tsx": true,
    "tailwind": {
        "config": "",
        "css": "unused.css",
        "baseColor": "neutral",
        "cssVariables": true,
        "prefix": ""
    },
    "aliases": {
        "components": "libs/ui-web/src/components",
        "utils": "libs/ui-core/src/lib/cn",
        "lib": "libs/ui-web/src",
        "hooks": "libs/ui-web/src/hooks"
    },
    "iconLibrary": "lucide"
}

其中unused.css只是一个占位符，并不存在，因为tailwindcss的样式是通过具体应用引入的globals.css来实现的。
另外aliases只需要这四个即可

# 在package.json中绑定脚本，我这里的思路是将其分科，通过路径的方式来实现样式添加
"add:web-ui": "pnpx shadcn@latest add -p libs/ui-web/src/components",
"add:mobile-ui": "pnpx shadcn@latest add -p libs/ui-shared/src/mobile/components",
```

- 构建desktop应用

```shell
pnpm add -D @electron-forge/cli @electron-forge/maker-dmg @electron-forge/maker-squirrel @electron-forge/plugin-fuses @electron-forge/plugin-vite @electron-forge/publisher-github @electron-forge/shared-types @electron/fuses

ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm add -D electron

nx g @nx/react:app apps/desktop --bundler=vite --style=css --globalCss --linter eslint --port 4200 --unitTestRunner vitest --tags=scope:frontend,type:app
```

注意针对desktop应用需要自行编写project.json中的目标，其中

```shell
start: 会自行用vite启动renderer，并用electron打开
package: 会先将renderer打包，然后用electron打开
make: 本地将renderer进行打包，并完成electron打包，输出.deb/.dmg/.exe等可执行程序
publish: 利用github实现云端发包
```

- 本地利用cloudflared进行反向代理

需要在域名上正确的配置tunnel映射

| type   | name       | content                                               |
| ------ | ---------- | ----------------------------------------------------- |
| Tunnel | postfly.io | 37531130-b3eb-4c31-83c1-5d521e96def8.cfargotunnel.com |
