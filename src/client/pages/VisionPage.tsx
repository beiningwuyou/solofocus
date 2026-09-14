import { Plus, Telescope, FileText, Calendar, NotebookText, Save } from "lucide-react";
import { EmptyState, StatusDot, renderMarkdown, useUiActions } from "../components";
import { useWorkbench } from "../context";
import { asString, linkName, type EntityProperties, type VaultEntity } from "../../shared/domain";
import { api } from "../api";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

const VISION_STATUS: [string, string, "blue" | "green" | "orange" | "gray"][] = [
  ["planned", "构思中", "orange"],
  ["active", "践行中", "blue"],
  ["paused", "暂缓", "gray"],
  ["fulfilled", "已实现", "green"],
  ["archived", "已归档", "gray"]
];

const HORIZON_LABEL: Record<string, string> = {
  three_year: "三年愿景",
  five_year: "五年愿景",
  lifetime: "人生方向",
  custom: "自定义"
};

export function VisionPage() {
  const { byKind, entities } = useWorkbench();
  const { openCreate, openEntity } = useUiActions();
  const visions = byKind("vision");
  const [selectedId, setSelectedId] = useState<string | null>(visions[0]?.id ?? null);
  const selected = visions.find((v) => v.id === selectedId) ?? visions[0];

  return <div className="vision-page goals-page">
    <div className="page-primary">
      <div className="vision-page-head">
        <div>
          <h1>愿景</h1>
          <p>长期方向与人生图景，每个愿景对应 Obsidian 中的一张卡片与相关笔记。</p>
        </div>
        <button className="button primary" onClick={() => openCreate("vision")}><Plus size={17} />新建愿景</button>
      </div>

      {visions.length === 0
        ? <EmptyState title="还没有愿景" icon={Telescope} description="愿景是 3-5 年的大方向，不必追求完成，只为项目和任务锚定意义。" action={<button className="button primary" onClick={() => openCreate("vision")}>新建愿景</button>} />
        : <div className="vision-grid">
            {visions.map((vision) => {
              const active = selected?.id === vision.id;
              const status = visionStatus(vision);
              const horizon = horizonLabel(vision);
              const subtitle = visionSubtitle(vision);
              const isPlaceholder = !asString(vision.properties.summary || vision.properties.subtitle) && !(vision.body || "").trim();
              return <button
                key={vision.id}
                className={`vision-card${active ? " active" : ""}`}
                onClick={() => { setSelectedId(vision.id); }}
              >
                <header className="vision-card-head">
                  <div className="vision-card-icon-box"><Telescope size={18} /></div>
                  <strong>{vision.name}</strong>
                </header>
                <div className="vision-card-meta">
                  <span className="vision-horizon"><Calendar size={12} />{horizon}</span>
                  <span className={`vision-status is-${status.key}`}>{status.label}</span>
                </div>
                <p className={`vision-card-summary${isPlaceholder ? " is-placeholder" : ""}`} title={subtitle}>{subtitle}</p>
              </button>;
            })}
          </div>}
    </div>

    {selected && <VisionDetailPanel vision={selected} entities={entities} onOpen={() => openEntity(selected)} />}
  </div>;
}

function VisionDetailPanel({ vision, entities, onOpen }: { vision: VaultEntity; entities: VaultEntity[]; onOpen: () => void }) {
  const { refresh } = useWorkbench();
  const html = useMemo(() => renderMarkdown(vision.body || ""), [vision.body]);
  const status = visionStatus(vision);
  const horizon = horizonLabel(vision);
  const areas = entities.filter((e) => e.kind === "area");

  const [properties, setProperties] = useState(vision.properties);
  useEffect(() => { setProperties(vision.properties); }, [vision.id, vision.properties]);
  const area = linkName(properties.area);

  const changes = useMemo(() => {
    const out: EntityProperties = {};
    for (const k of new Set([...Object.keys(vision.properties), ...Object.keys(properties)])) {
      if (JSON.stringify(vision.properties[k]) !== JSON.stringify(properties[k])) out[k] = properties[k];
    }
    return out;
  }, [vision.properties, properties]);
  const dirty = Object.keys(changes).length > 0;

  const mutation = useMutation({
    mutationFn: async () => api.update(vision, { properties: changes }),
    onSuccess: async () => { await refresh(); },
    onError: (error) => { console.error("愿景保存失败", error); }
  });

  function updateProperty(key: string, raw: string) {
    setProperties((current) => ({ ...current, [key]: raw ? (key === "area" ? `[[${raw}]]` : raw) : undefined }));
  }


  return <aside className="page-rail vision-detail-panel">
    <div className="vision-detail-head">
      <h2>{vision.name}</h2>
      <div className="vision-detail-meta-row">
        <label className="vision-detail-field">
          <span><StatusDot tone={status.tone} />状态</span>
          <select value={asString(properties.status)} onChange={(event) => updateProperty("status", event.target.value)}>
            {VISION_STATUS.map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select>
        </label>
        <label className="vision-detail-field">
          <span><Calendar size={12} />时间尺度</span>
          <select value={asString(properties.horizon)} onChange={(event) => updateProperty("horizon", event.target.value)}>
            <option value="">未设置</option>
            {Object.entries(HORIZON_LABEL).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select>
        </label>
        <label className="vision-detail-field">
          <span>所属领域</span>
          <select value={area} onChange={(event) => updateProperty("area", event.target.value)}>
            <option value="">未关联</option>
            {areas.map((a) => <option value={a.name} key={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>
      {mutation.isPending && <small className="vision-saving">保存中…</small>}
    </div>

    <section className="vision-calibration">
      <div className="vision-calibration-head"><div><strong>愿景校准</strong><small>先明确想要什么，再面对事实与取舍。</small></div></div>
      {[["outcome", "理想状态", "希望长期成为、拥有或实现什么"], ["reality", "现实基线", "当前事实是什么，与理想状态差多少"], ["tradeoffs", "选择与代价", "为了这个方向愿意放弃什么"], ["nature_fit", "天性匹配", "它如何匹配你的动力、优势与限制"], ["evidence", "进展证据", "观察到什么事实说明正在接近愿景"], ["contribution", "意义与贡献", "它将为重要的人、社区或更大整体带来什么"]].map(([key, label, placeholder]) => <label key={key}><span>{label}</span><textarea rows={2} value={asString(properties[key])} placeholder={placeholder} onChange={(event) => updateProperty(key, event.target.value)} /></label>)}
      <details className="vision-future-reflection">
        <summary>从未来回看（可选）</summary>
        <p>让未来变得具体，再从终点回看关键转折；它不是新的计划层。</p>
        <label><span>未来的我写给现在的信</span><textarea rows={3} value={asString(properties.future_letter)} placeholder="站在目标日期，告诉现在的我：什么真正重要？" onChange={(event) => updateProperty("future_letter", event.target.value)} /></label>
        <label><span>三个关键转折</span><textarea rows={3} value={asString(properties.turning_points)} placeholder="从未来回看，哪些选择、实验或反馈改变了方向？" onChange={(event) => updateProperty("turning_points", event.target.value)} /></label>
      </details>
    </section>

    <div className="vision-detail-body markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />

    <div className="vision-detail-actions">
      <button className="button primary small" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}><Save size={14} />{mutation.isPending ? "保存中…" : "保存"}</button>
      <button className="button secondary small" onClick={onOpen}><FileText size={14} />编辑详情</button>
      <button className="button secondary small" onClick={() => void api.openInObsidian(vision.path)}><NotebookText size={14} />在 Obsidian 打开此笔记</button>
    </div>
  </aside>;
}

function visionStatus(vision: VaultEntity): { key: string; label: string; tone: "blue" | "green" | "orange" | "gray" } {
  const raw = asString(vision.properties.status);
  const found = VISION_STATUS.find(([key]) => key === raw);
  return found ? { key: found[0], label: found[1], tone: found[2] } : { key: "planned", label: "构思中", tone: "orange" };
}

function horizonLabel(vision: VaultEntity): string {
  return HORIZON_LABEL[asString(vision.properties.horizon)] ?? "未设置";
}

function visionSubtitle(vision: VaultEntity): string {
  const explicit = asString(vision.properties.summary || vision.properties.subtitle);
  if (explicit) return explicit;
  const body = (vision.body || "").trim();
  if (!body) return "在 Obsidian 里写下这个愿景的一句概括，会出现在这里。";
  const stripped = body
    .replace(/^#{1,6}\s+.*$/gm, "")        // 去掉标题行
    .replace(/^\s*[-*+>]\s+/gm, "")       // 去掉列表/引用前缀
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1") // 还原 wikilink
    .replace(/`([^`]+)`/g, "$1")          // 去掉行内 code 标记
    .replace(/\*\*([^*]+)\*\*/g, "$1")    // 去掉加粗
    .replace(/\*([^*]+)\*/g, "$1")        // 去掉斜体
    .split(/\n\s*\n/)[0] || ""            // 取首段
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return "在 Obsidian 里写下这个愿景的一句概括，会出现在这里。";
  return stripped.length > 60 ? `${stripped.slice(0, 60)}…` : stripped;
}
