# agbook

本地优先的小说创作 AI 工作台。围绕 **小说管理 / 设定 / 大纲 / 章节计划 / 章节生成规则 / 审核修订** 的完整创作流程，兼容 OpenAI 风格的模型接入。

> 方案文档：
> - [docs/novel-agent-plan.md](./docs/novel-agent-plan.md)
> - [docs/mvp-feature-list.md](./docs/mvp-feature-list.md)
> - [docs/product-structure-draft.md](./docs/product-structure-draft.md)
> - [docs/technical-architecture-draft.md](./docs/technical-architecture-draft.md)

---

## 技术栈

- 桌面壳：`Tauri v2`（Rust + WebView，跨 macOS / Windows / Linux）
- 前端：`Vite + React + TypeScript + TailwindCSS + Zustand + TanStack Query`
- 后端：`Node.js + Fastify + TypeScript`
- 存储：`SQLite (better-sqlite3) + 本地文件`
- 模型接入：OpenAI 兼容 `chat/completions`
- 打包：`esbuild` + `@yao-pkg/pkg` 将后端打成单文件二进制，通过 Tauri sidecar 嵌入安装包

## 目录结构

```
agbook/
  apps/
    server/          # 本地服务：Fastify + SQLite + 模型网关 + 工作流
      dist-bundle/   # esbuild 打出的 CJS 单文件（供 pkg 消费）
    web/             # 前端工作台：React + Vite + Tailwind
    desktop/         # Tauri 桌面壳（Rust）
      src-tauri/
        binaries/    # pkg 生成的后端二进制（按 target-triple 命名）
        icons/       # 桌面应用图标集
        capabilities/
        src/         # Rust 主进程：启动 sidecar / 回收子进程
  scripts/           # 构建辅助脚本（bundle-server / pkg-server）
  data/              # 开发模式下的数据目录（SQLite + 项目文件）
  docs/              # 方案与技术文档
```

## 环境准备（仅首次）

1. Node.js 20+ 与 npm（推荐 22 / 24）
2. Xcode Command Line Tools：`xcode-select --install`
3. Rust 工具链：
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
   source "$HOME/.cargo/env"
   ```

> Windows 需要安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2) 和 MSVC 构建工具；Linux 需要 `webkit2gtk`、`libgtk-3` 等系统依赖。

## 安装依赖

```bash
npm install
```

首次还需要生成桌面应用的图标集（只需一次）：

```bash
npm run desktop:icons
```

## 开发模式

### 浏览器模式（最轻）

```bash
npm run dev
```

- 后端：`http://127.0.0.1:8787`
- 前端：`http://localhost:5173`
- Vite 会把 `/api` 代理到后端

### 桌面模式

一条命令拉起 `server + web + desktop`，等前端就绪后打开 Tauri 窗口：

```bash
npm run dev:desktop
```

> 开发模式下 **Tauri 不启动 sidecar**（`cfg!(debug_assertions)` 分支跳过），而是复用你本地正在运行的 `npm run dev:server`。这样改代码热重载链路最快。

## 打包安装包

一条命令出当前平台的完整安装包（`.dmg` / `.msi`）：

```bash
npm run desktop:build
```

背后做了四件事：

1. `npm -w @agbook/server run build` — tsc 编译 TS
2. `scripts/bundle-server.mjs` — esbuild 把 `apps/server` 打成单文件 `dist-bundle/server.cjs`
3. `scripts/pkg-server.mjs` — `@yao-pkg/pkg` 把 bundle 打成二进制并放到 `apps/desktop/src-tauri/binaries/agbook-server-<target-triple>`，同时用 `prebuild-install` 替换 `better-sqlite3` 原生 addon 以匹配 pkg 内嵌的 Node 20 ABI
4. `tauri build` — Tauri 把前端静态资源 + 后端二进制（sidecar）一起打进安装包

产物位置：

```
apps/desktop/src-tauri/target/release/bundle/
  ├── macos/agbook.app                  # macOS 应用包（Contents/MacOS 含 agbook-server sidecar）
  ├── dmg/agbook_<ver>_<arch>.dmg       # macOS 安装镜像
  ├── msi/agbook_<ver>_<arch>.msi       # Windows MSI 安装包
  └── nsis/agbook_<ver>_<arch>.exe      # Windows NSIS 安装程序
```

### 运行时行为

- Tauri 启动时在 OS 的应用数据目录（macOS：`~/Library/Application Support/com.agbook.app/`，Windows：`%APPDATA%\com.agbook.app\`）下初始化 SQLite
- Rust 主进程通过 `AGBOOK_DATA_DIR` 环境变量把这个路径注入 sidecar
- sidecar 在 `127.0.0.1:8787` 监听；前端以绝对地址访问后端（通过 `window.location.protocol` 识别 Tauri 环境）
- 应用退出时 Tauri 的 `RunEvent::Exit` 会杀掉 sidecar 子进程，避免僵尸

### 跨平台构建

从 macOS 本地构建 Windows 安装包在带原生模块时极不可靠，生产上走 **GitHub Actions**：

- `.github/workflows/release.yml`：推 `v*` tag 时在 `macos-14`（arm64）、`macos-13`（x64）、`windows-latest` 三个 runner 上各自跑 `npm run desktop:build`，最后把 `.dmg` / `.msi` 收集进 GitHub Release
- 本地只管自己当前平台的包即可

## 首次使用

1. 打开应用（桌面窗口或浏览器）
2. 进入「模型配置」，添加一个 OpenAI 兼容的 Provider（Base URL / API Key / Model）
3. 新建小说 → 填写设定 → 搭建大纲 → 建立章节计划与章节规则 → 生成正文 → 查看审核 → 修订
