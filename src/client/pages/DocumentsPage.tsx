import { BookOpen, ExternalLink, File, FileText, Folder, Heart, Link2, Plus, Search, Star } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState, RowMenu, StatusDot, useUiActions } from "../components";
import { useWorkbench } from "../context";
import { asString, linkName, type VaultEntity } from "../../shared/domain";

export function DocumentsPage() {
  const { entities, refresh } = useWorkbench();
  const { openCreate, openDocument, notify } = useUiActions();
  const [mode, setMode] = useState("all");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const documents = useMemo(() => entities.filter((entity) => entity.kind === "document" || entity.kind === "resource").filter((entity) => {
    if (mode === "favorite" && entity.properties.favorite !== true) return false;
    if (mode === "pinned" && entity.properties.pinned !== true) return false;
    if (kind && entity.kind !== kind) return false;
    const haystack = `${entity.name} ${asString(entity.properties.summary)} ${entity.body}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)), [entities, mode, kind, query]);
  const favoriteMutation = useMutation({
    mutationFn: (entity: VaultEntity) => api.update(entity, { properties: { favorite: entity.properties.favorite !== true } }),
    onSuccess: async () => { await refresh(); notify("收藏状态已更新"); }
  });

  return <>
    <div className="library-layout">
      <aside className="library-sidebar">
        {[['all', '全部内容', Folder], ['favorite', '收藏', Heart], ['pinned', '置顶', Star]].map(([value, label, Icon]) => {
          const Glyph = Icon as typeof Folder;
          return <button className={mode === value ? "active" : ""} key={value as string} onClick={() => setMode(value as string)}><Glyph size={18} />{label as string}</button>;
        })}
        <div className="library-separator" />
        <button className={kind === "document" ? "active" : ""} onClick={() => setKind(kind === "document" ? "" : "document")}><FileText size={18} />Markdown 文档</button>
        <button className={kind === "resource" ? "active" : ""} onClick={() => setKind(kind === "resource" ? "" : "resource")}><Link2 size={18} />外部资料</button>
      </aside>
      <div className="library-main">
        <div className="library-toolbar"><div className="inline-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在文档与资料中搜索" /></div><div className="library-toolbar-actions"><span>{documents.length} 项</span><button className="button secondary small" onClick={() => openCreate("resource")}><Plus size={15} />添加资料</button><button className="button secondary small" onClick={() => openCreate("document")}><Plus size={15} />新建文档</button></div></div>
        {documents.length ? <div className="document-table">
          <div className="document-head"><span>名称</span><span>类型</span><span>领域 / 项目</span><span>最近修改</span><span /></div>
          {documents.map((document) => <div className="document-table-row" key={document.id}>
            <button className="document-title" onClick={() => document.kind === "document" ? openDocument(document) : void api.openInObsidian(document.path)}>{document.kind === "resource" ? <File className="green" size={20} /> : <FileText className="blue" size={20} />}<div><strong>{document.name}</strong><small>{asString(document.properties.summary)}</small></div></button>
            <span>{document.kind === "resource" ? resourceType(document) : "Markdown"}</span>
            <span><StatusDot tone="blue" />{linkName(document.properties.area) || linkName(document.properties.project) || "未分类"}</span>
            <time>{new Date(document.modifiedAt).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
            <div className="row-actions"><button className={`icon-button ${document.properties.favorite === true ? "favorite" : ""}`} onClick={() => favoriteMutation.mutate(document)} aria-label="收藏"><Heart size={17} fill={document.properties.favorite === true ? "currentColor" : "none"} /></button><button className="icon-button" onClick={() => void api.openInObsidian(document.path)} aria-label="在 Obsidian 打开"><ExternalLink size={17} /></button><RowMenu /></div>
          </div>)}
        </div> : <EmptyState title="没有匹配的文档" description="调整筛选条件，或者创建一份新的 Markdown 文档。" />}
      </div>
    </div>
  </>;
}

function resourceType(entity: VaultEntity): string {
  const type = asString(entity.properties.resource_type);
  return { pdf: "PDF", url: "网页", book: "书籍", image: "图片" }[type] ?? "资料";
}
