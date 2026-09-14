# Personal Workbench

本项目是 Tauri + React + Fastify 的本地优先个人工作台。`PROJECT.md` 定义产品范围；真实用户数据位于 `~/Library/Application Support/个人工作台/vault`，不在源码目录中。

## 主要位置

- `src/client/`：界面。
- `src/server/`：API、Markdown 和 Vault 逻辑。
- `src/shared/`：共享领域模型。
- `src-tauri/`：桌面端与打包。
- `assets/design/`：设计规范和 token 真源。
- `scripts/`：统一开发、测试、构建和安装入口。

## 约束

- 修改结构化笔记前读取 Vault 中的 `_System/SCHEMA.md` 和 `AGENTS.md`。
- 保留 Markdown 正文、未知 frontmatter 字段、注释、嵌入和附件。
- 不删除笔记；按要求移动到 `90-Archive/`。
- AI 写入必须先提供预览并由用户确认。
- 不在源码中硬编码工作区路径；通过环境变量、应用配置目录或脚本自身位置解析路径。
- 不提交 Vault、密钥、依赖目录、运行时、缓存或构建产物。

## 设计任务

修改 `src/client/**` 的视觉呈现前，读取：

- `assets/design/harness/context.md`
- `assets/design/harness/tokens.json`
- `assets/design/harness/antipatterns.md`

只通过 token 调整颜色、间距、圆角、字号和动效。不要手改自动生成的 `tokens.generated.css` 或 `themes.generated.*`。完整细则见 `docs/design-development.md`。

## 验证

```bash
./scripts/test.sh
./scripts/build.sh
```

涉及安装版、Vault 路径或 Tauri 运行时的修改，还必须运行 `./scripts/install-local.sh`，从用户入口启动应用并验证 `/api/bootstrap`。
