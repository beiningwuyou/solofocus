import { Check, Layers, Plus, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties } from "react";
import { api } from "../api";
import { EmptyState, useUiActions } from "../components";
import { useWorkbench } from "../context";
import { asNumber, asString, linkName, type VaultEntity } from "../../shared/domain";

function AreaCard({ area }: { area: VaultEntity }) {
  const { entities, archivedTasks = [], archivedProjects = [], refresh } = useWorkbench();
  const { notify } = useUiActions();
  const [name, setName] = useState(area.name);
  const [summary, setSummary] = useState(asString(area.properties.summary) || "");
  const all = useMemo(() => [...entities, ...archivedTasks, ...archivedProjects], [archivedProjects, archivedTasks, entities]);
  const areaColor = (asString(area.properties.color) || "#2563eb").toLowerCase();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextName = name.trim();
      if (!nextName) throw new Error("名称不能为空");
      const renamed = nextName !== area.name;
      const result = await api.update(area, {
        name: renamed ? nextName : undefined,
        properties: { summary },
        merge: true
      });
      if (renamed) {
        // 同步关联实体的领域引用，避免改名后内容丢失归属
        const refs = all.filter((entity) => entity.id !== area.id && linkName(entity.properties.area) === area.name);
        for (const entity of refs) {
          await api.update(entity, { properties: { area: `[[${nextName}]]` } }, { merge: true });
        }
      }
      return result;
    },
    onSuccess: async () => { await refresh(); notify("领域已保存"); },
    onError: () => notify("保存失败，文件可能已在其他窗口修改", "danger")
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.trash(area),
    onSuccess: async () => { await refresh(); notify("领域已删除，可从废纸篓恢复"); },
    onError: () => notify("删除失败", "danger")
  });

  function confirmDelete() {
    if (window.confirm(`删除领域「${area.name}」？领域本身会移入废纸篓，关联内容不会被删除。`)) {
      deleteMutation.mutate();
    }
  }

  return <article className="area-card" style={{ "--area-color": areaColor } as CSSProperties}>
    <div className="area-card-name-row">
      <span className="area-card-dot" />
      <input className="area-card-name" type="text" value={name} onChange={(event) => setName(event.target.value)} aria-label={`领域名称 ${area.name}`} placeholder="领域名称" />
    </div>
    <textarea className="area-card-summary" rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="添加一句领域介绍…" aria-label={`${area.name} 一句话介绍`} />
    <div className="area-card-actions">
      <button type="button" className="area-card-action save" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}><Check size={13} />保存</button>
      <button type="button" className="area-card-action danger" disabled={deleteMutation.isPending} onClick={confirmDelete}><Trash2 size={13} />删除</button>
    </div>
  </article>;
}

export function AreasPage() {
  const { byKind, refresh } = useWorkbench();
  const { notify } = useUiActions();
  const areas = useMemo(() => byKind("area").sort((a, b) => asNumber(a.properties.order) - asNumber(b.properties.order)), [byKind]);
  const createMutation = useMutation({
    mutationFn: (name: string) => api.create("area", { name, properties: { visible: true, color: "#2563eb" } }),
    onSuccess: async () => { await refresh(); notify("领域已创建"); },
    onError: () => notify("创建失败", "danger")
  });
  const addArea = () => {
    const name = window.prompt("新领域名称");
    if (name && name.trim()) createMutation.mutate(name.trim());
  };

  return <>
    <div className="goals-page">
      <div className="page-primary">
        <div className="project-toolbar">
          <div className="project-toolbar-title"><Layers size={17} />领域</div>
          <div className="project-toolbar-right">
            <button className="button primary small" onClick={addArea}><Plus size={16} />增加领域</button>
          </div>
        </div>

        {areas.length ? <div className="area-card-grid">{areas.map((area) => <AreaCard key={area.id} area={area} />)}</div>
          : <EmptyState title="还没有领域" description="领域用来组织你的项目、任务与文档。" action={<button className="button primary" onClick={addArea}>增加领域</button>} />}
        <div className="database-count">{areas.length} 个领域</div>
      </div>
    </div>
  </>;
}
