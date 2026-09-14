import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Repeat2 } from "lucide-react";
import { api } from "../api";
import { useWorkbench } from "../context";
import { habitWeekCount, asString } from "../../shared/domain";
import { useUiActions } from "../components";

function todayIso() { return new Date().toISOString().slice(0, 10); }

export function HabitsPage() {
  const { byKind, entities, today, refresh } = useWorkbench();
  const { notify, openCreate, openEntity } = useUiActions();
  const habits = useMemo(() => byKind("habit").filter((h) => asString(h.properties.status) !== "archived").sort((a, b) => a.name.localeCompare(b.name, "zh-CN")), [byKind]);
  const [busy, setBusy] = useState<string | null>(null);
  const daily = entities.find((e) => e.kind === "daily" && (asString(e.properties.date) || e.name) === today);
  const checked = new Set(Array.isArray(daily?.properties.habit_entries) ? daily.properties.habit_entries.map((entry) => String((entry as Record<string, unknown>).habit ?? "")) : []);
  const toggle = async (id: string) => { setBusy(id); try { await api.checkInHabit(id, today); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "打卡失败", "danger"); } finally { setBusy(null); } };
  return <div className="habits-page">
    <div className="page-header"><div><h1>习惯</h1><p>每天做一点，长期坚持成为什么样的人。</p></div><button className="button primary" onClick={() => openCreate("habit")}><Plus size={17} />新建习惯</button></div>
    <section className="habit-summary"><div><span>今日完成</span><strong>{habits.filter((h) => checked.has(`[[${h.name}]]`)).length}/{habits.length}</strong></div><div><span>坚持中的习惯</span><strong>{habits.length}</strong></div><div><span>记录日期</span><strong>{today}</strong></div></section>
    {habits.length ? <div className="habit-list">{habits.map((habit) => { const done = checked.has(`[[${habit.name}]]`); return <div className={`habit-item${done ? " is-done" : ""}`} key={habit.id}><button className="habit-check" disabled={busy === habit.id} onClick={() => void toggle(habit.id)} aria-label={done ? `取消${habit.name}打卡` : `完成${habit.name}`} >{done && <Check size={17} />}</button><button type="button" className="habit-copy habit-edit-trigger" onClick={() => openEntity(habit)} aria-label={`编辑${habit.name}`}><strong>{habit.name}</strong><small>{asString(habit.properties.description) || asString(habit.properties.summary) || "每日坚持"}</small></button><span className="habit-streak"><Repeat2 size={14} />本周 {habitWeekCount(habit, entities, today)} 天</span><button type="button" className="icon-button habit-edit-button" onClick={() => openEntity(habit)} aria-label={`编辑${habit.name}`} title="编辑习惯"><Pencil size={15} /></button></div>; })}</div> : <div className="empty-state"><Repeat2 size={26} /><h2>还没有每日习惯</h2><p>添加一个你愿意长期坚持的日常动作。</p><button className="button primary" onClick={() => openCreate("habit")}>添加第一个习惯</button></div>}
  </div>;
}
