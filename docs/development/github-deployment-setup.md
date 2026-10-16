# GitHub 部署配置清单

本文对应 `.github/workflows/ci.yml`、`.github/workflows/deploy.yml` 和
`scripts/release/deploy.sh`。按下面的顺序完成一次配置，后续发布即可复用。
命令中的 `owner/repo`、域名、用户、目录和密钥路径都要替换成自己的值。

`dev` 的 CI 成功后构建镜像并部署到 staging；staging 的公开 HTTPS 探针成功后，
才能把**同一个提交 SHA**推广到 main，使用同一组镜像部署 production。
流程和失败恢复见 [部署架构](../architecture/deployment.md)。

## 1. 确认服务器和 GitHub 前提

- 当前镜像在 x64 runner 上构建，部署主机使用 Linux amd64，并安装 Docker Engine
  和支持 `docker compose up --wait` 的 Compose v2。
- 部署用户能通过 SSH 密钥登录、写入部署目录，并直接执行 Docker，无需交互输入 sudo 密码。
- 每套环境都有独立部署目录、数据库密码、认证密钥和持久卷。共用服务器时还需不同的
  `COMPOSE_PROJECT_NAME`、`GATEWAY_HTTP_PORT` 和 `GATEWAY_HTTPS_PORT`。
- 域名解析到网关入口，有有效 HTTPS 证书；GitHub 托管 runner 能访问 SSH 和公开 HTTPS。
- 私有仓库的 Environments/部署分支限制需要支持该功能的 GitHub 方案，例如个人 GitHub Pro。
  Actions 账单和预算允许任务执行；有凭据但 runner 无法启动也不能完成部署。

服务器上以部署用户检查：

```sh
uname -m
docker version
docker compose version
docker info >/dev/null
```

`uname -m` 应为 `x86_64`。Arm 主机需要先增加并验证相应架构的镜像构建。

## 2. 仓库 Variables：构建时使用

位置：**Settings → Secrets and variables → Actions → Variables**。
这两个值放在仓库级，不能只放在 Environment；镜像构建 job 不绑定部署环境。

| 名称                  | 必填 | 示例与用途                                                                      |
| --------------------- | ---- | ------------------------------------------------------------------------------- |
| `BUILD_PUBLIC_ORIGIN` | 是   | `https://app.example.com`；正式站点 canonical URL，构建时用于 SSR/file 宿主回退 |
| `CONTACT_EMAIL`       | 是   | `support@example.com`；公开联系邮箱，构建校验使用                               |

```sh
gh variable set BUILD_PUBLIC_ORIGIN --repo owner/repo --body 'https://app.example.com'
gh variable set CONTACT_EMAIL --repo owner/repo --body 'support@example.com'
```

公开的 `VITE_*`/`EXPO_PUBLIC_*` 不能存放私密凭据。当前流程要求 staging 和 production
共用构建时的前端配置；浏览器 API、认证和邀请链接使用当前同源网关。
不能靠修改服务器 `.env` 改写镜像中已经编译的客户端值。

## 3. Environment 配置：部署时使用

位置：**Settings → Environments**，创建名称准确的 `staging` 和 `production`。
在 **Deployment branches and tags** 选择指定分支：staging 仅允许 `dev`，production
仅允许 `main`，都不增加 tag 规则。环境名正确但分支规则不匹配时，部署无法开始。

以下项目在**两套 Environment 中分别设置**，同名但值可以不同：

| 类型     | 名称                      | 格式与用途                                                                                                    |
| -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Secret   | `DEPLOY_HOST`             | SSH 主机名或 IP；不含 `ssh://`、用户名或端口                                                                  |
| Secret   | `DEPLOY_USER`             | 服务器上实际部署用户，例如 `ray-deploy`                                                                       |
| Secret   | `DEPLOY_SSH_KEY`          | 该用户用于登录的完整私钥，保留头尾和换行；对应公钥安装到该用户的 `authorized_keys`                            |
| Secret   | `GHCR_PULL_TOKEN`         | 有目标私有镜像读取权限的 PAT **classic**，scope 为 `read:packages`                                            |
| Variable | `DEPLOY_HOST_FINGERPRINT` | SSH **服务器主机密钥**的 SHA256 指纹，只填 `SHA256:…`，详见下一节                                             |
| Variable | `DEPLOY_PATH`             | 已准备好的绝对目录，例如 `/opt/ray-staging`、`/opt/ray-production`；不含空格或末尾 `/`，不设置则为 `/opt/ray` |
| Variable | `DEPLOY_PORT`             | SSH 端口，通常 `22`；不是 HTTPS 端口                                                                          |
| Variable | `PUBLIC_ORIGIN`           | 本环境公网入口，例如 `https://staging.example.com`；必须是 HTTPS，不含路径、用户名或末尾 `/`                  |

当前 SSH action 没有接入 `passphrase` 参数，使用独立的无口令部署私钥；不能直接放入
带口令的个人私钥。每套环境可以使用独立密钥。

当前服务器拉取镜像时的用户名来自 `github.actor`。使用与发布触发账号相匹配的 PAT，
并确认该账号能读取目标 package；仅有 `read:packages` scope 不会自动赋予私有镜像访问权。
多人或机器人发布前，应先明确拉取身份并调整 workflow，避免让 token 与用户名不匹配。
构建推送使用工作流自动提供的 `GITHUB_TOKEN`，不需要另建 `GHCR_PUSH_TOKEN`。

CLI 示例（其他 Secret 交互输入，不写入 shell 历史）：

```sh
gh secret set DEPLOY_HOST --env staging --repo owner/repo
gh secret set DEPLOY_USER --env staging --repo owner/repo
gh secret set GHCR_PULL_TOKEN --env staging --repo owner/repo
gh secret set DEPLOY_SSH_KEY --env staging --repo owner/repo < /secure/path/staging-key
gh variable set DEPLOY_PATH --env staging --repo owner/repo --body '/opt/ray-staging'
gh variable set DEPLOY_PORT --env staging --repo owner/repo --body '22'
gh variable set PUBLIC_ORIGIN --env staging --repo owner/repo --body 'https://staging.example.com'
```

production 使用相同名称，把 `--env` 改为 `production`，填入正式环境自己的值。
不要把私钥、token 或服务器 `.env` 提交到仓库、贴进聊天或打印到 Actions 日志。

### SSH 主机指纹：匹配实际协商的主机密钥，只取第二列

在服务器的**可信控制台**执行，读取服务器 host key，不是部署用户的登录公钥：

```sh
for RAY_HOST_KEY in /etc/ssh/ssh_host_*_key.pub; do
  test -f "$RAY_HOST_KEY" || continue
  printf '%s\n' "$RAY_HOST_KEY"
  ssh-keygen -lf "$RAY_HOST_KEY" -E sha256
done
sudo sshd -T | awk '$1 == "hostkey" { print }'
```

第一组命令列出各类型公钥的指纹；第二个命令检查默认 sshd 配置启用的主机密钥。
如果监听部署端口的 sshd 使用了自定义配置，应检查该实例实际加载的配置。

当前固定的 SCP/SSH action 使用 Go SSH 客户端，其默认协商顺序将普通 ECDSA 主机密钥
放在 ED25519 前面。因此，**只取 ED25519 指纹并不总是正确**：服务器同时提供 ECDSA
时，实际握手可能选中 ECDSA，随后与 ED25519 指纹比较就会失败。上传文件和远程执行
都必须匹配实际协商的服务器主机密钥。部署用户的登录私钥仍可使用 ED25519，两者用途不同。
依据见 [SCP 客户端算法顺序](https://github.com/golang/crypto/blob/v0.37.0/ssh/common.go)、
[SSH 客户端默认算法顺序](https://github.com/golang/crypto/blob/v0.45.0/ssh/common.go) 和
[指纹比较实现](https://github.com/appleboy/easyssh-proxy/blob/v1.5.0/easyssh.go)。

确认当前服务提供默认 ECDSA 主机密钥时，单独提取它：

```sh
ssh-keygen -lf /etc/ssh/ssh_host_ecdsa_key.pub -E sha256
```

单个公钥的输出形式如下（这里省略真实哈希；类型也可能是 RSA 或 ED25519）：

```text
256 SHA256:<服务器的43位Base64哈希> root@server (ECDSA)
```

`DEPLOY_HOST_FINGERPRINT` **只填写 `SHA256:` 加哈希这一列**。不要包括 `256`、空格、
`root@server` 或 `(ECDSA)`。以上 ECDSA 情况可以直接取第二列：

```sh
ssh-keygen -lf /etc/ssh/ssh_host_ecdsa_key.pub -E sha256 | awk '{print $2}'
```

将结果作为 `gh variable set DEPLOY_HOST_FINGERPRINT --env staging --repo owner/repo --body '提取的完整指纹'`
的值，production 也要在自己的服务器上独立确认。若不提供 ECDSA，必须根据实际协商类型
选择对应指纹，不能机械替换文件名。

遇到 `host key fingerprint mismatch` 时，先确认 `DEPLOY_HOST`、`DEPLOY_PORT` 和
可信控制台对应同一台 SSH 服务器，再核对启用的密钥类型与指纹。服务器重装或更换
host key 后也要重新确认。不能关闭指纹检查、自动接受网络扫描得到的新指纹，或为了
通过 CI 就修改服务器主机密钥。格式校验成功只证明字符串合法，不证明主机身份已匹配。

## 4. 服务器 `.env`：应用运行时使用

GitHub Secret 只提供发布连接和拉取凭据。工作流**不会上传服务器 `.env`**，必须事先
在每台服务器的 `DEPLOY_PATH/.env` 创建。目录拼写需与 GitHub Variable 完全一致。
即使 GitHub 上的全部配置已填完，缺少这个文件仍会报 `Missing environment file`，
并在登录镜像仓库、拉取镜像和执行迁移之前停止。已有配置在其他目录时，应核对
`DEPLOY_PATH`，不要覆盖原文件或重新生成已有数据库的密码。

以下以 staging 为例，由已创建的部署用户执行；若 `/opt` 目录没有写权限，由管理员
先创建目录并赋予该部署用户所有权。`touch` 不会清空已有文件：

```sh
mkdir -p /opt/ray-staging
chmod 700 /opt/ray-staging
touch /opt/ray-staging/.env
chmod 600 /opt/ray-staging/.env
```

按下面模板编辑文件。所有 `REPLACE_...` 都必须替换；不同密码和两套环境分别生成，
例如每次执行 `openssl rand -hex 32` 获取一个 URI 安全的随机值。
`LOGGER_FILE_ENABLED` 和 `LOGGER_FILE_COMPRESS` 当前必须显式设置，否则后端配置初始化会失败。

```dotenv
COMPOSE_PROJECT_NAME=ray-staging
PUBLIC_ORIGIN=https://staging.example.com
BETTER_AUTH_URL=https://staging.example.com
CORS_ORIGINS=https://staging.example.com
BETTER_AUTH_SECRET=REPLACE_WITH_UNIQUE_RANDOM_SECRET

POSTGRES_USER=ray
POSTGRES_PASSWORD=REPLACE_WITH_UNIQUE_POSTGRES_PASSWORD
POSTGRES_DB=ray
REDIS_PASSWORD=REPLACE_WITH_UNIQUE_REDIS_PASSWORD
MONGO_INITDB_ROOT_USERNAME=ray
MONGO_INITDB_ROOT_PASSWORD=REPLACE_WITH_UNIQUE_MONGO_PASSWORD
MONGO_INITDB_DATABASE=ray
RABBITMQ_DEFAULT_USER=ray
RABBITMQ_DEFAULT_PASSWORD=REPLACE_WITH_UNIQUE_RABBITMQ_PASSWORD

EMAIL_FROM=noreply@example.com
CONTACT_EMAIL=support@example.com
LOGGER_SCOPE=ray
LOGGER_FILE_ENABLED=false
LOGGER_FILE_COMPRESS=false

# 使用 Kong 自带 ACME；DNS 和公网 80/443 必须通向本机网关
KONG_AUTO_TLS=true
DOMAIN=staging.example.com
ACME_EMAIL=ops@example.com
GATEWAY_HTTP_PORT=80
GATEWAY_HTTPS_PORT=443
```

若由外层反向代理/负载均衡器提供 HTTPS，设置 `KONG_AUTO_TLS=false`，让外层转发到
Kong 的 HTTP 监听端口，并正确转发 WebSocket 和原始协议信息；域名仍使用外部 HTTPS
入口。同机多套环境或已有代理占用 80/443 时，分配不同的网关宿主机端口。
生产环境还需替换项目名、域名、邮箱和全部密码；两个环境的持久卷不得共用。

Kong 首次收到域名的 TLS 请求时会异步申请证书，在签发完成前可能先返回默认自签证书。
部署探针因此先等待最多 180 秒，直到 `/api/v1/health` 通过正常证书验证并返回 200。
连接/证书尚未就绪和 502/503/504 允许有限等待；其他 HTTP 状态直接失败，重定向也不会
被当作健康。期间不关闭 TLS 校验，不改走 HTTP；证书一直无效、DNS/端口不可达或服务
始终未就绪都会使部署失败。健康就绪后的页面、会话和权限断言仍只执行一次，不靠重试
掩盖认证错误。签发过程参见 [Kong ACME](https://developer.konghq.com/plugins/acme/)。

部署 Compose 已设置 `KONG_LUA_SSL_VERIFY_DEPTH=3`，继续使用镜像的系统 CA 信任库。
锁定的 Kong 镜像默认深度为 1，无法验证当前 Let’s Encrypt ACME 服务的交叉签名链；
其日志会报 `acme directory request failed: 20: unable to get local issuer certificate`。
这是 Kong 连接签发服务时的出站 TLS 验证失败，尚未进入域名挑战验证；随后出现的
`please try again in ... seconds` 是插件的失败退避，并不表示已被 Let’s Encrypt 限流。
此配置不需要再填入 GitHub 或服务器 `.env`，部署时会自动应用。若更新后仍报同样错误，
检查运行容器的配置和出站证书链，不能通过关闭证书校验或导入来历不明的 CA 绕过。

首次部署前，在目标 Linux 服务器检查 80/443 是否已被现有 Web 服务或容器占用：

```sh
sudo ss -ltnp '( sport = :80 or sport = :443 )'
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

若已有 Nginx、Caddy 或其他网关，需要先明确入口归属。保留现有代理时，为 Kong 设置
未占用的 `GATEWAY_HTTP_PORT` / `GATEWAY_HTTPS_PORT`，按前述方式配置 HTTPS 终止和
反向代理；由 Kong 独占公网入口时，先确认旧服务可以退役，再释放对应端口。不要直接
停止未知服务、删除容器或清理数据卷。仅修改端口而没有相应代理转发，仍无法通过公网验收。

Compose 自动注入容器之间的数据库/Redis/Mongo/RabbitMQ 地址和应用端口，不要把本地开发的
`localhost` 连接串复制进去。`NODE_ENV=production` 由 Compose 注入，五个 `*_IMAGE`
digest 由部署工作流提供，不需要手动写进 `.env`。

基础部署不要求启用所有外部集成。实际使用邮件、OAuth、支付、存储等功能时，再按
[环境配置说明](environment.md) 和对应库 README 配置提供商凭据、回调地址及已验证域名。
服务器上线不自动创建本地开发演示账号，也不要在生产环境执行开发用 seed。

完成后，以实际部署用户核对文件存在、非空且可读；不输出文件内容：

```sh
test -s /opt/ray-staging/.env && test -r /opt/ray-staging/.env && printf 'READY\n'
```

production 在自己的部署目录执行同样检查。该检查只确认文件已准备好，配置值是否
正确仍由实际镜像拉取、数据库迁移、容器健康与公开探针验证。

## 5. 核查配置和首次发布

以下命令可核对 Variables 的值和 Secret **名称**；GitHub 不允许读回 Secret 明文：

```sh
gh variable list --repo owner/repo
gh variable list --env staging --repo owner/repo
gh variable list --env production --repo owner/repo
gh secret list --env staging --repo owner/repo
gh secret list --env production --repo owner/repo
gh api repos/owner/repo/environments/staging/deployment-branch-policies
gh api repos/owner/repo/environments/production/deployment-branch-policies
```

变量齐全只说明静态配置已完成；实际 SSH 登录、host key 校验、镜像权限、容器健康和公网
HTTPS 探针都通过后，才算部署验收完成。`Required checks` 是测试汇总，`Staging deployment`
是独立部署门禁，不能只看到前者绿色就认为服务器已上线。

1. 功能 PR 的 `Required checks` 成功后合入 `dev`。
2. 等待该 dev SHA 的**整次 CI**成功，包括 staging 部署和公开探针；记录保留 30 天。
3. 确认已按 [分支维护](branch-workflow.md#5-github-仓库配置一次性) 配置 ruleset：main 要求同一 SHA 的
   `Required checks` 与 `Staging verified` 状态、只允许发布部署密钥更新、禁止强推和删除。
4. 首次发布且远端 main **尚不存在**时（此时还没有 main 的 ruleset），在干净工作目录执行：

   ```sh
   git fetch origin dev
   git push origin origin/dev:refs/heads/main
   ```

   main 已存在时先验证可 fast-forward，按 [分支维护 · 发布](branch-workflow.md#74-发布快进-main) 使用发布部署密钥推送。
   不使用会产生新 SHA 的 merge/squash/rebase 按钮推广已验证发布，也不使用 force push。

5. 检查 main 的 `Deploy Ray` 成功、生产公网入口可用，且部署记录使用 staging 的同一组 digest。

## 常见失败与恢复

| 现象                                 | 检查与处理                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Runner 未启动，提示账单/预算         | 处理 GitHub Actions 费用和预算，再重跑受影响的 job                                                |
| 构建镜像时 `No space left on device` | 发布 runner 会先清理闲置预装工具链；检查该步骤和磁盘余量，不删除服务器数据卷                      |
| `Configure the SSH host fingerprint` | 只保留 `SHA256:哈希`；完整的 `ssh-keygen -lf` 输出不能直接粘贴                                    |
| SSH host key 不匹配                  | 核对主机/端口及实际协商的密钥类型；默认 ECDSA 与 ED25519 指纹不同，不能跳过校验                   |
| SSH 认证失败                         | 核对用户、完整私钥、无口令要求，以及该用户的 `authorized_keys`                                    |
| `Missing environment file`           | 在与 `DEPLOY_PATH` 完全一致的目录创建 `.env`，检查权限和目录拼写                                  |
| GHCR `unauthorized`/`denied`         | 检查 PAT classic 的有效期、`read:packages`、package 读取权限和拉取账号                            |
| 数据库或容器启动失败                 | 查看失败服务日志，核对本环境密码；不要删除持久卷来绕过问题                                        |
| Kong 报 `address already in use`     | 用 `ss` 和 `docker ps` 确认端口归属，再接入现有代理或释放端口；不要误停其他站点                   |
| 已释放端口，但 Kong 没有实际端口映射 | 比较 `docker port` 与 inspect 的实际 `NetworkSettings.Ports`；仅重建本环境 Kong，保留其他服务与卷 |
| ACME directory 报 issuer 验证失败    | 确认已部署 `KONG_LUA_SSL_VERIFY_DEPTH=3`，检查系统 CA 与出站证书链；失败退避期间不要反复重跑部署  |
| HTTPS/公开探针失败                   | 检查 DNS、证书、80/443、反向代理和 `PUBLIC_ORIGIN`；容器 healthy 不代表公网可达                   |
| 找不到可推广记录                     | 确认同一 SHA 的 dev CI 整次成功，记录未过期且对应最新 attempt                                     |

CI 按 affected 选择测试，复用 pnpm、Gradle、CocoaPods/原生编译及 BuildKit 缓存。
安全扫描与本地补丁核验先于测试选择和设备矩阵；发现未修复告警时不启动昂贵任务。
少数尚无上游发布版的修复遵循[限期本地补丁规则](dependency-governance.md#node-forge有期限的本地安全补丁)，
原始扫描与独立评估报告同时保留，production 推广前重新检查。
发布工作流、Docker 和发布脚本变更保留全仓质量与真实镜像检查，但不会单独触发设备构建。
移动端受影响代码仍运行 Android；原生配置、共享依赖、共享测试工具或主 CI 的共享配置、
测试任务变更继续运行两套设备测试。仅修改主 CI 的 `deploy-staging` / `staging-deployment`
任务时，选择器比较完整 YAML 结构，确认其他配置和任务不变后，再用剩余变更计算移动端
影响范围；全仓质量与真实镜像检查不受此例外影响。定时和显式 full 运行保留完整矩阵。
部署公网探针及其专用测试也属于部署变更；单独修改它们不重建设备，混合移动源码、
共享依赖或原生测试工具变更时仍运行对应设备矩阵。
账单恢复或部署配置修正后，优先重跑必要失败 job，不重复启动已通过的 Android/iOS 完整矩阵。
例如 SSH 或服务器 `.env` 修正后，先找到失败部署 job 的 `databaseId`，再只重跑它及
依赖它的汇总检查；保留成功的镜像构建和测试结果：

```sh
gh run view RUN_ID --repo owner/repo --json jobs \
  --jq '.jobs[] | select(.conclusion == "failure") | {name, databaseId}'
gh run rerun RUN_ID --repo owner/repo --job JOB_DATABASE_ID
```

替换示例中的 run/job ID；优先选择 `Deploy staging / deploy`，不要误选整个构建流程。
重跑 dev CI 会产生新的 attempt，需要与该 attempt 对应的 staging 成功记录。
数据库迁移先于替换应用执行；应用回退不自动撤销迁移，已有数据的环境应先审查迁移兼容性。

参考：[GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)、
[GHCR 身份认证](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry)、
[SSH action 主机指纹](https://github.com/appleboy/ssh-action#host-fingerprint-verification)。
