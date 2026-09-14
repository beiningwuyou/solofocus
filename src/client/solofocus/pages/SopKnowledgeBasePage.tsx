import React, { useState, useMemo } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { SopStepItem } from "../../../shared/solofocus-models";

interface SopKnowledgeBasePageProps {
  onNavigateToToday: () => void;
}

export function SopKnowledgeBasePage({ onNavigateToToday }: SopKnowledgeBasePageProps) {
  const { data, refetch, openSopModal, showToast } = useSoloFocus();

  const sops = data?.sops || [];
  const projects = data?.projects || [];

  const [selectedSopId, setSelectedSopId] = useState<string>(sops[0]?.id || "");
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const [isInstantiating, setIsInstantiating] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepPhase, setNewStepPhase] = useState("执行阶段");

  const selectedSop = useMemo(() => {
    return sops.find((s) => s.id === selectedSopId) || sops[0] || null;
  }, [sops, selectedSopId]);

  const steps: SopStepItem[] = useMemo(() => {
    return selectedSop?.steps || [];
  }, [selectedSop]);

  const handleSelectSop = (id: string) => {
    setSelectedSopId(id);
  };

  const handleInstantiateTask = async () => {
    if (!selectedSop) return;
    try {
      setIsInstantiating(true);
      const newTask = await soloApi.createTask({
        title: `执行：${selectedSop.title}`,
        projectId: targetProjectId || undefined,
        scheduledDate: new Date().toISOString().slice(0, 10),
        priority: "HIGH",
        estimatedMinutes: 60
      });
      await soloApi.applySopToTask(newTask.id, selectedSop.id);
      showToast(`已一键实例化任务并排入今日清单`, "task_alt");
      await refetch();
      onNavigateToToday();
    } catch (err: any) {
      showToast(`实例化失败: ${err.message}`, "error");
    } finally {
      setIsInstantiating(false);
    }
  };

  const handleAddStep = async () => {
    if (!selectedSop || !newStepTitle.trim()) return;
    try {
      const newStep: SopStepItem = {
        id: `step-${Date.now()}`,
        sopId: selectedSop.id,
        stepNum: steps.length + 1,
        phaseTitle: newStepPhase,
        instruction: newStepTitle.trim(),
        checklistItems: ["按预定标准规范与检验边界严格执行。"]
      };
      const updatedSteps = [...steps, newStep];
      await soloApi.updateSopSteps(selectedSop.id, updatedSteps);
      showToast("新工序步骤已追加", "playlist_add");
      setNewStepTitle("");
      await refetch();
    } catch (err: any) {
      showToast(`追加失败: ${err.message}`, "error");
    }
  };

  const handleDeleteSop = async (sopId: string, title: string) => {
    if (!window.confirm(`确定删除 SOP「${title}」吗？可在设置回收站中还原。`)) return;
    try {
      await soloApi.deleteSop(sopId);
      showToast("SOP 已移入回收站", "delete");
      setSelectedSopId("");
      await refetch();
    } catch (err: any) {
      showToast(`删除失败: ${err.message}`, "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column (3 cols): SOP Directory */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm border border-outline-variant/20 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
              <span className="font-title-sm text-title-sm font-bold text-on-surface">SOP 模板库</span>
              <span className="font-label-sm text-label-sm text-outline">{sops.length} 项可用</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {sops.map((sop) => {
                const isSelected = selectedSop?.id === sop.id;
                return (
                  <div
                    key={sop.id}
                    className={`p-3 rounded transition-all cursor-pointer flex items-start justify-between ${isSelected
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container-low hover:bg-surface-container text-on-surface"
                      }`}
                    onClick={() => handleSelectSop(sop.id)}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-label-md text-label-md font-semibold truncate">
                        {sop.title}
                      </span>
                      <span
                        className={`font-body-sm text-[11px] mt-0.5 ${isSelected ? "text-on-primary/80" : "text-on-surface-variant"
                          }`}
                      >
                        {sop.steps?.length || 0} 个工序步骤 · {sop.category || "规范"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <span
                        className={`font-label-sm text-xs ${isSelected ? "text-on-primary" : "text-outline"
                          }`}
                      >
                        {sop.steps?.length || 0} 步
                      </span>
                      <button
                        type="button"
                        className={`p-0.5 rounded transition-colors ${
                          isSelected
                            ? "text-on-primary/70 hover:text-on-primary hover:bg-white/20"
                            : "text-outline hover:text-error hover:bg-error-container/30"
                        }`}
                        title="删除 SOP"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSop(sop.id, sop.title);
                        }}
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={openSopModal}
            className="w-full h-9 px-4 bg-primary hover:bg-neutral-800 text-on-primary font-label-md text-[13px] rounded flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>新建 SOP</span>
          </button>
        </div>

        {/* Middle Column (6 cols): Standard Step Sequence */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
          <div className="bg-surface-container-lowest p-6 rounded-lg shadow-sm border border-outline-variant/20 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {selectedSop?.title || "标准执行步骤序列"}
                </span>
                <span className="px-2 py-0.5 bg-surface-container rounded text-on-surface-variant font-label-sm text-label-sm">
                  共 {steps.length} 步骤
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedSop && (
                  <button
                    type="button"
                    className="px-2 py-1 text-xs text-error hover:bg-error-container/30 border border-error/20 rounded flex items-center gap-1 transition-colors cursor-pointer"
                    onClick={() => handleDeleteSop(selectedSop.id, selectedSop.title)}
                    title="删除此 SOP"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>删除 SOP</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {steps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className="p-4 bg-surface-container-low hover:bg-surface-container rounded transition-colors flex items-start gap-4 border border-outline-variant/15"
                >
                  <span className="font-headline-sm text-headline-sm font-bold text-outline shrink-0 w-7 font-mono">
                    0{step.stepNum || idx + 1}
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 bg-surface-container-highest text-primary font-bold rounded-sm font-label-sm text-xs">
                        {step.phaseTitle || "执行阶段"}
                      </span>
                      <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                        {step.instruction}
                      </span>
                    </div>
                    {step.checklistItems && step.checklistItems.length > 0 && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                        {step.checklistItems.join("；")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <select
                className="h-9 px-2 bg-surface-container-low border border-outline-variant/20 rounded font-label-sm text-xs"
                value={newStepPhase}
                onChange={(e) => setNewStepPhase(e.target.value)}
              >
                <option value="准备阶段">准备阶段</option>
                <option value="执行阶段">执行阶段</option>
                <option value="复盘阶段">复盘阶段</option>
                <option value="归档阶段">归档阶段</option>
              </select>
              <input
                className="flex-1 h-9 px-3 bg-surface-container-low border border-outline-variant/20 rounded text-on-surface font-body-sm text-xs outline-none focus:border-primary"
                placeholder="追加工序步骤说明..."
                type="text"
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddStep();
                  }
                }}
              />
              <button
                className="h-9 px-3 bg-surface-container hover:bg-surface-container-high rounded text-on-surface font-label-sm text-xs font-semibold"
                onClick={handleAddStep}
                type="button"
              >
                + 添加步骤
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (3 cols): Instantiation & Meta */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-lg shadow-sm border border-outline-variant/20 flex flex-col gap-4">
            <span className="font-title-sm text-title-sm font-bold text-on-surface">一键使用</span>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              将当前标准工序直接复制为今日清单中的实体任务，各步骤自动转化为核对清单。
            </p>

            <div className="flex flex-col gap-1.5 pt-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">目标项目</label>
              <select
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/20 rounded font-body-sm text-body-sm outline-none cursor-pointer"
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
              >
                <option value="">独立待办任务</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="w-full h-10 px-4 bg-primary hover:bg-neutral-800 text-on-primary font-label-md text-label-md font-semibold rounded flex items-center justify-center gap-2 shadow-sm transition-colors mt-2"
              disabled={isInstantiating}
              onClick={handleInstantiateTask}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">play_circle</span>
              <span>{isInstantiating ? "正在实例化..." : "一键拆解任务流程"}</span>
            </button>

            <div className="pt-3 border-t border-outline-variant/15 flex flex-col gap-2 font-body-sm text-xs text-on-surface-variant">
              <div className="flex items-center justify-between">
                <span>所属分类</span>
                <span className="font-semibold text-on-surface">{selectedSop?.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>已执行次数</span>
                <span className="font-mono text-on-surface">{selectedSop?.executionCount || 0} 次</span>
              </div>
              <div className="flex items-center justify-between">
                <span>存储规范</span>
                <span className="text-secondary font-medium">安全纯本地持久化</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
