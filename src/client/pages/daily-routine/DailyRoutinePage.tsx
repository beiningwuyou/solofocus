import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { api, ApiError } from "../../api";
import { useWorkbench } from "../../context";
import { useUiActions } from "../../components";
import { todayIso, type VaultEntity } from "../../../shared/domain";
import { dailyFor, readRoutine, routineDateSchema, routineGoals, routineSchema, routineSlots, routineStatusLabels, shiftRoutineDate, weeklyRoutine, type RoutineRecord } from "../../../shared/daily-routine";
import "./daily-routine.css";

type Draft = { record: RoutineRecord; revision: string | null };

function restoreDraft(key: string): Draft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value && (typeof value.revision === "string" || value.revision === null) && routineSchema.safeParse(value.record).success) return value;
  } catch { /* 缓存不可用时仍可编辑和保存至 Vault。 */ }
  return null;
}

export function DailyRoutinePage() {
  const { entities } = useWorkbench();
  const [now, setNow] = useState(() => new Date());
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    const update = () => setNow(new Date());
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);
  const today = todayIso(now);
  const date = picked ?? today;
  const day = new Date(`${date}T12:00:00`).getDay();
  const daily = dailyFor(entities, date);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const history = Array.from({ length: 14 }, (_, index) => {
    const entryDate = shiftRoutineDate(date, index - 13);
    const entity = dailyFor(entities, entryDate);
    return { date: entryDate, saved: routineSchema.safeParse(entity?.properties.daily_routine).success, record: readRoutine(entity) };
  });

  return <div className="routine-page">
    <div className="page-header"><div><h1>日常安排</h1><p>上午求职与论文，下午灵活推进，晚上收尾与恢复。</p></div></div>
    <div className="routine-date-bar">
      <button type="button" className="icon-button" aria-label="前一天" onClick={() => setPicked(shiftRoutineDate(date, -1))}><ChevronLeft size={18} /></button>
      <label className="routine-date-label">记录日期<input aria-label="记录日期" type="date" value={date} max={today} onChange={(event) => { if (routineDateSchema.safeParse(event.target.value).success && event.target.value <= today) setPicked(event.target.value); }} /></label>
      <span>星期{"日一二三四五六"[day]}</span>
      <button type="button" className="icon-button" aria-label="后一天" disabled={date >= today} onClick={() => setPicked(shiftRoutineDate(date, 1))}><ChevronRight size={18} /></button>
      <button type="button" className="button secondary small" onClick={() => setPicked(null)}>今天</button>
    </div>
    <p className="routine-rule">8:00 直接开始昨晚写好的第一项任务；上午两个核心时段结束前，不研究新工具、不优化工作台。</p>
    <div className="routine-main">
    <RoutineEditor key={date} date={date} daily={daily} yesterday={dailyFor(entities, shiftRoutineDate(date, -1))} />

    <section className="routine-section" aria-labelledby="routine-schedule-title">
      <div className="routine-section-head"><h2 id="routine-schedule-title">{day === 0 || day === 6 ? "周末安排" : "当天时间表"}</h2><span>11:30 午饭 · 13:00–15:00 健身 · 21:30 准备睡觉</span></div>
      <p>{weeklyRoutine[day]}</p>
      <p className="routine-muted">面试、笔试或导师硬截止优先调整工作块；任务顺延，不挤占睡眠，也不要求第二天双倍补偿。健身后恢复较慢时，先处理沟通。</p>
      <ol className="routine-timeline">{routineSlots(date).map((slot) => {
        const current = date === today && time >= slot.start && (!slot.end || time < slot.end);
        return <li key={slot.start} className={`${current ? "is-current" : ""} ${slot.core ? "is-core" : ""}`} aria-current={current ? "step" : undefined}>
          <time>{slot.start}{slot.end ? `–${slot.end}` : " 起"}</time>
          <details open={current}><summary><strong>{slot.title}</strong>{current && <span className="routine-now">当前时段</span>}</summary><p>{slot.detail}</p></details>
        </li>;
      })}</ol>
    </section>
    </div>

    <section className="routine-section" aria-labelledby="routine-history-title">
      <div className="routine-section-head"><h2 id="routine-history-title">两周回顾</h2><span>{history[0].date} 至 {date} · 已记录 {history.filter((entry) => entry.saved).length} 天</span></div>
      <p className="routine-muted">先执行两周，再根据实际成果调整。最低目标是底线，不是上限；休息与未记录分别展示。</p>
      <div className="routine-table-wrap"><table className="routine-history"><thead><tr><th>日期</th>{routineGoals.map((goal) => <th key={goal.key}>{goal.title}</th>)}<th>实际成果 / 调整</th></tr></thead><tbody>
        {[...history].reverse().map((entry) => <tr key={entry.date}><th><button className="routine-date-link" type="button" onClick={() => setPicked(entry.date)}>{entry.date.slice(5)} 周{"日一二三四五六"[new Date(`${entry.date}T12:00:00`).getDay()]}</button></th>{routineGoals.map((goal) => <td key={goal.key} data-status={entry.saved ? entry.record.checks[goal.key] : "unrecorded"}>{entry.saved ? routineStatusLabels[entry.record.checks[goal.key]] : "未记录"}</td>)}<td className="routine-history-copy">{entry.saved ? [entry.record.job, entry.record.thesis, entry.record.health, entry.record.adjustment].filter(Boolean).join("；") || "尚未填写成果" : "—"}</td></tr>)}
      </tbody></table></div>
      <details className="routine-week"><summary>查看一周分配与执行规则</summary><ul>{[1, 2, 3, 4, 5, 6, 0].map((index) => <li key={index}>{weeklyRoutine[index]}</li>)}</ul><p>收藏岗位、下载论文、浏览 AI 新闻不能单独算作核心目标完成。额外学习围绕当天的问题展开，19:30 后不要求再产出。</p></details>
    </section>
  </div>;
}

function RoutineEditor({ date, daily, yesterday }: { date: string; daily?: VaultEntity; yesterday?: VaultEntity }) {
  const { refresh, vaultName } = useWorkbench();
  const { notify } = useUiActions();
  const draftKey = `workbench-routine-draft:${vaultName}:${date}`;
  const [draft, setDraft] = useState<Draft | null>(() => restoreDraft(draftKey));
  const [saved, setSaved] = useState<VaultEntity | undefined>();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const source = saved && (!daily || saved.modifiedAt > daily.modifiedAt) ? saved : daily;
  const record = draft?.record ?? readRoutine(source);
  const count = Object.values(record.checks).filter((value) => value === "minimum" || value === "done").length;

  useEffect(() => {
    if (!draft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);

  function edit(next: RoutineRecord) {
    const nextDraft = { record: next, revision: draft ? draft.revision : source?.revision ?? null };
    setDraft(nextDraft);
    try { sessionStorage.setItem(draftKey, JSON.stringify(nextDraft)); } catch { /* 保存按钮仍可用。 */ }
    setError("");
  }

  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const result = await api.saveDailyRoutine(date, record, draft ? draft.revision : source?.revision ?? null);
      setSaved(result); setDraft(null); setConflict(false);
      try { sessionStorage.removeItem(draftKey); } catch { /* 不影响已成功落盘的记录。 */ }
      notify("日常记录已保存");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试");
      setConflict(cause instanceof ApiError && cause.status === 409);
    } finally { saving.current = false; setBusy(false); }
  }

  async function reload() {
    if (!window.confirm("重新载入会放弃当前草稿。请先复制需要保留的内容。")) return;
    setBusy(true);
    try {
      await refresh(); setSaved(undefined); setDraft(null); setError(""); setConflict(false);
      try { sessionStorage.removeItem(draftKey); } catch { /* 可继续从 Vault 读取。 */ }
    } finally { setBusy(false); }
  }

  return <section className="routine-section" aria-labelledby="routine-goals-title">
    <div className="routine-section-head"><h2 id="routine-goals-title">每日目标与打卡</h2><span>{count}/3 项达到最低目标或正常目标</span></div>
    {readRoutine(yesterday).tomorrow && <p className="routine-first-action"><strong>昨晚留给今天的第一步：</strong>{readRoutine(yesterday).tomorrow}</p>}
    <p className="routine-muted">按实际成果选择完成程度；计划训练或恢复都可以完成健康目标。填写后点击保存。</p>
    <fieldset className="routine-fields" disabled={busy}>
      {routineGoals.map((goal) => <div className="routine-goal" key={goal.key}>
        <div className="routine-goal-heading"><h3>{goal.title}</h3><select aria-label={`${goal.title}完成情况`} value={record.checks[goal.key]} onChange={(event) => edit({ ...record, checks: { ...record.checks, [goal.key]: event.target.value as RoutineRecord["checks"]["job"] } })}>{Object.entries(routineStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <p><strong>正常目标：</strong>{goal.normal}</p><p className="routine-muted"><strong>最低目标：</strong>{goal.minimum}</p>
        <label>{goal.key === "health" ? "今天训练或恢复安排" : `今天${goal.title}交付`}<textarea aria-label={goal.key === "health" ? "今天训练或恢复安排" : `今天${goal.title}交付`} rows={2} maxLength={4000} value={record[goal.key]} placeholder={goal.key === "health" ? "训练或恢复计划，以及实际完成情况" : "开始前写具体目标，收尾时补充实际成果"} onChange={(event) => edit({ ...record, [goal.key]: event.target.value })} /></label>
      </div>)}
      <label>明天打开电脑后的第一个动作<textarea aria-label="明天打开电脑后的第一个动作" rows={2} maxLength={4000} value={record.tomorrow} placeholder="写一个打开电脑就能直接开始的动作" onChange={(event) => edit({ ...record, tomorrow: event.target.value })} /></label>
      <label>固定事项与当天调整（可选）<textarea aria-label="固定事项与当天调整（可选）" rows={2} maxLength={4000} value={record.adjustment} placeholder="例如：16:00 面试，项目顺延；今天恢复较慢，先处理沟通" onChange={(event) => edit({ ...record, adjustment: event.target.value })} /></label>
    </fieldset>
    <div className="routine-save-bar"><button className="button primary" type="button" disabled={busy} onClick={() => void save()}><Save size={16} />{busy ? "正在保存…" : "保存日常记录"}</button><span role="status">{draft ? "有未保存修改 · 本窗口暂存草稿" : source?.properties.daily_routine ? "已保存到每日笔记" : "尚未记录"}</span></div>
    {error && <p className="routine-error" role="alert">{error}</p>}
    {conflict && <button type="button" className="button secondary small" disabled={busy} onClick={() => void reload()}>重新载入记录</button>}
  </section>;
}
