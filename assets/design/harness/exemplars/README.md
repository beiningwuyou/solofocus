---
id: 5b3d8e21-9a4c-4f07-8c31-6d2e9b7a4f18
kind: document
status: active
tags:
  - system/design
  - system/harness
created: 2026-08-06
updated: 2026-08-06
summary: 组件样例库使用说明——这里是标准答案，不是现状快照。
---

# Exemplars — 组件样例库

## 这是什么

**可直接参照抄写的正确实现。** 给 AI 一个能抄的样例，胜过十条抽象描述。

## 重要：这是标准答案，不是现状快照

样例展示的是**应该长什么样**，不是代码库现在长什么样。

现有代码存在历史债务（见 `antipatterns.md`），
比如 `.button` 用了 `font-weight: 650`、`border-radius: 8px` 而非 `var(--radius)`、
hover 时 `translateY(-1px)` 位移。**这些不要抄。**

生成新组件时以本目录为准。

## 使用方式

1. 找到最接近需求的样例
2. 照搬其 token 使用方式、状态处理、暗色适配写法
3. 不确定某个值该用什么 token → 查 `tokens.json` 的 `usage` 字段

## 现有样例

| 文件 | 覆盖模式 |
|------|---------|
| `data-table.css` | 数据表格——本项目最核心的信息呈现方式 |
| `status-chip.css` | 状态标签——语义色的正确用法 |
| `button.css` | 按钮四变体——含状态与暗色 |

## 维护

- 新组件做得好 → 提炼进这里
- 某样例过时 → 立即替换，不要留旧版本
- 样例本身必须能通过 `pnpm design:lint`
