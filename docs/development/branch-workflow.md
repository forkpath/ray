# 分支维护

本文说明仓库的分支模型、合并方式、CI 与部署在各环节的行为、GitHub 仓库的一次性配置、
`.github` 目录中每个文件的作用，以及本地日常的更新、推送与发布命令。

## 1. 分支模型

| 分支     | 用途                                             | 如何更新                                 | 更新后                   |
| -------- | ------------------------------------------------ | ---------------------------------------- | ------------------------ |
| `dev`    | 默认分支，日常集成                               | PR：工作分支、`arch`、Dependabot         | 全量测试，部署测试环境   |
| `arch`   | 框架相关改动（不放业务功能），阶段性合入 dev     | PR：框架改动的工作分支                   | 不测试、不部署           |
| `main`   | 生产分支                                         | **只能快进**到已部署 staging 的 dev 提交 | 不测试，直接部署生产环境 |
| 工作分支 | 一次改动，例如 `feat/login`、`arch/auth-adapter` | 不接收 PR，只作为 PR 的来源              | 合并后删除               |

规则：

1. `dev`、`arch`、`main` 都受保护：不能强推、不能删除，不能直接提交改动。
2. 面向 `dev` 与 `arch` 的 PR 都运行 CI，可用标签跳过部分设备测试（见第 4 节）。
3. PR 合入 `dev` 后，dev 运行全量测试，通过后部署测试环境（staging）。
4. `main` 只接受 `dev` 的提交：发布时把 main **快进**到某个 dev 提交，SHA 与 dev 完全一致；
   该提交必须已通过 dev 的全量测试并成功部署 staging。main 不再运行测试，直接复用 staging 验证过的镜像部署生产环境。
5. `arch` 只放框架相关改动（通用能力、适配器、框架基线），不放业务功能；PR 合入后不测试、不部署，
   **阶段性**（例如每周或每个框架里程碑）通过 PR 合入 dev。
6. PR 只能面向 `dev` 或 `arch`。

## 2. 合并方式

GitHub 合并 PR 有三种方式。`Rebase and merge` 与 `Squash and merge` 都会生成**新的提交**（新的 SHA）；
`Create a merge commit` 保留原提交，另加一个合并提交。

| 方向              | 方式                      | 原因                                                                                    |
| ----------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| 工作分支 → `dev`  | **Rebase and merge**      | 历史线性、每个提交可读；工作分支合并后即删除，原 SHA 无需保留                           |
| 工作分支 → `arch` | **Rebase and merge**      | 同上                                                                                    |
| `arch` → `dev`    | **Create a merge commit** | arch 是长期分支；rebase 会在 dev 上生成 arch 提交的副本，之后每次合并都会重复应用或冲突 |
| `dev` → `main`    | **快进推送**，不走 PR     | 三种合并按钮都会生成新 SHA，无法保证 main 与 staging 验证过的提交一致                   |
| 任何方向          | 不使用 Squash             | 丢失提交历史，长期分支之间同样会分叉                                                    |

由此带来的配置要求：

- `dev` 会出现来自 arch 的合并提交，所以 dev 不开启“线性历史”，也不开启“合并前必须与目标分支同步”
  （`arch → dev` 的 PR 无法把 dev 同步进受保护的 arch）。合入后 dev 会再运行全量测试，不降低安全性。
- `main` 快进后包含 dev 的全部历史（包括合并提交），所以 main 也不开启“线性历史”。
- `arch` 只接收 rebase 合并，开启“线性历史”和“合并前必须同步”。

GitHub 的 ruleset 只能按**目标分支**限制合并方式。dev 同时允许 rebase（工作分支）和 merge commit（来自 arch），
合并时需按上表选择。

## 3. CI 与部署在各环节的行为

| 事件                         | 测试                               | 部署                                          |
| ---------------------------- | ---------------------------------- | --------------------------------------------- |
| 开 PR / 向 PR 推送新提交     | 受影响的套件；可用标签跳过设备 E2E | 无                                            |
| PR 合入 `dev`（dev 推送）    | 全量矩阵，不读取标签               | 通过后部署 staging                            |
| PR 合入 `arch`（arch 推送）  | 无                                 | 无                                            |
| main 快进（main 推送）       | 无                                 | 部署 production，复用同一 SHA 的 staging 镜像 |
| 每周日定时                   | 全量矩阵（dev）                    | 无                                            |
| 手动运行 CI / Desktop checks | 全量矩阵 / Desktop 三平台          | 无                                            |

每个 PR 还会运行 `PR policy` 检查：目标分支是 main 或其他分支时失败。

生产部署（`Deploy Ray`）会再次核对：该 SHA 在 dev 上最近一次 CI 已全部成功，存在对应的 staging 部署记录，
五个镜像都是固定 digest；同时重新扫描依赖安全。任一不满足都不会部署。

`PR policy` 与 CI 运行的是 PR 自身版本的脚本和工作流，修改了这些文件的 PR 可以改变检查结果，
因此涉及 `.github/`、`scripts/ci/`、`scripts/release/` 的 PR 需要特别审阅。生产部署不依赖这两个检查。

## 4. PR 标签

| 标签                | 作用（仅 PR 生效）               |
| ------------------- | -------------------------------- |
| `ci:skip-mobile`    | 跳过 Mobile Android/iOS 设备 E2E |
| `ci:skip-desktop`   | 跳过 Desktop 三平台检查          |
| `ci:skip-extension` | 跳过 Chromium 扩展 E2E           |
| `ci:full`           | 运行全量矩阵，优先于所有跳过标签 |

- 只跳过设备/E2E 套件：所有受影响项目（包括 mobile、desktop）的 lint、类型检查、单测和构建仍会执行。
- 被跳过的部分会在合入 dev 后的全量测试中执行；面向 arch 的 PR 跳过的部分，会在 arch 合入 dev 时执行。
- 加或去掉标签后，在该 PR 的 CI 运行页面选择 **Re-run all jobs**，或推送新提交，才会生效。
  只有对仓库有写权限的人能加标签；Dependabot 不会添加 `ci:` 标签。

## 5. GitHub 仓库配置（一次性）

以下设置由仓库管理员在 GitHub 网页上完成，按顺序操作。

### 5.1 合并按钮

Settings → General → Pull Requests：

- 勾选 **Allow merge commits**（`arch → dev` 使用）。
- **取消** Allow squash merging。
- 勾选 **Allow rebase merging**。
- **不要**勾选 Automatically delete head branches：`arch → dev` 合并后它会尝试删除 arch。
  工作分支合并后在 PR 页面点击 Delete branch，或按第 7.6 节删除。

### 5.2 创建标签

在 Issues → Labels 中创建，或在本地执行：

```sh
gh label create ci:skip-mobile --color FBCA04 --description "CI: skip mobile device E2E on this PR"
```

```sh
gh label create ci:skip-desktop --color FBCA04 --description "CI: skip desktop checks on this PR"
```

```sh
gh label create ci:skip-extension --color FBCA04 --description "CI: skip extension E2E on this PR"
```

```sh
gh label create ci:full --color 0E8A16 --description "CI: run the full matrix on this PR"
```

### 5.3 发布部署密钥

main 只允许这把密钥更新（见 5.4），网页上的合并按钮因此无法修改 main。在你自己的电脑上生成：

```sh
ssh-keygen -t ed25519 -f ~/.ssh/ray-release -C "ray main release"
```

建议设置口令。然后在仓库 Settings → Deploy keys → Add deploy key：标题填 `main release`，
粘贴 `~/.ssh/ray-release.pub` 的内容，勾选 **Allow write access**。私钥只保存在发布者自己的电脑上。

在 `~/.ssh/config` 中加入别名：

```text
Host github-ray-release
  HostName github.com
  User git
  IdentityFile ~/.ssh/ray-release
  IdentitiesOnly yes
```

### 5.4 导入 ruleset

四个 ruleset 已写成可导入的 JSON，放在 `.github/rulesets/`：`dev.json`、`arch.json`、`main-gate.json`、`main-release.json`。
仓库中的文件是规则的唯一来源，`scripts/ci/rulesets.test.mjs` 会检查它们与工作流的检查名称、分支策略一致。

**网页导入**（每个文件一次）：Settings → Rules → Rulesets → New ruleset 旁的下拉菜单 → **Import a ruleset** →
选择 JSON 文件 → 核对内容 → Create。

**或用命令导入**（在仓库根目录执行，每个文件一次）：

```sh
gh api -X POST repos/forkpath/postfly.io/rulesets --input .github/rulesets/dev.json
```

```sh
gh api -X POST repos/forkpath/postfly.io/rulesets --input .github/rulesets/arch.json
```

```sh
gh api -X POST repos/forkpath/postfly.io/rulesets --input .github/rulesets/main-gate.json
```

```sh
gh api -X POST repos/forkpath/postfly.io/rulesets --input .github/rulesets/main-release.json
```

以后修改规则时，先改 JSON 并通过测试，再更新 GitHub 上对应的 ruleset（`<id>` 用
`gh api repos/forkpath/postfly.io/rulesets --jq '.[] | {id, name}'` 查询）：

```sh
gh api -X PUT repos/forkpath/postfly.io/rulesets/<id> --input .github/rulesets/dev.json
```

`main-release` 的例外对象是**所有**部署密钥（GitHub 不支持只指定某一把），因此仓库中只能有 `main release`
这一把可写部署密钥；其他部署密钥一律设为只读。

四个 ruleset 的内容：

| 规则                                  | `dev`                          | `arch` | `main-gate`（main）                   | `main-release`（main） |
| ------------------------------------- | ------------------------------ | ------ | ------------------------------------- | ---------------------- |
| Bypass list                           | 空                             | 空     | 空                                    | **Deploy keys**        |
| Restrict updates                      | ✗                              | ✗      | ✗                                     | ✓                      |
| Restrict deletions                    | ✓                              | ✓      | ✓                                     | ✗                      |
| Block force pushes                    | ✓                              | ✓      | ✓                                     | ✗                      |
| Require linear history                | ✗                              | ✓      | ✗                                     | ✗                      |
| Require a pull request before merging | ✓                              | ✓      | ✗                                     | ✗                      |
| → Required approvals                  | 0                              | 0      | —                                     | —                      |
| → Require conversation resolution     | ✓                              | ✓      | —                                     | —                      |
| → Allowed merge methods               | Merge、Rebase                  | Rebase | —                                     | —                      |
| Require status checks to pass         | ✓                              | ✓      | ✓                                     | ✗                      |
| → Require branches to be up to date   | ✗                              | ✓      | ✗                                     | —                      |
| → Status checks                       | `Required checks`、`PR policy` | 同左   | `Required checks`、`Staging verified` | —                      |

- main 拆成两个 ruleset：bypass 只对所在 ruleset 生效。部署密钥可以绕过 `main-release` 的“禁止更新”，
  但仍要满足 `main-gate` 的检查（测试通过、staging 部署成功、只能快进）。任何人（包括管理员）在网页上都无法更新 main。
- `Staging verified` 是一个提交状态，只由 dev 推送后的 CI 在 staging 部署结束时写入：部署成功写 success，失败或被跳过写 failure，
  重跑后以最新一次为准。只有 dev 的提交会部署 staging，因此它同时证明该提交来自 dev。
  没有使用 GitHub 的“Require deployments to succeed”规则：导入时 GitHub 对本仓库返回 `Invalid deployment environments`。
  原来要求的 `Staging deployment` 检查也不再使用：PR 的 CI 中该 job 被跳过，而 GitHub 把跳过视为通过。
- 本仓库的 PR 或持有写权限令牌的人可以伪造 `Staging verified`；单人维护时可以接受，因为生产部署还会再次核对
  dev 的 CI 与 staging 部署记录，伪造的状态无法让未验证的代码上线。团队扩大后应审阅修改 `.github/` 的 PR。
- Required approvals 为 0：单人维护时无法批准自己的 PR。团队增加成员后可改为 1 并开启 CODEOWNERS 审阅。

### 5.5 先在测试分支上验证 main 的规则

main 的规则在直接推送时是否按预期生效，应先实测再依赖。规则只对**更新**已有分支生效，
所以先创建测试分支，再加规则，然后只做更新推送：

1. 在 main 规则还没有包含测试分支时，从 main 创建测试分支：

   ```sh
   git push origin origin/main:refs/heads/ruleset-test
   ```

2. 在网页上编辑 `main-gate` 与 `main-release`，在 Target branches 中都加上 `ruleset-test`（Include by pattern）。
3. 用你的个人账户推送 dev 最新提交，应被“禁止更新”拒绝：

   ```sh
   git push origin origin/dev:refs/heads/ruleset-test
   ```

4. 用部署密钥推送一个**没有 `Staging verified` 状态**的提交，应被拒绝。从 `git log --oneline origin/main..origin/dev`
   中选一个不是最新的提交（只有最新提交会部署 staging），并确认它没有该状态（输出为空）：

   ```sh
   gh api repos/forkpath/postfly.io/commits/<该提交SHA>/status --jq '.statuses[] | select(.context == "Staging verified") | .state'
   ```

   ```sh
   git push git@github-ray-release:forkpath/postfly.io.git <该提交SHA>:refs/heads/ruleset-test
   ```

   查看拒绝信息，确认原因包含缺少 `Staging verified`。

5. 用部署密钥推送 dev 最新提交，应成功。该提交必须是本次改动合入 dev **之后**的提交
   （之前的提交没有 `Staging verified` 状态），并已显示该状态为 success：

   ```sh
   git push git@github-ray-release:forkpath/postfly.io.git origin/dev:refs/heads/ruleset-test
   ```

6. 从两个 ruleset 中移除 `ruleset-test`（或按第 5.4 节用 JSON 文件重新 PUT），再在 GitHub 网页 Branches 页面删除测试分支。

第 4 步如果没有被拒绝，说明状态要求对推送不生效：main 仍受“只允许部署密钥更新”和发布前检查（第 7.4 节）保护，
生产部署时也会再次核对 staging 记录，不会部署未验证的提交。

### 5.6 删除旧的分支保护

仓库目前三个分支配置了旧版分支保护（Settings → Branches）。它与 ruleset 会**同时生效**，
旧规则会与新流程冲突（例如 arch→dev 的 PR 无法满足 dev 的“必须同步”）。

确认 ruleset 均为 Active、第 5.5 节验证完成后，在 Settings → Branches 中依次删除 `dev`、`arch`、`main` 的保护规则。

### 5.7 核对

以下命令只读取设置：

```sh
gh api repos/forkpath/postfly.io/rulesets --jq '.[] | {name, enforcement}'
```

```sh
gh api repos/forkpath/postfly.io --jq '{merge: .allow_merge_commit, squash: .allow_squash_merge, rebase: .allow_rebase_merge, autodelete: .delete_branch_on_merge}'
```

```sh
gh api repos/forkpath/postfly.io/branches/main/protection
```

最后一条应返回 404（旧保护已删除），对 `dev`、`arch` 同样检查。

### 5.8 首次切换

1. 按 5.1～5.7 完成配置。
2. 开 `fix/scaffold-review-3-6 → dev` 的 PR，等待 `Required checks` 与 `PR policy` 通过。
3. 这一次选择 **Create a merge commit**：本地 dev 已包含这些提交，合并提交能让本地 `git pull --ff-only` 直接同步。
4. dev 运行全量测试并部署 staging。staging 部署成功后，才能按第 7.4 节发布到 main。

### 5.9 规则配置错误或 main 被错误更新时

ruleset 对管理员同样生效，但管理员始终可以在 Settings → Rules → Rulesets 中编辑规则，
或把 Enforcement status 临时改为 Disabled。

main 被更新到了错误的提交时（例如规则验证前误操作）：

1. 不要重新发布；生产部署会因找不到该 SHA 的 staging 记录而失败，不会上线错误的代码。
2. 临时把 `main-gate` 设为 Disabled，把 main 恢复到上一个正确的提交：

   ```sh
   git push --force-with-lease=main:<错误的SHA> git@github-ray-release:forkpath/postfly.io.git <正确的SHA>:refs/heads/main
   ```

   这次推送会再次触发生产部署：该提交的 staging 记录仍在（30 天内）时会重新部署这个正确版本；
   记录已过期时部署会失败，生产环境保持原状。

3. 立即把 `main-gate` 恢复为 Active，并核对 main 的提交与生产部署记录。

## 6. `.github` 目录

| 文件                              | 作用                                                                                                       | 约束                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `workflows/ci.yml`                | 主 CI：PR 时按影响范围与标签选择套件；dev 推送时全量运行；汇总为 `Required checks`；dev 上随后部署 staging | 只在面向 dev/arch 的 PR、dev 推送、定时、手动和发布验证时运行；`Required checks` 是必需检查名称，不能改名 |
| `workflows/pr-policy.yml`         | `PR policy` 检查：PR 只能面向 dev 或 arch                                                                  | 不设分支过滤，任何 PR 都运行；检查名称不能改名                                                            |
| `workflows/deploy.yml`            | 部署：被 CI 调用时构建镜像并部署 staging、留下部署记录；main 推送时复用同一 SHA 的记录部署 production      | production 只接受与 dev 同一 SHA、已部署 staging 的提交；可在 main 上手动重跑                             |
| `workflows/security.yml`          | 官方源依赖安全扫描与补丁上游检查；被 CI 调用，并每周定时运行                                               | 不安装依赖即可运行                                                                                        |
| `workflows/desktop.yml`           | Desktop 各平台检查；被 CI 调用，可手动运行                                                                 | runner 可切换到自有机器，见 [自托管 Runner](self-hosted-runners.md)                                       |
| `workflows/release-desktop.yml`   | 根据已有的 `desktop-v*` 标签构建签名发布包（手动）                                                         | 始终使用托管 runner                                                                                       |
| `workflows/release-extension.yml` | 推送 `v*` 标签时先运行全量 CI，再打包发布浏览器扩展                                                        | 调用 CI 时必须授予 CI 及其各 job 申请的全部权限（有测试检查）；传入 ref，不会触发部署                     |
| `rulesets/*.json`                 | dev、arch、main 的分支规则（可导入 GitHub 的 JSON）                                                        | 不会自动生效，需按第 5.4 节导入；修改后先跑 `rulesets.test.mjs` 再更新 GitHub                             |
| `dependabot.yml`                  | 每周创建 npm 与 GitHub Actions 依赖升级 PR                                                                 | `target-branch: dev`；机器人的运行不使用自有机器                                                          |
| `security-mitigations.json`       | 本地安全补丁的豁免记录（到期日、文件哈希）                                                                 | 到期后审计失败；记录的文件哈希变化会使豁免失效                                                            |
| `PULL_REQUEST_TEMPLATE.md`        | PR 描述模板：目标分支、合并方式、跳过标签、验证与兼容性                                                    | —                                                                                                         |
| `CODEOWNERS`                      | 所有文件的默认负责人 `@forkpath`                                                                           | 团队扩大后可配合“需要 Code Owner 审阅”使用                                                                |

工作流引用的脚本在 `scripts/ci/` 与 `scripts/release/`，说明见 [CI 脚本](../../scripts/ci/README.md)。

## 7. 本地命令与流程

本地的 `dev`、`arch`、`main` 只用来**同步远端**，不要在上面直接提交。所有改动都在工作分支上完成。

### 7.1 同步本地受保护分支

```sh
git fetch origin --prune
```

```sh
git switch dev && git pull --ff-only
```

`--ff-only` 保证本地只会快进到远端版本；提示无法快进说明本地 dev 上有不该有的提交，见第 7.7 节。
arch、main 同理。

### 7.2 业务改动：工作分支 → dev

1. 从最新的远端 dev 创建工作分支：

   ```sh
   git fetch origin && git switch -c feat/login origin/dev
   ```

2. 开发并提交（提交信息遵循 commitlint 规范，例如 `feat(web): add login form`）。
3. 推送并开 PR：

   ```sh
   git push -u origin feat/login
   ```

   ```sh
   gh pr create --base dev --fill
   ```

4. 与移动端、桌面端无关的改动可加跳过标签，然后在 PR 的 CI 运行页面选择 Re-run all jobs：

   ```sh
   gh pr edit --add-label ci:skip-mobile --add-label ci:skip-desktop
   ```

5. `Required checks` 与 `PR policy` 通过后，在 PR 页面选择 **Rebase and merge**。
6. 同步本地并删除工作分支（第 7.1、7.6 节）。

### 7.3 框架改动：工作分支 → arch，阶段性 arch → dev

1. 从远端 arch 创建工作分支（建议以 `arch/` 开头）：

   ```sh
   git fetch origin && git switch -c arch/auth-adapter origin/arch
   ```

2. 推送并开面向 arch 的 PR，通过后选择 **Rebase and merge**。arch 合并后不运行测试：

   ```sh
   git push -u origin arch/auth-adapter
   ```

   ```sh
   gh pr create --base arch --fill
   ```

3. 阶段性（例如每周或一个框架里程碑完成时）把 arch 合入 dev：

   ```sh
   gh pr create --base dev --head arch --title "chore: merge arch into dev" --body "Merge framework changes from arch."
   ```

4. 通过后选择 **Create a merge commit**（不能选 rebase）。合入后 dev 运行全量测试并部署 staging。

arch 不接收 dev 的改动，两者差异越大，`arch → dev` 越容易冲突，因此不要间隔太久。

### 7.4 发布：快进 main

1. 同步并确认 main 可以快进到 dev（main 必须是 dev 的祖先）：

   ```sh
   git fetch origin dev main && git merge-base --is-ancestor origin/main origin/dev && echo ok
   ```

2. 确认要发布的 dev 提交的 CI 已全部成功（包括 `Staging deployment`）：

   ```sh
   gh run list --workflow ci.yml --branch dev --event push --commit "$(git rev-parse origin/dev)"
   ```

   结果应为 `completed` 与 `success`，并且该提交带有 `Staging verified` 状态 success：

   ```sh
   gh api "repos/forkpath/postfly.io/commits/$(git rev-parse origin/dev)/status" --jq '.statuses[] | select(.context == "Staging verified") | .state'
   ```

   只有 dev 的**最新**提交会运行 CI 并部署 staging，发布对象是它。

3. 用发布部署密钥快进推送（不加 `--force`；不能快进时 git 会拒绝）：

   ```sh
   git push git@github-ray-release:forkpath/postfly.io.git origin/dev:refs/heads/main
   ```

4. main 推送后自动运行 `Deploy Ray` 部署 production。部署失败时可在 main 上手动运行 `Deploy Ray`。

推送被拒绝时，常见原因：该提交的测试或 staging 部署未成功（等待或修复后重跑 dev 的 CI）；
main 不是 dev 的祖先（main 被错误更新过，见第 5.9 节）。

### 7.5 PR 落后或冲突

面向 arch 的 PR 要求与 arch 同步。PR 显示落后时，在 PR 页面选择 Update branch → **Update with rebase**，或在本地：

```sh
git fetch origin && git rebase origin/arch
```

```sh
git push --force-with-lease
```

`--force-with-lease` 只用于**自己的工作分支**。面向 dev 的 PR 有冲突时同理，把 `origin/arch` 换成 `origin/dev`。

**`arch → dev` 的 PR 有冲突时**，不能在 PR 页面解决：解决冲突需要向受保护的 arch 推送合并提交。
改用临时同步分支（日期替换为当天）：

```sh
git fetch origin && git switch -c sync/arch-20261015 origin/arch
```

```sh
git merge origin/dev
```

解决冲突并提交后推送，开面向 dev 的 PR 并关闭原来的 `arch → dev` PR；该 PR 同样选择 **Create a merge commit**：

```sh
git push -u origin sync/arch-20261015
```

```sh
gh pr create --base dev --title "chore: merge arch into dev" --body "Merge arch with conflicts resolved against dev."
```

### 7.6 删除已合并的工作分支

```sh
git switch dev && git pull --ff-only
```

```sh
git branch -D feat/login
```

```sh
git push origin --delete feat/login
```

用 Rebase and merge 合并后，本地工作分支的提交与 dev 上的副本 SHA 不同，`git branch -d` 会提示未合并，
确认 PR 已合并后用 `-D` 删除。

### 7.7 常见错误与恢复

| 情况                                     | 处理                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 推送 dev/arch/main 被拒绝（GH006/GH013） | 正常现象：dev/arch 只能通过 PR 修改，main 只能用发布部署密钥快进                                                           |
| 在本地 dev 上误提交了改动                | `git switch -c fix/my-change` 把提交带到新分支，再 `git switch dev && git reset --hard origin/dev` 让本地 dev 回到远端版本 |
| `git pull --ff-only` 提示无法快进        | 先用 `git log origin/dev..dev` 查看本地多出的提交；需要保留就按上一行移到工作分支，然后 `git reset --hard origin/dev`      |
| 对 main 开了 PR                          | `PR policy` 会失败。关闭该 PR，按第 7.4 节发布                                                                             |
| `arch → dev` 误用了 rebase               | dev 上多了 arch 提交的副本，两条分支已分叉；不要强推。下次 arch→dev 时用 merge commit，并留意重复改动造成的冲突            |
| `arch → dev` 的 PR 有冲突                | 按第 7.5 节用 `sync/arch-日期` 分支解决后开新 PR，不要在 PR 页面解决冲突                                                   |
| `PR policy` 提示目标分支不允许           | 在 PR 页面 Edit 把 base 改为 dev 或 arch，或关闭后重新创建                                                                 |
| 发布推送被拒绝                           | 见第 7.4 节末尾                                                                                                            |
