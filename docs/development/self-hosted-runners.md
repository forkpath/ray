# 自托管 Runner 配置与使用手册

本手册说明如何把自有的 Mac 和 Windows 机器配置成 GitHub Actions runner，用来执行 iOS 与 Desktop 测试，
以及日常怎样使用、切换和清理。按章节顺序操作即可。

## 1. 概览

私有仓库在 GitHub 托管 runner 上，macOS 按 10 倍、Windows 按 2 倍计算分钟数。最耗分钟的是 iOS 模拟器测试和
Desktop 的三个平台测试，这些任务可以改在自有机器上执行。

- **默认行为不变**：不做任何设置时，所有任务仍在 GitHub 托管 runner 上运行。
- **按任务切换**：设置一个仓库变量，对应任务就改到自有机器；删除变量立即切回托管 runner，不需要改代码。
- **始终在托管 runner 上的任务**：后端、Web、生成器、Android、启动验收等 Linux 任务（按 1 倍计费，且依赖干净的
  Docker/KVM 环境），以及 Desktop 签名发布（签名密钥不放到长期运行的机器上）。

| 仓库变量                       | 任务                     | 默认托管镜像     |
| ------------------------------ | ------------------------ | ---------------- |
| `RAY_RUNNER_IOS`               | Mobile iOS 模拟器 E2E    | `macos-26`       |
| `RAY_RUNNER_DESKTOP_MAC_ARM64` | Desktop macOS arm64 检查 | `macos-15`       |
| `RAY_RUNNER_DESKTOP_MAC_X64`   | Desktop macOS x64 检查   | `macos-15-intel` |
| `RAY_RUNNER_DESKTOP_WIN`       | Desktop Windows x64 检查 | `windows-2025`   |

## 2. 为什么要这样配置

### 2.1 runner 必须运行在已登录的桌面里

iOS 模拟器和 Desktop（Electron）测试都会**真的打开窗口**，就像有人在屏幕前操作。系统只有在某个用户
登录到桌面后，程序才能打开窗口。

- **macOS**：runner 以“登录项”方式运行，用户登录后才启动。机器无人值守时需要“开机自动登录”。
  但开启 FileVault（全盘加密）后，开机必须先输入密码解锁磁盘，macOS 因此禁止自动登录。结果是：
  一旦断电或系统更新重启，机器会一直停在密码界面，runner 不会上线，直到有人去输入密码。
- **Windows**：runner 可以装成“系统服务”，开机就运行，但服务运行在一个看不见、没有屏幕的后台会话中，
  Electron 窗口无法打开，测试会失败或卡住。所以改为：自动登录一个专用账户，登录后再启动 runner。

### 2.2 机器人发起的运行只用托管 runner

托管 runner 每个任务结束后整台虚拟机都会销毁；自有机器会一直保留磁盘上的东西。

Dependabot 定期创建“升级第三方依赖”的 PR，分支就建在本仓库里，所以“只拦截 fork 的 PR”拦不住它。
CI 会安装并运行这些新版本依赖。如果某个依赖版本被投毒（供应链攻击），恶意代码会在你的物理机器上执行，
并且可能留下长期存在的东西。因此由机器人发起的运行、机器人创建的 PR（即使是你点了“更新分支”）
以及 fork 的 PR，一律使用托管 runner。人工审阅、合并后的代码才会在自有机器上运行。

### 2.3 选择逻辑放在脚本里，并且出错就停

选择哪台机器的规则写在 `scripts/ci/runners.mjs` 中，而不是直接写在 workflow 的 YAML 表达式里：

- YAML 表达式只能推到 GitHub 上运行才知道对不对；脚本可以在本地用测试验证。
- 脚本会检查变量：格式不对、缺少 `self-hosted` 标签，或者架构不符时（例如把 x64 任务指到 M4，
  会在 Rosetta 转译下运行，测出来的不是真正的 x64 结果）整次运行直接失败，而不是悄悄换到别处。

### 2.4 机器离线时任务会排队，而不是失败

任务被分配到你的机器，而机器关机、睡眠或 runner 停止时，GitHub 不会报错，而是让任务一直排队等待，最长 24 小时。
这期间 `Required checks` 没有结果，PR 无法合并，之后的 dev 运行也会排在后面。处理方法见第 13 节。

## 3. 机器分配

| 机器                             | runner 名称 | 自定义标签                         | 承担的任务                    |
| -------------------------------- | ----------- | ---------------------------------- | ----------------------------- |
| M4 Max，macOS 27，Xcode 27.0     | `ray-m4`    | `ray-ios`、`ray-desktop-mac-arm64` | iOS 模拟器 E2E、Desktop arm64 |
| Intel i9，macOS 15，Xcode 26.3   | `ray-i9`    | `ray-desktop-mac-x64`              | Desktop x64                   |
| Windows 11 x64                   | `ray-win`   | `ray-desktop-win`                  | Desktop Windows               |
| Intel i7，macOS 26（日常开发机） | 不注册      | —                                  | 与本地开发冲突，不作为 runner |

- 每台机器只运行**一个** runner，同一时间只执行一个任务。M4 上 iOS 与 Desktop arm64 依次执行，
  一个 90 分钟的 iOS 任务会让 Desktop arm64 排在它后面。
- 注册时 GitHub 会自动添加 `self-hosted`、系统（`macOS`/`Windows`）和架构（`ARM64`/`X64`）标签，表中只列需要手动加的。

## 4. 开始前的准备

- 本分支（含 `scripts/ci/runners.mjs` 与更新后的 workflow）已推送到 GitHub。仓库变量只对包含这些修改的分支生效，
  在合并到 dev 之前，dev 上的 CI 不受变量影响。
- 每台机器接通电源、网络稳定。Mac 磁盘剩余空间建议：M4 至少 100 GB（Xcode、模拟器运行时与缓存），i9 至少 50 GB。
- 你在 GitHub 上对本仓库有管理员权限（注册 runner 和设置变量需要）。
- 每台机器上有一个你自己的管理员账户，用于安装软件。

## 5. 每台 Mac 的通用设置（M4 与 i9）

以下步骤在 M4 和 i9 上各做一遍。除特别说明外，使用你的**管理员账户**操作。

### 5.1 创建 runner 专用账户

1. 系统设置 → 用户与群组 → 添加用户，类型选择**标准**（不是管理员），账户名建议 `ghrunner`。
2. 该账户不登录 Apple ID，不存放个人的 SSH 密钥、云服务凭据或其他私人资料。

### 5.2 自动登录与 FileVault（二选一，请自行决定）

- **方案 A：无人值守（推荐用于放在家中固定位置的机器）**
  1. 系统设置 → 隐私与安全性 → FileVault → 关闭（解密需要一段时间）。
  2. 系统设置 → 用户与群组 → “自动以此身份登录” → 选择 `ghrunner`。
  3. 代价：磁盘不加密，机器丢失时数据可被读取。runner 账户里不应有私人数据。
- **方案 B：保留 FileVault**
  1. 不开启自动登录。
  2. 每次重启（断电、系统更新）后，需要有人去输入密码并登录 `ghrunner`，在此之前该机器的任务会排队。
     必要时按第 13 节切回托管 runner。

### 5.3 防止睡眠和意外重启

```sh
sudo pmset -a sleep 0 disksleep 0 displaysleep 0
```

- MacBook 合盖会进入睡眠，**保持屏幕打开**（或接外接显示器、键盘使用合盖模式）。
- 系统设置 → 通用 → 软件更新 → 自动更新：关闭“安装 macOS 更新”，避免系统自动升级导致工具链变化或停在登录界面。
- 系统设置 → 锁定屏幕：为 `ghrunner` 关闭“不活跃时启动屏幕保护程序”和“需要密码”，避免锁屏影响窗口测试。

### 5.4 安装基础工具

1. 安装 Homebrew（按 [brew.sh](https://brew.sh) 的说明，用管理员账户）。
2. 接受系统默认 Xcode 的许可并完成首次初始化（否则 `git` 和 Desktop 构建都无法使用）：

   ```sh
   sudo xcodebuild -license accept
   sudo xcodebuild -runFirstLaunch
   ```

3. Node、pnpm、Java 由 workflow 按固定版本自动安装，不需要预装。

## 6. M4 Max 专项：iOS 环境

CI 固定的版本在 `scripts/testing/mobile-tools.json`：当前为 Xcode **26.6**、iOS 模拟器运行时 **26.5**、
设备型号 iPhone 17 Pro。机器上原有的 Xcode 27 保留不动，另外并行安装一份 26.6。

1. 用你的 Apple ID 从 [Apple 开发者下载页](https://developer.apple.com/download/all/) 下载 `Xcode_26.6.xip`。
2. 解压并放到**固定路径**（CI 会检查这个路径，名字必须完全一致）：

   ```sh
   cd ~/Downloads
   xip --expand Xcode_26.6.xip
   sudo mv ~/Downloads/Xcode.app /Applications/Xcode_26.6.app
   ```

   一定要在 `~/Downloads` 中执行。如果在 `/Applications` 中执行 `mv Xcode.app`，会把现有的 Xcode 27 改名。

3. 初始化并安装模拟器运行时（管理员账户）：

   ```sh
   sudo /Applications/Xcode_26.6.app/Contents/Developer/usr/bin/xcodebuild -license accept
   sudo /Applications/Xcode_26.6.app/Contents/Developer/usr/bin/xcodebuild -runFirstLaunch
   DEVELOPER_DIR=/Applications/Xcode_26.6.app/Contents/Developer xcodebuild -downloadPlatform iOS -buildVersion 26.5
   ```

   如果最后一步失败，可以从开发者下载页下载 iOS 26.5 模拟器运行时，再执行
   `xcrun simctl runtime add <下载的文件>`。

4. **验证 Xcode 26.6 能在 macOS 27 上运行**（这一点尚未确认，是 iOS 能否放到 M4 的前提）：

   ```sh
   DEVELOPER_DIR=/Applications/Xcode_26.6.app/Contents/Developer xcodebuild -version
   ```

   应输出 `Xcode 26.6`。如果报“不支持此 macOS 版本”之类的错误，**不要设置 `RAY_RUNNER_IOS`**，
   M4 只承担 Desktop arm64；iOS 继续使用托管 runner。

5. 安装 CocoaPods：`brew install cocoapods`。用 `pod --version` 记下版本，并与
   [macos-26 托管镜像清单](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md)
   中的版本比较；差异较大导致 `pod install` 失败时，安装与清单一致的版本。

6. 切换到 `ghrunner` 账户，确认能看到运行时与设备型号：

   ```sh
   export DEVELOPER_DIR=/Applications/Xcode_26.6.app/Contents/Developer
   xcrun simctl list runtimes | grep 'iOS 26.5'
   xcrun simctl list devicetypes | grep 'iPhone 17 Pro'
   ```

   必须带上 `DEVELOPER_DIR`：不带时使用的是系统默认的 Xcode 27，与 CI 实际使用的不同。

## 7. Intel i9 专项：Desktop x64

Desktop 测试不依赖特定 Xcode 版本，现有的 Xcode 26.3 即可，只需完成第 5 节（尤其是接受许可）。
该机器系统为 macOS 15，与托管的 `macos-15-intel` 一致，结果最接近。

## 8. Windows 11 专项：Desktop Windows

以下命令在**以管理员身份运行的 PowerShell** 中执行。

### 8.1 创建专用账户

```powershell
$password = Read-Host -AsSecureString '为 ghrunner 设置密码'
New-LocalUser -Name ghrunner -Password $password -PasswordNeverExpires
Add-LocalGroupMember -SID S-1-5-32-545 -Member ghrunner   # 内置 Users 组，适用于任何系统语言
```

### 8.2 安装工具

```powershell
winget install --id Git.Git -e
winget install --id Microsoft.PowerShell -e
# 关闭当前窗口，重新打开一个“以管理员身份运行”的 PowerShell，让 git 生效后再继续
git config --system core.longpaths true
New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
```

- Workflow 在 Windows 上默认使用 PowerShell 7（`pwsh`）执行命令。
- 如果之后安装依赖时出现 `node-gyp` 编译错误，再安装 Visual Studio Build Tools 并勾选“使用 C++ 的桌面开发”。

### 8.3 自动登录、防睡眠

1. 下载微软官方的 [Sysinternals Autologon](https://learn.microsoft.com/sysinternals/downloads/autologon)，
   填写 `ghrunner` 和密码后启用（密码加密保存在系统中）。
2. 如果启用了 BitLocker：仅使用 TPM 自动解锁时不影响自动登录；如果设置了开机 PIN，则与 FileVault 的情况相同，
   重启后需要人工输入。
3. 关闭睡眠和休眠：

   ```powershell
   powercfg /change standby-timeout-ac 0
   powercfg /change monitor-timeout-ac 0
   powercfg /hibernate off
   ```

   笔记本还需在“电源选项 → 选择关闭盖子的功能”中把“接通电源时”设为“不采取任何操作”。
   以 `ghrunner` 登录后，在“设置 → 账户 → 登录选项”中把“如果你已离开，Windows 应在何时要求你重新登录”设为“从不”，
   避免锁屏影响 Electron 窗口。
   在“Windows 更新 → 高级选项 → 使用时段”中设置合适的时段，减少白天自动重启。

## 9. 注册 runner

### 9.1 macOS（在 `ghrunner` 账户中操作）

1. 用管理员账户在浏览器打开：仓库 → Settings → Actions → Runners → **New self-hosted runner**，
   选择 macOS 和对应架构（M4 选 ARM64，i9 选 x64）。
2. 登录 `ghrunner`，打开终端，按页面上 “Download” 部分的命令下载并解压到 `~/actions-runner`
   （页面命令包含当前版本号和校验步骤，请原样复制）。
3. 执行页面 “Configure” 部分的命令，并加上名称和标签，例如 M4：

   ```sh
   cd ~/actions-runner
   ./config.sh --url https://github.com/forkpath/postfly.io --token <页面上的令牌> \
     --name ray-m4 --labels ray-ios,ray-desktop-mac-arm64 --work _work --unattended
   ```

   i9 使用 `--name ray-i9 --labels ray-desktop-mac-x64`。

   注册令牌只在该页面使用，有效期约 1 小时；不要保存到文件、聊天或仓库中。

4. 确认 `~/actions-runner/.path` 中包含 Homebrew 路径（M4 为 `/opt/homebrew/bin`，i9 为 `/usr/local/bin`）。
   缺少时手动加入，否则 `pod` 等命令会找不到。

### 9.2 Windows（在 `ghrunner` 账户中操作）

1. 同样打开 New self-hosted runner 页面，选择 Windows x64。
2. 登录 `ghrunner`，在 PowerShell 中按页面命令下载并解压到 `C:\actions-runner`，然后配置：

   ```powershell
   cd C:\actions-runner
   .\config.cmd --url https://github.com/forkpath/postfly.io --token <页面上的令牌> `
     --name ray-win --labels ray-desktop-win --work _work --unattended
   ```

   **不要**加 `--runasservice`（原因见 2.1）。如果 `C:\actions-runner` 是用管理员账户创建的，
   先在其“属性 → 安全”中给 `ghrunner` 完全控制权限。

### 9.3 关于 runner 组

本仓库的 runner 注册在**仓库级别**，只有本仓库能使用。runner 组是组织账户才有的功能；如果以后把仓库迁移到组织，
请把这些 runner 放进只允许本仓库使用的组。

## 10. 安装清理钩子并启动 runner

### 10.1 清理钩子

钩子在每个任务开始前和结束后自动运行：结束从 runner 工作目录启动的残留进程（Metro、Maestro、Electron 等），
删除名为 `ray-e2e-*` 的模拟器（CI 创建的），不影响其他进程和模拟器。即使上一个任务被强制取消，下一个任务开始前也会清理。

脚本由管理员账户安装到一个 runner 账户**只能读、不能改**的目录，再在 runner 配置中引用。
这样仓库中的脚本改动不会悄悄改变机器上执行的内容；但它不能防御恶意任务本身（任务以 `ghrunner` 身份运行，
可以修改 runner 目录中的配置），这也是第 2.2 节只让可信事件使用自有机器的原因。仓库中的脚本更新后，需要重新安装。

先用管理员账户获取 `scripts/ci/self-hosted/` 下的脚本：克隆本仓库，或在 GitHub 网页上打开文件后下载。

macOS（**管理员账户**安装，`<目录>` 为脚本所在位置）：

```sh
sudo mkdir -p /Users/Shared/ray-runner-hooks
sudo cp <目录>/macos-job-cleanup.sh <目录>/macos-maintenance.sh /Users/Shared/ray-runner-hooks/
sudo xattr -c /Users/Shared/ray-runner-hooks/*.sh
sudo chown -R root:wheel /Users/Shared/ray-runner-hooks
sudo chmod 755 /Users/Shared/ray-runner-hooks /Users/Shared/ray-runner-hooks/*.sh
```

然后切换到 `ghrunner` 账户，在 runner 配置中启用：

```sh
cat >> ~/actions-runner/.env <<'EOF'
ACTIONS_RUNNER_HOOK_JOB_STARTED=/Users/Shared/ray-runner-hooks/macos-job-cleanup.sh
ACTIONS_RUNNER_HOOK_JOB_COMPLETED=/Users/Shared/ray-runner-hooks/macos-job-cleanup.sh
EOF
```

Windows（**管理员 PowerShell** 安装）：

```powershell
$hooks = 'C:\ProgramData\ray-runner-hooks'
New-Item -ItemType Directory -Force $hooks
Copy-Item <目录>\windows-job-cleanup.ps1, <目录>\windows-maintenance.ps1 $hooks
# 从网页下载的文件带有“来自网络”标记，PowerShell 会拒绝执行，必须解除
Get-ChildItem $hooks | Unblock-File
# 只允许管理员和系统修改，ghrunner 只能读取和执行
icacls $hooks /inheritance:r /grant:r 'Administrators:(OI)(CI)F' 'SYSTEM:(OI)(CI)F' 'ghrunner:(OI)(CI)RX'
Add-Content C:\actions-runner\.env "ACTIONS_RUNNER_HOOK_JOB_STARTED=$hooks\windows-job-cleanup.ps1"
Add-Content C:\actions-runner\.env "ACTIONS_RUNNER_HOOK_JOB_COMPLETED=$hooks\windows-job-cleanup.ps1"
```

钩子通过 runner 提供的 `RUNNER_TEMP` 推出工作目录；推不出时会在任务日志中打印警告，这时在 `.env` 中加一行
`RAY_RUNNER_WORK_DIR=<runner 目录>/_work`。修改 `.env` 后需要重启 runner。

### 10.2 启动并设置开机自启

macOS（`ghrunner` 账户）：

```sh
cd ~/actions-runner
./svc.sh install
./svc.sh start
./svc.sh status
```

Windows（管理员 PowerShell，创建“ghrunner 登录时启动 runner”的计划任务）：

```powershell
$user = "$env:COMPUTERNAME\ghrunner"
$action = New-ScheduledTaskAction -Execute 'C:\actions-runner\run.cmd' -WorkingDirectory 'C:\actions-runner'
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
# 默认在切到电池时停止任务，笔记本短暂断电就会掉线，因此显式允许
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'GitHub Actions Runner' -Action $action -Trigger $trigger -Settings $settings -Principal $principal
```

重启机器，确认自动登录后 runner 自动启动。

### 10.3 检查在线状态

仓库 → Settings → Actions → Runners：三台 runner 均显示 **Idle**（空闲）即为在线；**Offline** 表示未运行。

## 11. 启用与验证

**每次只启用一台机器**，验证通过后再启用下一台。

1. 仓库 → Settings → Secrets and variables → Actions → **Variables** → New repository variable。
   变量值整行原样填写，包括方括号和引号：

   | 变量                           | 值                                                        |
   | ------------------------------ | --------------------------------------------------------- |
   | `RAY_RUNNER_DESKTOP_MAC_X64`   | `["self-hosted","macOS","X64","ray-desktop-mac-x64"]`     |
   | `RAY_RUNNER_DESKTOP_WIN`       | `["self-hosted","Windows","X64","ray-desktop-win"]`       |
   | `RAY_RUNNER_DESKTOP_MAC_ARM64` | `["self-hosted","macOS","ARM64","ray-desktop-mac-arm64"]` |
   | `RAY_RUNNER_IOS`               | `["self-hosted","macOS","ARM64","ray-ios"]`               |

   建议顺序：i9 → Windows → M4 Desktop → M4 iOS（最后一项依赖第 6 节第 4 步验证通过）。

2. 验证 Desktop：Actions → **Desktop checks** → Run workflow → 选择本分支 → Run。
   三个平台都会运行，点开刚启用的那个平台任务，在 “Set up job” 日志中确认 `Runner name` 是你的机器，并且任务成功。
   同时确认日志中没有清理钩子的 “work directory not found” 警告。
3. 验证 iOS：Actions → **CI** → Run workflow → 选择本分支 → Run。手动运行是全量运行，
   会同时执行其他 Linux 任务（按 1 倍计费）。确认 mobile 的 ios 任务在 `ray-m4` 上成功。
4. 任一验证失败：先删除刚加的变量，按第 15 节排查后再试。

## 12. 日常使用

- **看任务在哪台机器上跑**：打开任务日志 → “Set up job” → `Runner name`。
- **临时停用某台机器**（维护、外出、要关机）：先删除对应变量，再停止 runner。顺序不能反，否则任务会排队等待。
  - macOS：`cd ~/actions-runner && ./svc.sh stop`；恢复时 `./svc.sh start`。
  - Windows：在任务计划程序中禁用 “GitHub Actions Runner” 任务，并关闭 runner 窗口。
- **runner 程序升级**：自动完成，无需操作。
- **修改了清理或维护脚本**：按第 10.1 节用管理员账户重新安装。
- **修改 iOS 固定版本**（`mobile-tools.json` 的 Xcode 或运行时）：先在 M4 上安装新版本并验证，再合并修改。

## 13. 机器离线或任务卡住时

现象：任务长时间显示 “Waiting for a runner to pick up this job”。

1. 在 Settings → Actions → Runners 查看状态。若为 Offline：检查机器是否睡眠、是否停在登录界面、
   runner 是否在运行（macOS：`./svc.sh status`）。
2. 一时无法恢复时，切回托管 runner：
   1. 删除（或清空）对应的仓库变量。
   2. 在卡住的运行页面点击 **Cancel workflow**。排队中的运行不能直接重跑；dev 的推送运行不会自动取消旧运行，
      一个卡住的运行会挡住之后所有 dev 运行。
   3. 取消后点击 **Re-run all jobs**。选择 runner 的步骤会重新读取变量，任务改到托管 runner 上执行。
      只重跑失败任务不会重新选择 runner。

## 14. 缓存与磁盘清理

清理分三层，前两层自动完成：

| 层级     | 内容                                                                                           | 执行方式                 |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------------ |
| 每个任务 | 残留进程、`ray-e2e-*` 模拟器                                                                   | 清理钩子（第 10.1 节）   |
| 每周     | 不可用模拟器、Xcode DerivedData、CocoaPods 缓存、runner 临时目录、14 天前的诊断日志、pnpm 存储 | 维护脚本（第 14.1 节）   |
| 按需手动 | 旧的模拟器运行时、旧 Xcode、`_work/_tool` 中的旧工具版本                                       | 磁盘不足时（第 14.2 节） |

构建产物不需要额外清理：每次检出代码前，`actions/checkout` 会删除工作目录中所有未跟踪文件。

### 14.1 每周维护脚本

维护脚本只删除可重新生成的缓存，有任务正在运行时自动跳过。先手动预览一次将删除的内容：

```sh
/Users/Shared/ray-runner-hooks/macos-maintenance.sh --dry-run
```

```powershell
C:\ProgramData\ray-runner-hooks\windows-maintenance.ps1 -DryRun
```

脚本只在 `ghrunner` 账户、且该账户已配置 runner 时执行；用其他账户运行会直接退出，不会删除任何内容。

macOS 定时（`ghrunner` 账户，每周日 4:00）：

```sh
cat > ~/Library/LaunchAgents/com.ray.runner-maintenance.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.ray.runner-maintenance</string>
  <key>ProgramArguments</key>
  <array><string>/Users/Shared/ray-runner-hooks/macos-maintenance.sh</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/ghrunner/Library/Logs/ray-runner-maintenance.log</string>
  <key>StandardErrorPath</key><string>/Users/ghrunner/Library/Logs/ray-runner-maintenance.log</string>
</dict>
</plist>
EOF
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ray.runner-maintenance.plist
```

Windows 定时（管理员 PowerShell，每周日 4:00）：

```powershell
$user = "$env:COMPUTERNAME\ghrunner"
$action = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument '-NoProfile -File C:\ProgramData\ray-runner-hooks\windows-maintenance.ps1'
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 4am
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Runner maintenance' -Action $action -Trigger $trigger -Settings $settings -Principal $principal
```

### 14.2 磁盘不足时的手动清理（macOS）

```sh
xcrun simctl runtime list                 # 查看已安装的模拟器运行时
xcrun simctl runtime delete <运行时 ID>     # 删除不再固定使用的旧版本
du -sh ~/actions-runner/_work/_tool/*     # 查看各工具占用，可删除不再使用的旧版本目录
```

旧的 Xcode（例如升级固定版本后不再使用的 `/Applications/Xcode_<旧版本>.app`）可用管理员账户直接删除。

## 15. 常见问题

| 现象                                                          | 原因与处理                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| select 或 runners 任务失败：`RAY_RUNNER_… must include …`     | 变量值格式或标签不对，按第 11 节表格原样填写                                    |
| `Pinned Xcode 26.6 not found at /Applications/Xcode_26.6.app` | M4 未按第 6 节安装到固定路径                                                    |
| `pod: command not found`                                      | runner 的 `.path` 缺少 Homebrew 路径（第 9.1 节第 4 步），修改后重启 runner     |
| Desktop 或 iOS 测试卡住、窗口打不开                           | runner 不在已登录的桌面会话中运行：macOS 检查自动登录，Windows 不要使用服务方式 |
| 任务一直排队                                                  | 机器离线或标签不匹配，见第 13 节                                                |
| 磁盘不足                                                      | 运行维护脚本，并按第 14.2 节手动清理                                            |

## 16. 安全须知

- 仅由可信事件使用自有机器：推送、手动运行、定时运行，以及本仓库分支上由人发起的 PR。机器人与 fork 的运行一律使用托管 runner。
- 保持仓库设置中“运行来自 fork 的 PR 工作流”处于关闭状态。
- runner 账户为非管理员，不存放个人凭据；清理与维护脚本由管理员安装在 runner 账户无法修改的目录中。
- 不要在这些机器上运行签名发布任务。
