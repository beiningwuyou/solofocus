import React, { useState, useMemo } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { DomainItem } from "../../../shared/solofocus-models";

interface DomainsAndGoalsPageProps {
  onNavigateToProjects: () => void;
}

export function DomainsAndGoalsPage({ onNavigateToProjects }: DomainsAndGoalsPageProps) {
  const { data, refetch, openProjectModal, openDomainModal, showToast } = useSoloFocus();

  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

  const [editingDomainName, setEditingDomainName] = useState("");
  const [editingMission, setEditingMission] = useState("");
  const [editingPrinciples, setEditingPrinciples] = useState<string[]>([]);
  const [editingNotes, setEditingNotes] = useState("");

  const domains = data?.domains || [];
  const projects = data?.projects || [];
  const tasks = data?.tasks || [];

  const selectedDomain = useMemo(() => {
    if (!selectedDomainId) return null;
    return domains.find((d) => d.id === selectedDomainId) || null;
  }, [domains, selectedDomainId]);

  const handleSelectDomain = (domain: DomainItem) => {
    setSelectedDomainId(domain.id);
    setEditingDomainName(domain.name);
    setEditingMission(domain.mission || "");
    setEditingPrinciples(domain.principles || []);
    setEditingNotes(domain.notes || "");
  };

  const handleSaveDomainField = async (fields: Partial<DomainItem>) => {
    if (!selectedDomain) return;
    try {
      await soloApi.updateDomain(selectedDomain.id, fields);
      showToast("已保存至本地 SQLite", "save");
      await refetch();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, "error");
    }
  };

  const handleAddRule = () => {
    const next = [...editingPrinciples, "新边界准则：输入不为清单原则"];
    setEditingPrinciples(next);
    handleSaveDomainField({ principles: next });
  };

  const handleUpdateRule = (index: number, val: string) => {
    const next = [...editingPrinciples];
    next[index] = val;
    setEditingPrinciples(next);
  };

  const handleBlurRule = () => {
    handleSaveDomainField({ principles: editingPrinciples });
  };

  if (selectedDomain) {
    const domainProjects = projects.filter((p) => p.domainId === selectedDomain.id);
    const domainTasks = tasks.filter((t) => {
      const proj = projects.find((p) => p.id === t.projectId);
      return proj?.domainId === selectedDomain.id;
    });
    const activeDomainTasks = domainTasks.filter((t) => t.status !== "done");

    return (
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Hub Bar */}
        <section className="w-full bg-surface-container-lowest rounded shadow-sm p-6 flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors font-body-sm text-body-sm"
                onClick={() => setSelectedDomainId(null)}
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>全部领域</span>
              </button>
              <span className="text-on-surface-variant/40 font-body-sm text-body-sm">/</span>
              <div className="flex items-center gap-2">
                <span className="font-title-sm text-title-sm text-on-surface font-bold">
                  {selectedDomain.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-on-primary hover:bg-primary-container transition-colors font-label-lg text-label-lg shadow-sm"
                onClick={openProjectModal}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>新建关联项目</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <div className="group relative flex items-center gap-2">
                <input
                  type="text"
                  value={editingDomainName}
                  onChange={(e) => setEditingDomainName(e.target.value)}
                  onBlur={() => handleSaveDomainField({ name: editingDomainName })}
                  className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight bg-transparent border-b border-dashed border-transparent hover:border-outline-variant/60 focus:border-primary focus:outline-none focus:bg-surface-container-lowest rounded px-1 -ml-1 transition-colors w-auto max-w-xl"
                  title="点击直接修改领域名称，失焦自动保存"
                />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                  <span className="material-symbols-outlined text-[14px]">edit</span>原地修改
                </span>
              </div>

              <div className="group relative flex items-center gap-2">
                <span className="font-body-md text-body-md text-on-surface-variant px-1 -ml-1">
                  创建于 {selectedDomain.createdAt.slice(0, 10)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 px-4 py-2.5 bg-surface-container-low rounded">
              <div className="flex items-baseline gap-2">
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {domainProjects.length}
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">活跃项目</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-outline-variant/60"></span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  {activeDomainTasks.length}
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">推进任务</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-outline-variant/60"></span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-sm text-headline-sm font-bold text-secondary">
                  365
                </span>
                <span className="font-label-md text-label-md text-on-surface-variant">专注天数</span>
              </div>
            </div>
          </div>
        </section>

        {/* 12-col Dual Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-surface-container-lowest rounded shadow-sm p-5 flex flex-col gap-3.5 border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">verified</span>
                  <h2 className="font-title-md text-title-md font-bold text-on-surface">项目简介</h2>
                </div>
              </div>

              <div className="relative w-full">
                <textarea
                  className="w-full p-3 bg-surface-container-low rounded font-body-md text-body-md text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors resize-y leading-relaxed border border-outline-variant/15"
                  rows={4}
                  value={editingMission}
                  onChange={(e) => setEditingMission(e.target.value)}
                  onBlur={() => handleSaveDomainField({ mission: editingMission })}
                  placeholder="输入此领域的核心愿景与长效基准..."
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded shadow-sm p-5 flex flex-col gap-4 border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">gavel</span>
                  <h2 className="font-title-md text-title-md font-bold text-on-surface">准则与边界</h2>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-sm">
                  {editingPrinciples.length} 条准则
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {editingPrinciples.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-surface-container-low rounded flex items-start gap-3 group border border-transparent hover:border-outline-variant/30 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-sm bg-surface-container-high flex items-center justify-center font-label-sm text-label-sm font-bold text-on-surface shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={rule}
                        onChange={(e) => handleUpdateRule(idx, e.target.value)}
                        onBlur={handleBlurRule}
                        className="w-full font-body-sm text-body-sm text-on-surface bg-transparent border-b border-dashed border-transparent hover:border-outline-variant/60 focus:border-primary focus:outline-none focus:bg-surface-container-lowest rounded px-1 -ml-1 transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 text-outline hover:text-error transition-opacity"
                      onClick={() => {
                        const next = editingPrinciples.filter((_, i) => i !== idx);
                        setEditingPrinciples(next);
                        handleSaveDomainField({ principles: next });
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}

                <button
                  className="w-full py-2 px-3 border border-dashed border-outline-variant/60 rounded bg-surface text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors flex items-center justify-center gap-1.5 font-label-md text-label-md"
                  onClick={handleAddRule}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>添加新准则</span>
                </button>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded shadow-sm p-5 flex flex-col gap-3.5 border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">sticky_note_2</span>
                  <h2 className="font-title-md text-title-md font-bold text-on-surface">备忘录</h2>
                </div>
              </div>
              <textarea
                className="w-full p-3 bg-surface-container-low rounded font-body-sm text-body-sm text-on-surface leading-relaxed border border-outline-variant/15 outline-none focus:bg-surface-container-lowest"
                rows={3}
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                onBlur={() => handleSaveDomainField({ notes: editingNotes })}
                placeholder="记录此领域的系统约束与架构准则..."
              />
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-surface-container-lowest rounded shadow-sm p-6 flex flex-col gap-5 border border-outline-variant/20">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[20px]">view_kanban</span>
                  <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    关联项目与任务流
                  </h2>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded">
                  {domainProjects.length} 个项目
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {domainProjects.length === 0 ? (
                  <div className="py-8 text-center text-outline font-body-sm">
                    此领域下暂无关联项目，点击下方添加
                  </div>
                ) : (
                  domainProjects.map((proj, idx) => (
                    <div
                      key={proj.id}
                      className="p-5 bg-surface rounded border border-outline-variant/30 flex flex-col gap-4 hover:bg-surface-container-high/40 transition-colors cursor-pointer"
                      onClick={onNavigateToProjects}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded-sm bg-primary text-on-primary font-label-sm text-label-sm font-semibold shrink-0">
                              项目 0{idx + 1}
                            </span>
                            <h3 className="font-title-md text-title-md font-bold text-on-surface">
                              {proj.name}
                            </h3>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
                              {proj.status === "completed" ? "已完成" : "进行中"}
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {proj.description || "推进核心工程交付与阶段闭环。"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 font-label-md text-label-md text-primary font-bold hover:underline shrink-0 bg-surface-container-lowest px-3 py-1.5 rounded border border-outline-variant/20"
                        >
                          <span>查看详情</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                          <span>执行进度</span>
                          <span className="font-bold text-on-surface">{proj.progress || 0}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-primary rounded-full transition-all duration-300 ${(proj.progress || 0) >= 80
                              ? "w-[80%]"
                              : (proj.progress || 0) >= 60
                                ? "w-[60%]"
                                : (proj.progress || 0) >= 40
                                  ? "w-[40%]"
                                  : (proj.progress || 0) >= 20
                                    ? "w-[20%]"
                                    : "w-[5%]"
                              }`}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-surface-container-low rounded border border-dashed border-outline-variant/60 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
                  <span className="material-symbols-outlined text-[18px]">add_task</span>
                  <span>关联新项目</span>
                </div>
                <button
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-on-primary hover:bg-neutral-800 transition-colors font-label-md text-label-md shadow-sm"
                  onClick={openProjectModal}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">folder</span>
                  <span>新建项目</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {domains.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 border border-outline-variant/20 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-surface-container-high text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">explore</span>
          </div>
          <h3 className="font-title-md text-title-md font-bold text-on-surface">暂无领域卡片</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-sm">
            点击右下角加号按钮创建第一个长期领域。
          </p>
          <button
            type="button"
            onClick={openDomainModal}
            className="mt-2 h-9 px-4 rounded bg-primary text-on-primary font-label-md text-label-md hover:bg-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>新建领域卡片</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {domains.map((d) => {
            const domainProjects = projects.filter((p) => p.domainId === d.id);
            const domainTasks = tasks.filter((t) => {
              const p = projects.find((proj) => proj.id === t.projectId);
              return p?.domainId === d.id && t.status !== "archived";
            });

            return (
              <div
                key={d.id}
                className="bg-surface-container-lowest rounded shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group overflow-hidden border border-outline-variant/10 cursor-pointer"
                onClick={() => handleSelectDomain(d)}
              >
                <div className="p-space-lg">
                  <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-outline-variant/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-surface-container-high text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px]">
                          {d.icon || "explore"}
                        </span>
                      </div>
                      <div>
                        <h2 className="font-title-md text-title-md text-on-surface font-bold group-hover:text-primary transition-colors">
                          {d.name}
                        </h2>
                        <span className="font-label-sm text-label-sm text-outline">
                          {d.code}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                      {domainProjects.length} 项目 · {domainTasks.length} 待办
                    </span>
                  </div>

                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mb-space-md line-clamp-2 min-h-[36px]">
                    {d.mission || "聚焦长效价值输出与系统规范维护。"}
                  </p>

                  <div>
                    <span className="font-label-sm text-label-sm text-outline block mb-2">相关项目</span>
                    <div className="flex flex-col gap-2">
                      {domainProjects.slice(0, 2).map((p) => (
                        <div
                          key={p.id}
                          className="p-2 rounded bg-surface-container-low/60 border border-outline-variant/10 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0"></span>
                            <span className="font-body-sm text-body-sm font-medium text-on-surface truncate">
                              {p.name}
                            </span>
                          </div>
                          <span className="font-label-sm text-label-sm text-secondary bg-secondary-container/40 px-1.5 py-0.5 rounded shrink-0">
                            {p.status === "completed" ? "已完成" : "进行中"}
                          </span>
                        </div>
                      ))}
                      {domainProjects.length === 0 && (
                        <span className="text-outline text-xs italic">暂无关联项目</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-low px-space-lg py-2.5 flex items-center justify-between mt-auto border-t border-outline-variant/10">
                  <div className="flex items-center gap-1.5 text-on-surface-variant font-label-md text-label-md">
                    <span className="material-symbols-outlined text-[16px] text-outline">checklist</span>
                    <span>{domainTasks.length} 项活跃待办</span>
                  </div>
                  <div className="h-7 px-3 bg-primary group-hover:bg-neutral-800 text-on-primary rounded font-label-sm text-label-sm flex items-center gap-1 transition-all">
                    <span>进入领域详情</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 右下角悬浮加号按钮 - 用于新建领域卡片 */}
      <button
        type="button"
        onClick={openDomainModal}
        className="fixed bottom-8 right-8 z-30 w-14 h-14 rounded-full bg-primary text-on-primary shadow-lg hover:bg-neutral-800 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
        title="新建领域卡片"
        aria-label="新建领域卡片"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
