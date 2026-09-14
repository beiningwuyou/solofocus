# SoloFocus · 个人工作台 🚀

> **基于“精力调度中枢”隐喻的单兵数字化操作系统**  
> 100% 本地优先（Local-First）· 毫秒级极速响应 · 双轨架构（SQLite + Obsidian Markdown Vault）

[![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-v5-black?logo=fastify)](https://fastify.dev/)
[![Local First](https://img.shields.io/badge/Data-Local--First-green)](https://localfirstweb.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 💡 为什么需要 SoloFocus？

市面上不乏优秀的效率与笔记软件，但多数工具最终都会陷入两类困境：
1. **Notion 类工具的“配置税陷阱”**：搭建耗费大量心智，高压交付时因多层嵌套与卡顿迅速荒废，生产力工具异化为“认知负债”。
2. **传统清单工具的“待办通胀与焦虑”**：无上限的待办池随时间指数级膨胀，每天早晨面对数十条冰冷红点，单点任务与顶层战略目标彻底脱节。

### 核心心智模型：物流调度中枢 (Logistics Dispatch Core)
SoloFocus 彻底抛弃了传统“扁平待办清单”的隐喻，引入**物流调度室**心智模型：
* **卡车容量法则**：单人高强度心流时间刚性受限（以每日 240 分钟为健康基准），单日不可超载。
* **Top 3 刚性锁定**：调度室的核心职责不是“记录还有多少待办”，而是**锁定今日最重要的 3 趟核心交付车次**。
* **科学顺延机制**：超载任务一键调拨至次日班次，心理无痛卸载，杜绝待办积压带来的内耗瘫痪。
* **工序资产复利 (SOP)**：复杂战役沉淀为标准作业程序（SOP），避免经验散落，让每一次交付都在沉淀个人数字资产。

---

## ✨ 核心特性

- 🖥️ **今日专注大盘**：单屏聚合今日 Top 3 核心战役、微习惯律动、倒计时番茄钟与快捷工序抽屉。
- ⚡️ **双轨数据架构**：
  - **SQLite (WAL 模式)**：支撑毫秒级界面渲染、复杂关系查询与状态流转。
  - **Obsidian 兼容 Markdown Vault**：作为数据终极真实源（Single Source of Truth），所有成果透明可读，零数据绑定。
- 📥 **智能抓取中枢**：支持邮件（IMAP 协议本地同步）、快捷灵感收集箱，经过人机协同（HITL）确认后分发至领域与项目。
- 🛡️ **100% 离线与隐私优先**：
  - 纯本地运行，不设任何云端账号系统；
  - 零数据偷跑，你的笔记、任务、日程全部存储在你的本地硬盘上。
- 🎨 **基于 Design Token 的严苛设计系统**：严格遵循专业级高保真视觉规范，打造沉浸式 Native 质感。

---

## 🏗️ 技术架构

```text
┌─────────────────────────────────────────────────────────────┐
│                 macOS 桌面壳 (Tauri 2 · Rust)                │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   前端界面 (React 19)  │ ◄IPC► │   后端服务 (Fastify)  │  │
│  │   - Tailwind CSS      │       │   - TypeScript        │  │
│  │   - CodeMirror 6      │       │   - Node 22 原生 SQLite│  │
│  └───────────────────────┘       └───────────┬───────────┘  │
└──────────────────────────────────────────────┼──────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
      ┌─────────────────────────────────┐             ┌─────────────────────────────────┐
      │     本地 SQLite 数据引擎        │             │    Markdown Vault (Obsidian)    │
      │  - 状态机 / 缓存 / 毫秒查询      │             │  - 纯文本 / 长期归档 / 100% 自主 │
      └─────────────────────────────────┘             └─────────────────────────────────┘
```

---

## 📂 项目结构

- `src/client/`：React 界面、页面与状态逻辑。
- `src/server/`：Fastify API 与 Vault 读写、SQLite 数据持久化。
- `src/shared/`：前后端共享领域模型。
- `src-tauri/`：macOS 桌面壳、图标和打包配置。
- `assets/design/`：设计规范、token、主题和视觉基线。
- `scripts/`：开发、验证、构建与安装入口。
- `data/samples/`：可提交的匿名测试样例 Vault。
- `packaging/macos/`：本地安装与正式分发说明。
- `docs/`：设计开发细则（[daily-routine.md](docs/daily-routine.md)、[design-development.md](docs/design-development.md)）。

---

## 🚀 快速开始

### 依赖环境
* Node.js >= 22.0.0
* pnpm >= 9.0.0
* Rust & Cargo（若需要编译 Tauri 桌面端）

### 1. 本地运行 (开发模式)

```bash
# 安装依赖
pnpm install

# 推荐：使用仓库内置的匿名样例库启动（与个人实际数据物理隔离）
export WORKBENCH_VAULT_PATH="$(pwd)/data/samples/vault"
./scripts/dev.sh
```
应用将自动启动并在浏览器打开：`http://127.0.0.1:5173`（API 服务监听在 `4317` 端口）。

### 2. 自动化测试与构建

```bash
# 运行单元测试
./scripts/test.sh

# 构建前端与服务端
pnpm build

# 构建 Tauri 桌面安装包
./scripts/build.sh
```

### 3. 安装到本机 Applications

```bash
./scripts/install-local.sh
```
该脚本将构建并更新 `/Applications/个人工作台.app`，并将 Vault 路径配置记录在系统 Application Support 中，实现 App、源码与用户数据的物理分离。

---

## 🔐 隐私与数据安全

- **零数据上报**：本项目绝不包含任何遥测（Telemetry）、网络埋点或第三方追踪服务。
- **本地凭据隔离**：所有敏感配置（如邮件 IMAP 授权码）均保存在系统 `Application Support` 目录中，受到严格的系统权限保护，绝不会被 Git 提交或上传。
- **无云端绑定**：即使未来卸载此应用，所有 Markdown 笔记仍然完好无损地保存在本地文件夹中，可用 Obsidian 或任意文本编辑器随时打开。

---

## 📜 开源协议

本项目采用 [MIT License](LICENSE) 授权协议。
