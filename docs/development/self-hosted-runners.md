# 自托管 Runner 配置与使用手册

本手册说明如何把自有的一台 Intel Mac 和一台 Windows 电脑配置成 GitHub Actions runner，承担全部客户端测试
（Mobile iOS/Android、Desktop macOS x64、Desktop Windows x64），以及日常怎样使用、切换和清理。按章节顺序操作即可。

## 1. 概览

私有仓库在 GitHub 托管 runner 上，macOS 按 10 倍、Windows 按 2 倍计算分钟数，客户端测试是最耗分钟的部分。

- **默认行为不变**：不做任何设置时，所有任务仍在 GitHub 托管 runner 上运行。
- **按任务切换**：设置一个仓库变量，对应任务就改到自有机器；删除变量立即切回托管 runner，不需要改代码。
- **始终在托管 runner 上的任务**：后端、Web、生成器、启动验收、Desktop 发布存储检查等 Linux 任务（按 1 倍计费，
  依赖干净的 Docker 环境），以及 Desktop 签名发布（签名密钥不放到长期运行的机器上）。

| 仓库变量                       | 任务                       | 默认托管镜像                       |
| ------------------------------ | -------------------------- | ---------------------------------- |
| `RAY_RUNNER_IOS`               | Mobile iOS 模拟器 E2E      | `macos-26`                         |
| `RAY_RUNNER_ANDROID`           | Mobile Android 模拟器 E2E  | `ubuntu-24.04`                     |
| `RAY_RUNNER_DESKTOP_MAC_X64`   | Desktop macOS x64 检查     | `macos-15-intel`                   |
| `RAY_RUNNER_DESKTOP_WIN`       | Desktop Windows x64 检查   | `windows-2025`                     |
| `RAY_RUNNER_DESKTOP_MAC_ARM64` | Desktop macOS arm64 检查   | 无：只在设置了变量时运行           |
| `RAY_RUNNER_UNTRUSTED`         | 不可信运行如何处理自有任务 | `skip`，可设 `hosted`（第 2.2 节） |

Apple Silicon 的 Desktop 检查默认不运行；以后有 M 芯片机器时设置 `RAY_RUNNER_DESKTOP_MAC_ARM64` 即可恢复。
注意签名发布流程（`release-desktop.yml`）仍会在托管 `macos-15` 上打包 arm64 版本，这个版本不再经过 CI 的 Desktop 检查。

## 2. 为什么要这样配置

### 2.1 runner 必须运行在已登录的桌面里

iOS 模拟器、Android 模拟器和 Desktop（Electron）测试都会创建设备或窗口，需要一个已登录的图形会话。

- **macOS**：runner 以“登录项”（LaunchAgent）方式运行，用户登录后才启动。开启 FileVault 时 macOS 禁止自动登录，
  重启后要有人输入密码并登录 runner 账户（第 5.2 节）。
- **Windows**：runner 若装成“系统服务”，会运行在没有屏幕的后台会话中，Electron 窗口无法打开。所以改为自动登录
  一个专用账户，登录后再启动 runner。

### 2.2 机器人和 fork 的运行不使用自有机器

托管 runner 每个任务结束后整台虚拟机都会销毁；自有机器会一直保留磁盘上的东西。

Dependabot 的 PR 分支建在本仓库里，CI 会安装并运行新版本依赖。如果某个依赖被投毒，恶意代码会在你的物理机器上执行。
因此机器人发起的运行、机器人创建的 PR（即使是你点了“更新分支”）以及 fork 的 PR，一律不使用自有机器。

对这些运行，已改到自有机器的任务按成本处理：

- Android（托管 Linux，1 倍）和 Desktop Windows（2 倍）改用托管 runner 执行，依赖升级仍有设备测试覆盖。
- iOS 和 Desktop macOS x64 的托管镜像是 macOS（10 倍），**默认跳过**，运行摘要中会列出被跳过的任务。
  `Required checks` 把它们视为“未选择”，不会因此失败。

需要在合并前补上 macOS 任务时：

- 把仓库变量 `RAY_RUNNER_UNTRUSTED` 设为 `hosted`，让这些运行改用托管 macOS（按 10 倍计费）；或
- 审阅依赖改动后，在 Actions → **CI** → Run workflow 中选择该 PR 分支手动运行。发起人是你，属于可信运行，
  **依赖中的构建脚本（Gradle、CocoaPods 插件等）会在你的 Mac 上执行**，只在你确认改动可信时使用。

dev 分支合并后的推送运行始终执行全量测试，会在自有机器上补齐。

### 2.3 选择逻辑放在脚本里，并且出错就停

规则写在 `scripts/ci/runners.mjs`，可以在本地用测试验证。变量格式不对、缺少 `self-hosted` 标签或系统/架构标签不符时，
整次运行直接失败，而不是悄悄换到别处。Android 允许 macOS 或 Linux 机器（需要硬件虚拟化）；x64 Desktop 必须带 `X64` 标签，
避免在 Rosetta 转译下运行。

### 2.4 机器离线时任务会排队，而不是失败

任务分配到你的机器而机器离线时，GitHub 让任务一直排队，最长 24 小时，这期间 PR 无法合并。处理方法见第 12 节。

## 3. 机器分配

| 机器                                                  | runner 名称 | 自定义标签 | 承担的任务                      |
| ----------------------------------------------------- | ----------- | ---------- | ------------------------------- |
| MacBook Pro i7-9750H，16 GB，macOS 26.7.1，Xcode 26.5 | `ray-mac`   | `ray-mac`  | iOS、Android、Desktop macOS x64 |
| Windows 11 x64                                        | `ray-win`   | `ray-win`  | Desktop Windows x64             |

- 每台机器只运行**一个** runner，同一时间只执行一个任务。Mac 上 iOS、Android、Desktop 依次执行：16 GB 内存同时运行
  Xcode 编译、Gradle 和模拟器会互相拖慢甚至被系统杀进程，串行反而更快、更稳定。
- 注册时 GitHub 会自动添加 `self-hosted`、系统（`macOS`/`Windows`）和架构（`X64`）标签，表中只列手动添加的。
- 这台 Mac 也是日常开发机。runner 运行在独立的 `ghrunner` 账户中：iOS 模拟器、缓存、钥匙串都与你的账户分开。
  adb 服务（端口 5037）和 Maestro 的端口是整机共用的，Mobile 任务运行时的注意事项见第 10 节。
  CI 运行期间 CPU 和内存占用较高，本地开发会变慢。

## 4. 缓存与隔离设计

自有机器的速度优势来自“机器上保留缓存”；可靠性来自“只缓存可校验的内容，每次运行的产物都是全新的”。

| 内容                  | 位置（`ghrunner` 账户）                                          | 为什么可以复用                                  | 清理                             |
| --------------------- | ---------------------------------------------------------------- | ----------------------------------------------- | -------------------------------- |
| pnpm 包存储           | `~/Library/pnpm/store`（Windows 在 `%LOCALAPPDATA%\pnpm\store`） | 按内容哈希存放，安装时校验                      | 每周 `pnpm store prune`          |
| Gradle 依赖与构建缓存 | `~/.gradle`                                                      | 按输入哈希命中，Gradle 自动过期未用条目         | Gradle 自动                      |
| CocoaPods 下载缓存    | `~/Library/Caches/CocoaPods`                                     | 按版本与校验和存放                              | 每周                             |
| Xcode 编译缓存（CAS） | `~/.cache/ray-ci/mobile-native`                                  | 内容寻址，只存编译单元结果，按 Xcode 版本分目录 | 超过上限（默认 20 GB）时每周清空 |
| Maestro               | `~/.cache/ray-ci/testing-tools`                                  | 固定版本，SHA-256 校验后写入标记才复用          | 换版本时重新下载                 |
| JDK、Node             | `~/actions-runner/_work/_tool`                                   | `setup-java`/`setup-node` 按固定版本管理        | 手动（第 13.2 节）               |
| Electron 下载缓存     | `~/Library/Caches/electron` 等                                   | 按版本与校验和                                  | 手动                             |

每次运行都是全新的：

- `actions/checkout` 在每个任务开始时删除工作目录中所有未跟踪文件（包括 `node_modules`、`dist`、测试报告），
  所以缓存目录都放在检出目录之外。托管 runner 上仍使用 `actions/cache`，自有机器上跳过这一步。
- Mobile 测试在临时目录中复制应用、生成原生工程，APK/App、DerivedData、AVD、模拟器、Metro 缓存都属于这一次运行，
  结束时删除。Metro 缓存曾在多次运行间串用导致路由校验失败，现在每次运行使用独立的临时目录。
- Desktop 测试的用户数据目录同样是每次新建的临时目录。
- 清理钩子在**每个任务开始前和结束后**运行，即使上一个任务被强制取消，也会结束残留进程（含模拟器、Gradle/Kotlin
  守护进程、Maestro 的 iOS 驱动）、删除 `ray-e2e-*` 模拟器、临时目录和更新测试的安装痕迹。
- 钩子还会检查 runner 账户中是否出现构建工具会自动加载的配置（`~/.gradle/init.d`、`~/.gradle/gradle.properties`、
  `~/.npmrc`）。runner 账户从不需要它们，出现即说明有任务写入，钩子会让任务失败，等你检查。
- 每个任务开始前检查磁盘可用空间，低于 25 GB（`RAY_MIN_FREE_GB`）直接失败，避免空间耗尽时出现难以理解的构建错误。
- 不缓存：构建出的安装包、模拟器状态、测试结果、任何凭据。

## 5. Mac 设置

除特别说明外，使用你自己的**管理员账户**（`forkpath`）操作。

### 5.1 准备磁盘空间

至少保留 **60 GB** 可用空间：`ghrunner` 的各类缓存约 25–30 GB，单次 Mobile 运行临时占用约 15 GB。
用 `df -h /System/Volumes/Data` 查看。以下是本机可回收的主要内容，按需选择（都可以以后重新下载）：

```sh
# 你账户中不再使用的 Android 镜像与 NDK（先确认自己的项目不依赖它们）
sdkmanager --list_installed
sdkmanager --uninstall 'system-images;android-36;google-tv-ps16k;x86_64'   # 示例，按列表中的名称填写
# pnpm 中未被任何项目引用的包、Homebrew 旧版本下载
pnpm store prune
brew cleanup -s
```

### 5.2 创建 runner 账户，决定 FileVault 策略

1. 创建**标准**（非管理员）账户 `ghrunner`，该账户不登录 Apple ID、不存放个人凭据：

   ```sh
   sudo sysadminctl -addUser ghrunner -fullName "GitHub Runner" -password -
   ```

2. FileVault（本机当前为开启状态），二选一，请自行决定：
   - **保留 FileVault（建议，本机是存放个人资料的开发机）**：不开启自动登录。每次重启后，先用你的账户解锁登录，
     再从菜单栏的“快速用户切换”登录一次 `ghrunner`，然后切回自己的账户。`ghrunner` 留在后台会话中继续运行 runner。
     重启前可以先按第 11 节临时停用。
   - **关闭 FileVault 并自动登录 `ghrunner`**：无人值守，但磁盘不加密，不建议用于开发机。

### 5.3 防止睡眠

```sh
sudo pmset -c sleep 0 disksleep 0
```

- 合盖会让 MacBook 睡眠：保持屏幕打开，或接外接显示器使用合盖模式。
- 系统设置 → 通用 → 软件更新 → 自动更新：关闭“安装 macOS 更新”，避免自动重启和工具链变化。

### 5.4 安装共享工具（管理员账户）

```sh
brew install cocoapods                      # 1.17.0，与 macos-26 托管镜像一致；装在 /usr/local/bin，所有账户可用
brew install --cask android-commandlinetools  # 提供 sdkmanager，用于给 ghrunner 安装独立的 Android SDK
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
```

- Xcode 使用现有的 `/Applications/Xcode.app`（26.5，构建号 17F42，与托管镜像相同）。CI 依次查找
  `Xcode_26.5.app`、`Xcode-26.5.app`、`Xcode.app`，使用第一个版本号为 26.5 的，不需要改名。
  以后把 `Xcode.app` 升级到其他版本前，先另装一份 `/Applications/Xcode_26.5.app`。
- iOS 26.5 模拟器运行时和 Java 21（Temurin）是系统级安装，`ghrunner` 可以直接使用。Node、pnpm 由 workflow 按固定版本安装。

### 5.5 安装清理与维护脚本（管理员账户）

脚本安装到 runner 账户**只能读、不能改**的目录。这样仓库中的脚本改动不会悄悄改变机器上执行的内容；
仓库中的脚本更新后需要重新执行本节。

```sh
cd ~/Github/postfly.io   # 已更新到包含本手册的 dev
sudo mkdir -p /Users/Shared/ray-runner-hooks
sudo cp scripts/ci/self-hosted/macos-job-cleanup.sh scripts/ci/self-hosted/macos-maintenance.sh /Users/Shared/ray-runner-hooks/
sudo chown -R root:wheel /Users/Shared/ray-runner-hooks
sudo chmod 755 /Users/Shared/ray-runner-hooks /Users/Shared/ray-runner-hooks/*.sh
```

### 5.6 在 `ghrunner` 账户中安装 Android SDK

用“快速用户切换”登录 `ghrunner`，打开“终端”：

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
SDK=$HOME/Library/Android/sdk
yes | sdkmanager --sdk_root="$SDK" --licenses >/dev/null
sdkmanager --sdk_root="$SDK" 'cmdline-tools;latest' 'platform-tools' 'emulator' 'platforms;android-36' \
  'build-tools;36.0.0' 'ndk;27.1.12297006' 'cmake;3.30.5' 'system-images;android-36;google_atd;x86_64'
"$SDK/emulator/emulator" -accel-check     # 应输出 Hypervisor.Framework ... accel
xcrun simctl list runtimes | grep 'iOS 26.5'
xcrun simctl list devicetypes | grep 'iPhone 17 Pro'
pod --version                             # 1.17.0
```

约占用 10 GB。CI 每次运行前还会用同一个 `sdkmanager` 检查这些包，缺少时才下载。

## 6. Windows 设置

以下命令在**以管理员身份运行的 PowerShell** 中执行。

### 6.1 创建专用账户

```powershell
$password = Read-Host -AsSecureString '为 ghrunner 设置密码'
New-LocalUser -Name ghrunner -Password $password -PasswordNeverExpires
Add-LocalGroupMember -SID S-1-5-32-545 -Member ghrunner   # 内置 Users 组，适用于任何系统语言
```

### 6.2 安装工具

```powershell
winget install --id Git.Git -e
winget install --id Microsoft.PowerShell -e
# 关闭当前窗口，重新打开一个“以管理员身份运行”的 PowerShell，让 git 生效后再继续
git config --system core.longpaths true
New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
```

- Workflow 在 Windows 上默认使用 PowerShell 7（`pwsh`）。Node、pnpm 由 workflow 安装。
- 之后安装依赖若出现 `node-gyp` 编译错误，再安装 Visual Studio Build Tools 并勾选“使用 C++ 的桌面开发”。
- 磁盘至少保留 40 GB 可用空间。

### 6.3 自动登录、防睡眠

1. 下载微软官方的 [Sysinternals Autologon](https://learn.microsoft.com/sysinternals/downloads/autologon)，
   填写 `ghrunner` 和密码后启用（密码加密保存在系统中）。启用了 BitLocker 开机 PIN 时，重启后仍需人工输入。
2. 关闭睡眠和休眠：

   ```powershell
   powercfg /change standby-timeout-ac 0
   powercfg /change monitor-timeout-ac 0
   powercfg /hibernate off
   ```

   笔记本还需在“电源选项 → 选择关闭盖子的功能”中把“接通电源时”设为“不采取任何操作”。
   以 `ghrunner` 登录后，在“设置 → 账户 → 登录选项”中把“如果你已离开，Windows 应在何时要求你重新登录”设为“从不”。
   在“Windows 更新 → 高级选项 → 使用时段”中设置合适的时段，减少自动重启。

### 6.4 安装清理与维护脚本

把仓库中 `scripts/ci/self-hosted/windows-job-cleanup.ps1` 和 `windows-maintenance.ps1` 复制到本机（克隆仓库，
或在 GitHub 网页上下载），`<目录>` 为它们所在位置：

```powershell
$hooks = 'C:\ProgramData\ray-runner-hooks'
New-Item -ItemType Directory -Force $hooks
Copy-Item <目录>\windows-job-cleanup.ps1, <目录>\windows-maintenance.ps1 $hooks
# 从网页下载的文件带有“来自网络”标记，PowerShell 会拒绝执行，必须解除
Get-ChildItem $hooks | Unblock-File
# 只允许管理员和系统修改，ghrunner 只能读取和执行
icacls $hooks /inheritance:r /grant:r 'Administrators:(OI)(CI)F' 'SYSTEM:(OI)(CI)F' 'ghrunner:(OI)(CI)RX'
```

## 7. 注册 runner

注册令牌在 GitHub 页面上生成，有效期约 1 小时；只在 runner 机器上使用，不要保存到文件、聊天或仓库中。

### 7.1 Mac（在 `ghrunner` 账户中操作）

1. 在浏览器打开：仓库 → Settings → Actions → Runners → **New self-hosted runner**，选择 macOS、x64。
2. 在 `ghrunner` 的终端中，按页面 “Download” 部分的命令下载并解压到 `~/actions-runner`（原样复制，含校验步骤）。
3. 配置：

   ```sh
   cd ~/actions-runner
   ./config.sh --url https://github.com/forkpath/postfly.io --token <页面上的令牌> \
     --name ray-mac --labels ray-mac --work _work --unattended
   ```

4. 写入 runner 环境（每个任务都会带上这些变量）：

   ```sh
   cat >> ~/actions-runner/.env <<EOF
   LANG=en_US.UTF-8
   ANDROID_HOME=$HOME/Library/Android/sdk
   ANDROID_SDK_ROOT=$HOME/Library/Android/sdk
   RAY_CI_CACHE_DIR=$HOME/.cache/ray-ci
   RAY_MOBILE_BUILD_JOBS=4
   ACTIONS_RUNNER_HOOK_JOB_STARTED=/Users/Shared/ray-runner-hooks/macos-job-cleanup.sh
   ACTIONS_RUNNER_HOOK_JOB_COMPLETED=/Users/Shared/ray-runner-hooks/macos-job-cleanup.sh
   EOF
   ```

   - `LANG`：CocoaPods 要求 UTF-8。
   - `RAY_MOBILE_BUILD_JOBS`：Xcode 与 Gradle 的并行度。托管 runner 只有 2 核，默认 2；本机 6 核 12 线程、16 GB 内存，
     先用 4，按第 9.2 节记录的耗时再调整。

5. 确认 `~/actions-runner/.path` 中包含 `/usr/local/bin`（`pod`、`sdkmanager` 在这里）；缺少时手动加入。

### 7.2 Windows（在 `ghrunner` 账户中操作）

1. 同样打开 New self-hosted runner 页面，选择 Windows、x64。
2. 登录 `ghrunner`，在 PowerShell 中按页面命令下载并解压到 `C:\actions-runner`，然后配置：

   ```powershell
   cd C:\actions-runner
   .\config.cmd --url https://github.com/forkpath/postfly.io --token <页面上的令牌> `
     --name ray-win --labels ray-win --work _work --unattended
   Add-Content C:\actions-runner\.env 'ACTIONS_RUNNER_HOOK_JOB_STARTED=C:\ProgramData\ray-runner-hooks\windows-job-cleanup.ps1'
   Add-Content C:\actions-runner\.env 'ACTIONS_RUNNER_HOOK_JOB_COMPLETED=C:\ProgramData\ray-runner-hooks\windows-job-cleanup.ps1'
   ```

   **不要**加 `--runasservice`（原因见 2.1）。如果 `C:\actions-runner` 是用管理员账户创建的，
   先在其“属性 → 安全”中给 `ghrunner` 完全控制权限。

runner 注册在**仓库级别**，只有本仓库能使用。

## 8. 启动并设置开机自启

### 8.1 Mac（`ghrunner` 账户）

```sh
cd ~/actions-runner
./svc.sh install
./svc.sh start
./svc.sh status
```

### 8.2 Windows（管理员 PowerShell，创建“ghrunner 登录时启动 runner”的计划任务）

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

### 8.3 检查在线状态

仓库 → Settings → Actions → Runners：两台 runner 显示 **Idle**（空闲）即为在线；**Offline** 表示未运行。

## 9. 启用与验证

### 9.1 设置仓库变量

仓库 → Settings → Secrets and variables → Actions → **Variables** → New repository variable，值整行原样填写：

| 变量                         | 值                                          |
| ---------------------------- | ------------------------------------------- |
| `RAY_RUNNER_DESKTOP_MAC_X64` | `["self-hosted","macOS","X64","ray-mac"]`   |
| `RAY_RUNNER_IOS`             | `["self-hosted","macOS","X64","ray-mac"]`   |
| `RAY_RUNNER_ANDROID`         | `["self-hosted","macOS","X64","ray-mac"]`   |
| `RAY_RUNNER_DESKTOP_WIN`     | `["self-hosted","Windows","X64","ray-win"]` |

也可以在已登录 `gh` 的终端中设置，例如：

```sh
gh variable set RAY_RUNNER_IOS --repo forkpath/postfly.io --body '["self-hosted","macOS","X64","ray-mac"]'
```

`RAY_RUNNER_DESKTOP_MAC_ARM64` 与 `RAY_RUNNER_UNTRUSTED` 保持不设置。建议每次只启用一台机器，验证通过后再启用下一台。

### 9.2 验证

1. Desktop：Actions → **Desktop checks** → Run workflow → 选择分支 → Run。打开对应平台的任务，在 “Set up job”
   日志中确认 `Runner name` 是 `ray-mac` 或 `ray-win`，且任务成功；日志中没有清理钩子的 “work directory not found” 警告。
2. Mobile：Actions → **CI** → Run workflow → 选择分支 → Run（手动运行是全量运行，Linux 任务仍在托管 runner 上）。
   确认 mobile 的 android 与 ios 任务都在 `ray-mac` 上成功。
3. 缓存生效：再手动运行一次 CI。第二次 Mobile 任务中 Maestro 显示 “already installed”，Gradle 与 Xcode 编译明显变快。
   记录两次（冷/热缓存）各任务的耗时，用来调整 `RAY_MOBILE_BUILD_JOBS` 和超时。
4. 无残留：两次运行后，在 `ghrunner` 中执行 `xcrun simctl list devices | grep ray-e2e`、`ls $TMPDIR /tmp | grep ray-`，
   都应没有输出。
5. 后台会话：在你本人账户处于前台、`ghrunner` 在后台时完成以上验证。若 Desktop 或 iOS 测试只在这种情况下超时，
   说明后台会话的窗口渲染被系统节流，需要改为让 `ghrunner` 占用前台（或关闭 FileVault 自动登录）。
6. 任一验证失败：先删除刚加的变量，按第 14 节排查后再试。

## 10. 与本机日常开发共存（Mac）

- runner 在 `ghrunner` 的后台会话中运行，你的桌面不会弹出 CI 的窗口或 iOS 模拟器。
- **adb 是整机共用的**：adb 服务固定监听 5037 端口，Maestro 也只连接这个端口，无法为 runner 单独分配。所以：
  - CI 的 Android 模拟器（`emulator-55xx`，AVD 名为 `ray-e2e-*`）会出现在你的 `adb devices` 和 Android Studio 中，不要操作它；
  - Mobile 任务运行期间，不要在你的账户中重启或停止 adb（包括 Android Studio 的 “Restart ADB”），
    不要运行 Maestro（它固定使用 7001、22087 端口）；
  - 你自己的模拟器可以照常使用，CI 只操作自己创建的那一台。
- 需要整机性能或要做上面这些操作时，按第 11 节临时停用 Mac，用完再恢复。

## 11. 日常使用

- **看任务在哪台机器上跑**：任务日志 → “Set up job” → `Runner name`。
- **临时停用某台机器**（维护、外出、要关机）：先删除（或清空）对应变量，再停止 runner。顺序不能反，否则任务会排队等待。
  - macOS（`ghrunner`）：`cd ~/actions-runner && ./svc.sh stop`；恢复时 `./svc.sh start`。
  - Windows：在任务计划程序中禁用 “GitHub Actions Runner” 任务，并关闭 runner 窗口。
- **runner 程序升级**：自动完成，无需操作。
- **修改了清理或维护脚本**：按第 5.5 / 6.4 节重新安装。
- **修改固定版本**（`scripts/testing/mobile-tools.json` 的 Xcode、模拟器运行时、Android 镜像）：先在 Mac 上安装新版本并验证，
  再合并修改。

## 12. 机器离线或任务卡住时

现象：任务长时间显示 “Waiting for a runner to pick up this job”。

1. 在 Settings → Actions → Runners 查看状态。若为 Offline：检查机器是否睡眠、是否停在登录界面（重启后需登录 `ghrunner`）、
   runner 是否在运行（macOS：`./svc.sh status`）。
2. 一时无法恢复时，切回托管 runner：
   1. 删除（或清空）对应的仓库变量。
   2. 在卡住的运行页面点击 **Cancel workflow**。dev 的推送运行不会自动取消旧运行，一个卡住的运行会挡住之后的 dev 运行。
   3. 取消后点击 **Re-run all jobs**。选择 runner 的步骤会重新读取变量；只重跑失败任务不会重新选择 runner。

## 13. 维护与磁盘清理

| 层级     | 内容                                                                                                                  | 执行方式               |
| -------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 每个任务 | 残留进程、`ray-e2e-*` 模拟器与 Android 模拟器、临时目录、更新测试缓存（Windows 还有安装记录与快捷方式）               | 清理钩子               |
| 每周     | 不可用模拟器、Xcode DerivedData、CocoaPods 缓存、Maestro 日志、超限的 CI 缓存、runner 临时目录、旧诊断日志、pnpm 存储 | 维护脚本（第 13.1 节） |
| 按需手动 | 旧的模拟器运行时、旧 Xcode、`_work/_tool` 中的旧工具版本                                                              | 磁盘不足时（13.2 节）  |

### 13.1 每周维护脚本

维护脚本只删除可重新生成的缓存，有任务正在运行时自动跳过；只在 `ghrunner` 账户、且该账户已配置 runner 时执行。
先预览一次将删除的内容：

```sh
/Users/Shared/ray-runner-hooks/macos-maintenance.sh --dry-run
```

```powershell
C:\ProgramData\ray-runner-hooks\windows-maintenance.ps1 -DryRun
```

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
  <dict><key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/ghrunner/Library/Logs/ray-runner-maintenance.log</string>
  <key>StandardErrorPath</key><string>/Users/ghrunner/Library/Logs/ray-runner-maintenance.log</string>
</dict>
</plist>
EOF
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ray.runner-maintenance.plist
```

CI 缓存的上限默认 20 GB，可在该 plist 的 `EnvironmentVariables` 中加入 `RAY_CI_CACHE_LIMIT_GB` 调整。

Windows 定时（管理员 PowerShell，每周日 4:00）：

```powershell
$user = "$env:COMPUTERNAME\ghrunner"
$action = New-ScheduledTaskAction -Execute 'pwsh.exe' -Argument '-NoProfile -File C:\ProgramData\ray-runner-hooks\windows-maintenance.ps1'
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 4am
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Runner maintenance' -Action $action -Trigger $trigger -Settings $settings -Principal $principal
```

### 13.2 磁盘不足时的手动清理（macOS）

```sh
xcrun simctl runtime list                 # 查看已安装的模拟器运行时
xcrun simctl runtime delete <运行时 ID>     # 删除不再固定使用的旧版本（管理员账户）
du -sh ~/actions-runner/_work/_tool/*     # 查看各工具占用，可删除不再使用的旧版本目录
rm -rf ~/.cache/ray-ci                    # 清空 CI 缓存，下次运行重新生成
```

## 14. 常见问题

| 现象                                                      | 原因与处理                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| select 或 runners 任务失败：`RAY_RUNNER_… must include …` | 变量值格式或标签不对，按第 9.1 节表格原样填写                                             |
| `Pinned Xcode 26.5 not found as /Applications/{…}`        | 三个候选路径中没有版本为 26.5 的 Xcode（第 5.4 节）                                       |
| `pod: command not found` 或 CocoaPods 编码警告            | `.path` 缺少 `/usr/local/bin`，或 `.env` 缺少 `LANG`（第 7.1 节），修改后重启 runner      |
| `test -n "$ANDROID_HOME"` 失败                            | `.env` 缺少 `ANDROID_HOME`（第 7.1 节）                                                   |
| `Not enough free disk space on this runner`               | 按第 13 节清理，或在 `.env` 中调整 `RAY_MIN_FREE_GB`                                      |
| 钩子报 `unexpected configuration in the runner account`   | runner 账户中出现了 Gradle/npm 配置文件，检查来源并删除后再运行（第 4 节）                |
| Android 任务卡住或设备 offline                            | 你的账户在任务期间重启了 adb 或运行了 Maestro（第 10 节），重跑任务                       |
| Desktop 或 iOS 测试卡住、窗口打不开                       | runner 不在已登录的桌面会话中：macOS 检查 `ghrunner` 是否已登录，Windows 不要使用服务方式 |
| 任务一直排队                                              | 机器离线或标签不匹配，见第 12 节                                                          |
| Dependabot PR 中客户端任务显示被跳过                      | 预期行为，见第 2.2 节                                                                     |
| 磁盘不足                                                  | 运行维护脚本，并按第 13.2 节手动清理                                                      |

## 15. 安全须知

- 只有可信事件使用自有机器：推送、手动运行、定时运行，以及本仓库分支上由人发起的 PR。机器人与 fork 的运行不使用自有机器。
- 保持仓库设置中“运行来自 fork 的 PR 工作流”处于关闭状态。
- runner 账户为非管理员，不存放个人凭据；清理与维护脚本由管理员安装在 runner 账户无法修改的目录中。
  这不能防御恶意任务本身（任务以 `ghrunner` 身份运行，可以修改 runner 目录与缓存），这也是只让可信事件使用自有机器的原因。
- 不要在这些机器上运行签名发布任务。
