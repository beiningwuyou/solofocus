# 日常安排与目标打卡

侧栏「日常安排」打开 `/daily-routine`。内置用户确定的工作日作息、周末安排、三项正常及最低目标，以及一周分配。现有「习惯」「每日 SOP」入口和记录保留。

使用方式：早晨填写求职和论文交付、训练或恢复安排；收尾时补实际成果、选择各项目标完成程度、写明天第一步并点击「保存日常记录」。可以切换日期补记；截至所选日期的 14 天表格展示已保存记录，未记录和休息单独标明，不计算连续打卡惩罚。昨日的「明天第一步」自动显示在当天页面。

## 数据契约

不新增 habit 类型或独立数据库。保存复用 `10-Daily/YYYY-MM-DD.md` 中的 `kind: daily` 笔记，新增 `daily_routine` 属性：

```yaml
daily_routine:
  job: ""
  thesis: ""
  health: ""
  tomorrow: ""
  adjustment: ""
  checks:
    job: pending
    thesis: pending
    health: pending
```

`checks` 值：`pending` 未完成、`minimum` 守住最低目标、`done` 完成正常目标、`rest` 休息或顺延。健康的计划恢复可以选择 `done`。日期按本机日历，跨午夜自动切换今日；历史日期保持用户选择。只读打开页面不会创建或改写笔记。

`PUT /api/daily-routine/:date` 接受 `{ record, expectedRevision }`。新建时 revision 为 null，已有笔记必须匹配 revision。服务端验证真实日历日期和字段、串行化日常保存，冲突返回 409。只更新 `daily_routine` 和系统更新时间，保留正文、附件引用、其他属性和现有习惯/SOP 日志。用户填写内容在同一窗口 sessionStorage 中暂存草稿，点击保存后才成为 Vault 正式记录；冲突不覆盖新版本，可以复制草稿再显式重新载入。

作息与目标的权威默认配置为 `src/shared/daily-routine.ts`；页面位于 `src/client/pages/daily-routine/`。当前版本保持两周试行期间模板稳定，临时变更写在「固定事项与当天调整」，不自动迁移未完成任务，不创建提醒或后台 AI 写入。

## 验证

`./scripts/test.sh` 包含日期边界、工作日/周末时间表、重启持久化、取消完成、并发新建、revision 冲突、正文和扩展属性保护。界面另使用隔离 Vault 验证填报、补记、草稿、亮暗主题及窄屏。
