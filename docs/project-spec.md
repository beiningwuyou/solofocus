# 个人工作台项目定义

## 目标

- 用户：个人长期使用。
- 问题：目标、项目、任务、资料和复盘分散，缺少统一且可追溯的本地工作流。
- 结果：通过桌面 App 管理 Markdown Vault，并保持数据可读、可迁移、可由 Obsidian 直接访问。

## 核心流程

1. 从首页和收集箱查看当前信息。
2. 将内容整理为愿景、项目、任务、文档或资料。
3. 在计划、执行和复盘中持续更新，所有结果写回 Markdown。

## 当前范围

### Must

- 本地 Markdown Vault 是唯一数据事实源。
- 核心实体可以查询、创建、更新、归档。
- macOS App 可以独立启动并读取正式用户数据。
- AI 建议在用户确认后才写入。

### Later

- 正式 Developer ID 签名和公证。
- 独立仓库、自动化发布与跨设备安装验证。
- 更完整的桌面端端到端测试。

### Not Now

- 多用户账号系统。
- 云端数据库取代 Markdown。
- 未经确认的 AI 自动写入或自动决策。

## 技术与数据

- 前端：React 19、Vite、TypeScript。
- 后端：Fastify、TypeScript。
- 桌面端：Tauri 2、Rust。
- 包管理器：pnpm。
- 正式用户数据：`~/Library/Application Support/个人工作台/vault`。
- 本地日志：`~/Library/Logs/pgt-workbench.log`。

## 完成标准

- `./scripts/test.sh` 和 `./scripts/build.sh` 通过。
- `./scripts/install-local.sh` 可以从当前源码生成安装版。
- 安装版脱离项目目录后仍能读取 Vault。
- 移动或重新克隆源码不会丢失正式数据。
