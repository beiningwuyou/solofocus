import { useMemo, useState } from "react";
import { Check, ClipboardCheck, RotateCcw } from "lucide-react";
import { api } from "../api";
import { useWorkbench } from "../context";
import { asString, type VaultEntity } from "../../shared/domain";

type SopStep = { id: string; label: string; hint: string };
type SopSection = { id: string; title: string; description: string; steps: SopStep[] };

const sections: SopSection[] = [
  { id: "start", title: "每日开始", description: "把今天从混乱带回一个清晰的起点。", steps: [
    { id: "review", label: "查看今日承诺", hint: "扫一眼今日任务和已有安排" },
    { id: "core", label: "选出今天的核心结果", hint: "只选一个：今天完成什么就算有推进" },
    { id: "first-step", label: "写下第一个可执行动作", hint: "把任务改写成现在就能开始的动作" },
    { id: "start-focus", label: "先做 10 分钟", hint: "不要求完成，只要求真正开始" }
  ] },
  { id: "execute", title: "执行中", description: "减少切换，把一次专注变成可见的推进。", steps: [
    { id: "focus-block", label: "完成一个专注块", hint: "25–50 分钟，专注于当前动作" },
    { id: "blocker", label: "遇到阻塞先记录", hint: "写下卡点，不立刻跳去做别的事" },
    { id: "context", label: "结束时留下下一步", hint: "让下次打开项目时可以直接继续" }
  ] },
  { id: "learning", title: "学习输出", description: "学习不以投入时长为终点，而以一个可见输出收尾。", steps: [
    { id: "learning-goal", label: "写下本次学习的小目标", hint: "只选一个：看懂概念、完成练习或解决一个问题" },
    { id: "learning-check", label: "做一次理解检查", hint: "合上资料，用自己的话说清楚刚才学了什么" },
    { id: "learning-output", label: "留下一个可见输出", hint: "一段总结、一个例子、一段代码、一道题或一张图" }
  ] },
  { id: "project", title: "项目推进", description: "每次进入项目，都用同一组问题找回上下文。", steps: [
    { id: "project-goal", label: "确认项目当前目标", hint: "现在要达成的结果是什么" },
    { id: "project-blocker", label: "找出最大的阻塞", hint: "不知道做什么、任务太大，还是它已经不重要" },
    { id: "project-next", label: "确定今天的最小动作", hint: "动作要小到现在就能开始，并留下可见成果" }
  ] },
  { id: "close", title: "每日结束", description: "留下真实反馈，让明天不必从头开始。", steps: [
    { id: "result", label: "记录今天实际完成的结果", hint: "写产出，不写忙碌感" },
    { id: "replan", label: "处理未完成事项", hint: "继续、拆分、改期或取消" },
    { id: "friction", label: "记下今天最大的阻力", hint: "为下一次调整 SOP 提供依据" },
    { id: "tomorrow", label: "预选明天的第一步", hint: "明天打开工作台就能开始" },
    { id: "habit-adjust", label: "判断一次 SOP 是否需要调整", hint: "反复卡住就降低门槛；失去价值就删掉" }
  ] }
];

function readEntries(entity?: VaultEntity): Record<string, boolean> {
  const entries = entity?.properties.sop_entries;
  if (!Array.isArray(entries)) return {};
  return Object.fromEntries(entries.map((entry) => {
    const item = entry as Record<string, unknown>;
    return [String(item.id ?? ""), item.done === true];
  }));
}

export function DailySopPage() {
  const { entities, today, refresh } = useWorkbench();
  const daily = entities.find((entity) => entity.kind === "daily" && (asString(entity.properties.date) || entity.name) === today);
  const [entries, setEntries] = useState(() => readEntries(daily));
  const [busy, setBusy] = useState(false);
  const allSteps = useMemo(() => sections.flatMap((section) => section.steps), []);
  const doneCount = allSteps.filter((step) => entries[step.id]).length;

  async function toggle(id: string) {
    if (busy) return;
    const next = { ...entries, [id]: !entries[id] };
    setEntries(next); setBusy(true);
    try {
      const properties = { date: today, sop_entries: Object.entries(next).filter(([, done]) => done).map(([stepId]) => ({ id: stepId, done: true })) };
      if (daily) await api.update(daily, { properties, actor: "ui" }, { merge: true });
      else await api.create("daily", { name: today, properties: { ...properties, habit_entries: [], metric_entries: [] } });
      await refresh();
    } catch { setEntries(entries); } finally { setBusy(false); }
  }

  function reset() { setEntries({}); }
  return <div className="daily-sop-page">
    <div className="page-header"><div><h1>每日 SOP</h1><p>{today} · 用一套足够小的流程，帮助自己开始、推进和收尾。</p></div><button className="button secondary small" onClick={reset}><RotateCcw size={14} />重新开始</button></div>
    <div className="sop-progress"><div><strong>{doneCount}/{allSteps.length}</strong><span>今日完成步骤</span></div><div className="sop-progress-track"><span data-progress={`${allSteps.length ? (doneCount / allSteps.length) * 100 : 0}%`} /></div><small>{doneCount === allSteps.length ? "今天的闭环已经完成" : "不追求一次做完，先完成下一步"}</small></div>
    <div className="sop-sections">{sections.map((section) => <section className="sop-section" key={section.id}><div className="sop-section-head"><div><h2>{section.title}</h2><p>{section.description}</p></div><span>{section.steps.filter((step) => entries[step.id]).length}/{section.steps.length}</span></div><div className="sop-step-list">{section.steps.map((step) => <button type="button" className={`sop-step${entries[step.id] ? " is-done" : ""}`} key={step.id} onClick={() => void toggle(step.id)} disabled={busy}><span className="sop-check">{entries[step.id] && <Check size={15} />}</span><span><strong>{step.label}</strong><small>{step.hint}</small></span></button>)}</div></section>)}</div>
  </div>;
}
