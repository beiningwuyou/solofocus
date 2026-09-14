import { Plus, Scale, Sparkles } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { EmptyState, useUiActions } from "../components";
import { useWorkbench } from "../context";
import { asString, linkName, type VaultEntity } from "../../shared/domain";

const STATUS_LABEL: Record<string, string> = { draft: "草稿", active: "启用", retired: "停用" };

export function PrinciplesPage() {
  const { byKind } = useWorkbench();
  const { openCreate, openEntity } = useUiActions();
  const [status, setStatus] = useState(() => byKind("principle").some((item) => item.properties.status === "active") ? "active" : "draft");
  const principles = byKind("principle").sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  const visible = useMemo(() => principles.filter((item) => !status || asString(item.properties.status) === status), [principles, status]);
  const counts = { active: principles.filter((item) => item.properties.status === "active").length, draft: principles.filter((item) => item.properties.status === "draft").length, retired: principles.filter((item) => item.properties.status === "retired").length };

  return <div className="principles-page">
    <div className="principles-head"><div><h1>原则</h1><p>把反复出现的问题变成可解释、可复用的行动规则。</p></div><button className="button primary" onClick={() => openCreate("principle")}><Plus size={17} />新建原则</button></div>
    <div className="principles-toolbar"><div className="database-view-tabs">{[["active", `启用 ${counts.active}`], ["draft", `草稿 ${counts.draft}`], ["retired", `停用 ${counts.retired}`], ["", `全部 ${principles.length}`]].map(([key, label]) => <button key={key} className={status === key ? "active" : ""} onClick={() => setStatus(key)}>{label}</button>)}</div><span><Sparkles size={14} />可在 AI 助手中输入经历并点击“提炼为原则”</span></div>
    {visible.length ? <div className="principles-grid">{visible.map((principle) => <PrincipleCard principle={principle} onOpen={() => openEntity(principle)} key={principle.id} />)}</div> : <EmptyState title={principles.length ? "当前分类没有原则" : "还没有自己的原则"} icon={Scale} description="从一次项目复盘、错误或重要决定开始，写下下一次可以重复使用的行动规则。" action={<button className="button primary" onClick={() => openCreate("principle")}>新建第一条原则</button>} />}
  </div>;
}

function PrincipleCard({ principle, onOpen }: { principle: VaultEntity; onOpen: () => void }) {
  const { byKind } = useWorkbench();
  const state = asString(principle.properties.status) || "draft";
  const statement = asString(principle.properties.statement) || principle.name;
  const trigger = asString(principle.properties.trigger);
  const action = asString(principle.properties.action);
  const areaName = linkName(principle.properties.area);
  // 从领域实体取品牌色，作为书签色带；无领域或取不到时用状态色兜底
  const areaEntity = areaName ? byKind("area").find((entity) => entity.name === areaName) : undefined;
  const accent = asString(areaEntity?.properties.color)
    || (state === "active" ? "#2f6f4f" : state === "retired" ? "#8896a8" : "#c28a3a");
  return <button className="principle-card" style={{ "--principle-accent": accent } as CSSProperties} onClick={onOpen}>
    <span className="principle-ribbon">
      <span className="principle-ribbon-area">{areaName || "未分类"}</span>
      <span className={`principle-ribbon-state is-${state}`}><i />{STATUS_LABEL[state] ?? "草稿"}</span>
    </span>
    <span className="principle-body">
      <span className="principle-mark" aria-hidden="true">“</span>
      <p className="principle-statement">{statement}</p>
      <strong className="principle-name">{principle.name}</strong>
      {(trigger || action) && <span className="principle-details">
        {trigger && <span><b>触发</b>{trigger}</span>}
        {action && <span><b>行动</b>{action}</span>}
      </span>}
    </span>
  </button>;
}
