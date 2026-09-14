import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import { parseQuickTaskInput } from "../utils/quickCaptureParser";
import type { TaskItem, ProjectItem, TaskChecklistItem } from "../../../shared/solofocus-models";

type SelectionItem =
  | { type: "new_task"; id: "new_task"; title: string }
  | { type: "task"; id: string; task: TaskItem }
  | { type: "project"; id: string; project: ProjectItem };

export function QuickCaptureModal() {
  const { isQuickCaptureOpen, closeQuickCapture, data, refetch, showToast, openDrawer } = useSoloFocus();
  const [inputText, setInputText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const projects = useMemo(() => data?.projects || [], [data?.projects]);
  const tasks = useMemo(() => data?.tasks || [], [data?.tasks]);

  const parsed = useMemo(() => {
    return parseQuickTaskInput(inputText, projects);
  }, [inputText, projects]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // Compute filtered flat list and categorized sections
  const { sections, flatItems } = useMemo(() => {
    const trimmed = inputText.trim().toLowerCase();
    const resultSections: { title: string; items: SelectionItem[] }[] = [];
    const flat: SelectionItem[] = [];

    // Always provide "Create New Task" at top
    const newTaskItem: SelectionItem = {
      type: "new_task",
      id: "new_task",
      title: parsed.title || inputText || "记录新待办..."
    };
    resultSections.push({
      title: "闪念录入",
      items: [newTaskItem]
    });
    flat.push(newTaskItem);

    if (trimmed) {
      // Filter matching tasks
      const matchingTasks = tasks
        .filter((t) => {
          if (t.status === "archived") return false;
          return (
            t.title.toLowerCase().includes(trimmed) ||
            (t.projectName && t.projectName.toLowerCase().includes(trimmed)) ||
            (t.id && t.id.toLowerCase().includes(trimmed))
          );
        })
        .slice(0, 8);

      if (matchingTasks.length > 0) {
        const taskItems: SelectionItem[] = matchingTasks.map((t) => ({
          type: "task",
          id: t.id,
          task: t
        }));
        resultSections.push({
          title: "匹配的任务",
          items: taskItems
        });
        flat.push(...taskItems);
      }

      // Filter matching projects
      const matchingProjects = projects
        .filter((p) => p.name.toLowerCase().includes(trimmed) || p.description?.toLowerCase().includes(trimmed))
        .slice(0, 4);

      if (matchingProjects.length > 0) {
        const projItems: SelectionItem[] = matchingProjects.map((p) => ({
          type: "project",
          id: p.id,
          project: p
        }));
        resultSections.push({
          title: "匹配的项目",
          items: projItems
        });
        flat.push(...projItems);
      }
    } else {
      // Empty input: Show Today's Tasks, In-progress Tasks, Active Projects
      const todayTasks = tasks
        .filter((t) => t.scheduledDate === todayStr && t.status !== "archived")
        .slice(0, 6);

      if (todayTasks.length > 0) {
        const todayItems: SelectionItem[] = todayTasks.map((t) => ({
          type: "task",
          id: t.id,
          task: t
        }));
        resultSections.push({
          title: "今日待办",
          items: todayItems
        });
        flat.push(...todayItems);
      }

      const pendingTasks = tasks
        .filter((t) => t.scheduledDate !== todayStr && t.status !== "done" && t.status !== "archived")
        .slice(0, 6);

      if (pendingTasks.length > 0) {
        const pendingItems: SelectionItem[] = pendingTasks.map((t) => ({
          type: "task",
          id: t.id,
          task: t
        }));
        resultSections.push({
          title: "待推进任务",
          items: pendingItems
        });
        flat.push(...pendingItems);
      }

      const activeProjects = projects.filter((p) => p.status === "active").slice(0, 4);
      if (activeProjects.length > 0) {
        const projItems: SelectionItem[] = activeProjects.map((p) => ({
          type: "project",
          id: p.id,
          project: p
        }));
        resultSections.push({
          title: "活跃项目",
          items: projItems
        });
        flat.push(...projItems);
      }
    }

    return { sections: resultSections, flatItems: flat };
  }, [inputText, parsed.title, tasks, projects, todayStr]);

  // Keep selected index valid
  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  // Auto-scroll active item into view
  useEffect(() => {
    if (listContainerRef.current) {
      const activeEl = listContainerRef.current.querySelector<HTMLElement>("[data-selected='true']");
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Reset when modal opens
  useEffect(() => {
    if (isQuickCaptureOpen) {
      setInputText("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isQuickCaptureOpen]);

  if (!isQuickCaptureOpen) return null;

  const currentSelection: SelectionItem | undefined = flatItems[selectedIndex] || flatItems[0];

  const handleCreateTask = async () => {
    if (!parsed.title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await soloApi.createTask({
        title: parsed.title,
        priority: parsed.priority,
        scheduledDate: parsed.scheduledDate,
        estimatedMinutes: parsed.estimatedMinutes,
        projectId: parsed.projectId
      });
      showToast(`已闪念捕获: ${parsed.title}`, "bolt");
      closeQuickCapture();
      await refetch();
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectCurrent = () => {
    if (!currentSelection) return;

    if (currentSelection.type === "new_task") {
      handleCreateTask();
    } else if (currentSelection.type === "task") {
      openDrawer(currentSelection.task);
      closeQuickCapture();
    } else if (currentSelection.type === "project") {
      // If project selected, prefill query with project name to filter its tasks
      setInputText(`#${currentSelection.project.name} `);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeQuickCapture();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < flatItems.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelectCurrent();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 flex items-start justify-center pt-16 px-4 select-none"
      onClick={closeQuickCapture}
    >
      <div
        className="w-full max-w-4xl bg-surface-container-lowest border border-outline-variant/30 rounded-DEFAULT shadow-xl overflow-hidden flex flex-col h-[560px] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Input Bar */}
        <div className="flex items-center gap-space-sm px-space-md py-space-sm border-b border-outline-variant/20 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-outline text-[20px] shrink-0">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-on-surface font-title-md text-title-md placeholder:text-outline focus:outline-none"
            placeholder="搜索任务、项目，或直接输入闪念待办..."
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setSelectedIndex(0);
            }}
            disabled={isSubmitting}
          />

          {inputText && (
            <button
              type="button"
              onClick={() => {
                setInputText("");
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="清空输入"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCreateTask}
            disabled={!parsed.title.trim() || isSubmitting}
            className={`px-3 py-1 rounded-DEFAULT font-label-md text-label-md flex items-center gap-1 transition-colors ${parsed.title.trim() && !isSubmitting
              ? "bg-primary text-on-primary hover:bg-primary-container cursor-pointer"
              : "bg-surface-container text-outline cursor-not-allowed"
              }`}
          >
            <span>记录</span>
            <span className="material-symbols-outlined text-[14px]">keyboard_return</span>
          </button>
        </div>

        {/* Real-time Parsed Metadata Chips Bar */}
        <div className="px-space-md py-2 bg-surface-container-low/40 flex flex-wrap items-center justify-between min-h-[38px] border-b border-outline-variant/15 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {parsed.scheduledDate ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                <span>{parsed.dateLabel || parsed.scheduledDate}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[13px] text-outline">inbox</span>
                <span>待办收件箱</span>
              </span>
            )}

            {parsed.priority === "CRITICAL" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-error text-on-error font-label-sm text-[10px] font-bold">
                <span className="material-symbols-outlined text-[12px]">priority_high</span>
                <span>紧急</span>
              </span>
            )}

            {parsed.priority === "HIGH" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-error-container text-error font-label-sm text-[10px] font-semibold">
                <span>高优先</span>
              </span>
            )}

            {parsed.priority === "LOW" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-surface-container text-on-surface-variant font-label-sm text-[10px]">
                <span>低优先</span>
              </span>
            )}

            {parsed.projectName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-secondary/15 text-secondary font-label-sm text-label-sm font-semibold">
                <span className="material-symbols-outlined text-[13px]">folder</span>
                <span>{parsed.projectName}</span>
              </span>
            )}

            {parsed.estimatedMinutes > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-mono">
                <span className="material-symbols-outlined text-[13px] text-outline">schedule</span>
                <span>{parsed.estimatedMinutes}m</span>
              </span>
            )}
          </div>

          <div className="text-[11px] text-outline font-mono">
            {flatItems.length} 项可用
          </div>
        </div>

        {/* Main Two-column Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: List with groups */}
          <div
            ref={listContainerRef}
            className="w-[42%] min-w-[320px] max-w-[380px] border-r border-outline-variant/15 overflow-y-auto p-2 flex flex-col gap-2"
          >
            {sections.map((sec) => (
              <div key={sec.title} className="flex flex-col gap-0.5">
                <div className="text-[11px] font-semibold text-outline uppercase tracking-wider px-2 py-1">
                  {sec.title}
                </div>
                {sec.items.map((item) => {
                  const itemIndex = flatItems.indexOf(item);
                  const isSelected = itemIndex === selectedIndex;

                  if (item.type === "new_task") {
                    return (
                      <div
                        key="new_task"
                        data-selected={isSelected}
                        onClick={() => {
                          setSelectedIndex(itemIndex);
                          handleCreateTask();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`px-2.5 py-2 rounded-DEFAULT cursor-pointer flex items-center gap-2 text-sm transition-colors ${isSelected
                          ? "bg-surface-container text-on-surface font-medium"
                          : "hover:bg-surface-container/60 text-on-surface-variant"
                          }`}
                      >
                        <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                          bolt
                        </span>
                        <div className="flex-1 truncate">
                          <span className="font-semibold text-primary">
                            {parsed.title.trim() ? `记录待办: "${parsed.title}"` : "记录新待办..."}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-outline text-[14px] shrink-0">
                          keyboard_return
                        </span>
                      </div>
                    );
                  }

                  if (item.type === "task") {
                    const t = item.task;
                    const isDone = t.status === "done";
                    return (
                      <div
                        key={t.id}
                        data-selected={isSelected}
                        onClick={() => {
                          setSelectedIndex(itemIndex);
                          openDrawer(t);
                          closeQuickCapture();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`px-2.5 py-2 rounded-DEFAULT cursor-pointer flex items-center gap-2 text-sm transition-colors ${isSelected
                          ? "bg-surface-container text-on-surface font-medium"
                          : "hover:bg-surface-container/60 text-on-surface-variant"
                          }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[17px] shrink-0 ${isDone ? "text-primary" : "text-outline"
                            }`}
                        >
                          {isDone ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <div className="flex-1 truncate flex items-baseline gap-1.5">
                          <span className={`truncate ${isDone ? "line-through text-outline" : ""}`}>
                            {t.title}
                          </span>
                          {t.projectName && (
                            <span className="text-[11px] text-outline truncate shrink-0">
                              — {t.projectName}
                            </span>
                          )}
                        </div>
                        {t.priority === "CRITICAL" && (
                          <span className="px-1 py-0.2 bg-error/15 text-error rounded text-[10px] font-bold shrink-0">
                            急
                          </span>
                        )}
                        {t.priority === "HIGH" && (
                          <span className="px-1 py-0.2 bg-error-container text-error rounded text-[10px] font-medium shrink-0">
                            高
                          </span>
                        )}
                      </div>
                    );
                  }

                  if (item.type === "project") {
                    const p = item.project;
                    return (
                      <div
                        key={p.id}
                        data-selected={isSelected}
                        onClick={() => {
                          setSelectedIndex(itemIndex);
                          setInputText(`#${p.name} `);
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`px-2.5 py-2 rounded-DEFAULT cursor-pointer flex items-center gap-2 text-sm transition-colors ${isSelected
                          ? "bg-surface-container text-on-surface font-medium"
                          : "hover:bg-surface-container/60 text-on-surface-variant"
                          }`}
                      >
                        <span className="material-symbols-outlined text-secondary text-[17px] shrink-0">
                          folder
                        </span>
                        <div className="flex-1 truncate flex items-baseline gap-1.5">
                          <span className="truncate">{p.name}</span>
                          <span className="text-[11px] text-outline shrink-0">
                            — {p.progress}%
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            ))}
          </div>

          {/* Right Column: High-density Structured Preview Card */}
          <div className="flex-1 overflow-y-auto p-4 bg-surface-container-low/30 flex flex-col">
            <div className="flex-1 bg-surface-container-lowest border border-outline-variant/25 rounded-DEFAULT p-5 flex flex-col justify-between shadow-sm overflow-y-auto">
              {currentSelection?.type === "new_task" && (
                <div className="flex flex-col gap-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
                    <div className="flex items-center gap-1.5 text-xs text-outline font-medium">
                      <span className="material-symbols-outlined text-[16px] text-primary">bolt</span>
                      <span>新待办</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-primary/10 text-primary text-[11px] font-medium">
                      待记录
                    </span>
                  </div>

                  {/* Task Title */}
                  <div>
                    <h3 className="text-title-lg font-semibold text-on-surface break-words leading-snug">
                      {parsed.title.trim() ? parsed.title : "输入待办内容..."}
                    </h3>
                  </div>

                  {/* Structured Properties Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/15 flex flex-col gap-1">
                      <span className="text-outline text-[11px]">归属项目</span>
                      <div className="flex items-center gap-1 font-medium text-on-surface truncate">
                        <span className="material-symbols-outlined text-[15px] text-secondary">folder</span>
                        <span className="truncate">{parsed.projectName || "未指定 (待办收件箱)"}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/15 flex flex-col gap-1">
                      <span className="text-outline text-[11px]">计划日期</span>
                      <div className="flex items-center gap-1 font-medium text-on-surface truncate">
                        <span className="material-symbols-outlined text-[15px] text-primary">calendar_today</span>
                        <span>{parsed.dateLabel || parsed.scheduledDate || "未排期 (随时推进)"}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/15 flex flex-col gap-1">
                      <span className="text-outline text-[11px]">优先级</span>
                      <div className="font-medium text-on-surface flex items-center gap-1">
                        {parsed.priority === "CRITICAL" && <span className="text-error font-bold">紧急</span>}
                        {parsed.priority === "HIGH" && <span className="text-error font-medium">高优先</span>}
                        {parsed.priority === "NORMAL" && <span className="text-on-surface-variant">普通</span>}
                        {parsed.priority === "LOW" && <span className="text-outline">低优先</span>}
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/15 flex flex-col gap-1">
                      <span className="text-outline text-[11px]">预估时长</span>
                      <div className="flex items-center gap-1 font-mono font-medium text-on-surface">
                        <span className="material-symbols-outlined text-[15px] text-outline">schedule</span>
                        <span>{parsed.estimatedMinutes > 0 ? `${parsed.estimatedMinutes} 分钟` : "未指定"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentSelection?.type === "task" && (
                <div className="flex flex-col gap-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
                    <div className="flex items-center gap-1.5 text-xs text-outline font-medium">
                      <span className="material-symbols-outlined text-[16px]">task</span>
                      <span>{currentSelection.task.projectName || "个人待办"} · {currentSelection.task.id}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        openDrawer(currentSelection.task);
                        closeQuickCapture();
                      }}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                    >
                      <span>打开详情</span>
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </button>
                  </div>

                  {/* Task Title */}
                  <div>
                    <h3 className={`text-title-lg font-semibold break-words leading-snug ${currentSelection.task.status === "done" ? "line-through text-outline" : "text-on-surface"
                      }`}>
                      {currentSelection.task.title}
                    </h3>
                  </div>

                  {/* Structured Properties Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/15 flex flex-col gap-1">
                      <span className="text-outline text-[11px]">任务状态</span>
                      <div className="font-medium text-on-surface">
                        {currentSelection.task.status === "done" && <span className="text-primary">已完成</span>}
                        {currentSelection.task.status === "in_progress" && <span className="text-primary font-semibold">推进中</span>}
                        {currentSelection.task.status === "todo" && <span className="text-on-surface-variant">待推进</span>}
                        {currentSelection.task.status === "deferred" && <span className="text-outline">已顺延</span>}
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/15 flex flex-col gap-1">
                      <span className="text-outline text-[11px]">排期安排</span>
                      <div className="font-medium text-on-surface truncate">
                        {currentSelection.task.scheduledDate || currentSelection.task.dueDate || "未排期"}
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/15 flex flex-col gap-1">
                      <span className="text-outline text-[11px]">优先级</span>
                      <div className="font-medium text-on-surface">
                        {currentSelection.task.priority === "CRITICAL" && <span className="text-error font-bold">紧急</span>}
                        {currentSelection.task.priority === "HIGH" && <span className="text-error font-medium">高优先</span>}
                        {currentSelection.task.priority === "NORMAL" && <span className="text-on-surface-variant">普通</span>}
                        {currentSelection.task.priority === "LOW" && <span className="text-outline">低优先</span>}
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/15 flex flex-col gap-1">
                      <span className="text-outline text-[11px]">预估工时</span>
                      <div className="font-mono font-medium text-on-surface">
                        {currentSelection.task.estimatedMinutes ? `${currentSelection.task.estimatedMinutes} 分钟` : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Description / Checklist preview */}
                  {currentSelection.task.description && (
                    <div className="p-3 rounded bg-surface-container-low/40 border border-outline-variant/10 text-xs text-on-surface-variant">
                      <div className="text-[11px] font-semibold text-outline mb-1">备忘与描述</div>
                      <p className="line-clamp-3 leading-relaxed whitespace-pre-wrap">
                        {currentSelection.task.description}
                      </p>
                    </div>
                  )}

                  {currentSelection.task.checklist && currentSelection.task.checklist.length > 0 && (
                    <div className="flex flex-col gap-1 text-xs">
                      <div className="text-[11px] font-semibold text-outline">检查清单 ({currentSelection.task.checklist.filter((c: TaskChecklistItem) => c.isCompleted).length}/{currentSelection.task.checklist.length})</div>
                      <div className="flex flex-col gap-1">
                        {currentSelection.task.checklist.slice(0, 3).map((chk: TaskChecklistItem) => (
                          <div key={chk.id} className="flex items-center gap-1.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] text-outline">
                              {chk.isCompleted ? "check_box" : "check_box_outline_blank"}
                            </span>
                            <span className={chk.isCompleted ? "line-through text-outline" : ""}>{chk.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentSelection?.type === "project" && (
                <div className="flex flex-col gap-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
                    <div className="flex items-center gap-1.5 text-xs text-outline font-medium">
                      <span className="material-symbols-outlined text-[16px] text-secondary">folder</span>
                      <span>项目档案</span>
                    </div>
                    <span className="text-xs text-secondary font-mono">
                      进度 {currentSelection.project.progress}%
                    </span>
                  </div>

                  <div>
                    <h3 className="text-title-lg font-semibold text-on-surface break-words leading-snug">
                      {currentSelection.project.name}
                    </h3>
                  </div>

                  <div className="p-3 rounded bg-surface-container-low/40 border border-outline-variant/10 text-xs text-on-surface-variant">
                    <div className="text-[11px] font-semibold text-outline mb-1">项目目标与背景</div>
                    <p className="line-clamp-4 leading-relaxed">
                      {currentSelection.project.description || "暂无详细描述"}
                    </p>
                  </div>
                </div>
              )}

              {/* Card Footer Action Hint */}
              <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between text-xs text-outline">
                {currentSelection?.type === "new_task" ? (
                  <span className="text-primary font-medium flex items-center gap-1">
                    <span>按 ↵ 回车立即保存至待办收件箱</span>
                  </span>
                ) : currentSelection?.type === "task" ? (
                  <span className="flex items-center gap-1">
                    <span>按 ↵ 回车打开任务详情抽屉</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span>按 ↵ 筛选此项目的所有关联任务</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Shortcut Guide matching reference design */}
        <div className="px-space-md py-2 bg-surface-container-lowest border-t border-outline-variant/20 flex items-center justify-between text-outline text-xs">
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-surface-container border border-outline-variant/30 rounded text-[10px] font-mono leading-none">
                ↵
              </kbd>
              <span>{currentSelection?.type === "new_task" ? "保存待办" : "打开项目/任务"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-surface-container border border-outline-variant/30 rounded text-[10px] font-mono leading-none">
                ↑↓
              </kbd>
              <span>切换选中</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-surface-container border border-outline-variant/30 rounded text-[10px] font-mono leading-none">
                Esc
              </kbd>
              <span>关闭</span>
            </div>
          </div>

          <div className="text-[11px] text-outline">
          </div>
        </div>
      </div>
    </div>
  );
}

