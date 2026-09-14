---
id: 88d452e7-e3e8-4f81-8fb9-7837a583bfd1
kind: document
status: active
tags:
  - system/design
created: 2026-08-02
updated: 2026-08-02
summary: 个人通用目标工作台的桌面、目标页和移动端视觉规范。
---

# Personal Workbench V1 Design Spec

视觉基准：

- ![[personal-workbench-dashboard-v1.png]]
- ![[personal-workbench-goals-v1.png]]
- ![[personal-workbench-mobile-v1.png]]

## 视觉方向

- 真白背景 `#FFFFFF`，深海军蓝选中态 `#112C54`。
- 低到中等信息密度，开放列表和表格优先。
- 不使用渐变、玻璃拟态、装饰插画或默认 Bento 卡片阵列。
- Lucide outline 图标，18–21px，stroke 约 1.9。
- 中文字体为 `Inter, PingFang SC, Microsoft YaHei, sans-serif`。

## 布局

- 桌面侧栏 205–230px，顶部栏 78px。
- 首页中央内容自适应，右侧栏 290–328px。
- 首屏包含指标条、今日重点、本周进展、今日习惯、风险与最近文档。
- 目标页使用表格和展开详情，不改成卡片墙。
- 800px 以下隐藏固定侧栏，使用底部五项导航。

## 设计 Token

```text
background      #FFFFFF
surface         #FFFFFF
surface-muted   #F7F9FC
nav-selected    #112C54
text-primary    #13213A
text-secondary  #718096
border          #E3E8F0
accent-blue     #2563EB
accent-green    #16A34A
accent-orange   #F97316
accent-violet   #7C3AED
accent-red      #EF4444
radius-control  8px
radius-panel    11px
```

## 允许的首屏文案

- 个人工作台
- 首页、今日、收集箱、愿景、项目、计划、任务、习惯与指标
- 学习、职业、健康、财富、生活
- 文档与资料、目标复盘、搜索、归档、设置
- 搜索愿景、任务、计划、项目和文档
- 快速收集、新建任务
- 晚上好
- 先完成今天最重要的事，再让系统帮你看见长期进展。
- 今日重点、临近截止、进行中目标、待打卡、收集箱
- 本周进展、今日习惯、需要关注、最近文档、AI 助手、今日安排
