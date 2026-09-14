import { ArrowRight, History, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import {
  allowedNextStatuses,
  canonicalStatus,
  readStatusHistory,
  statusLabel,
  statusMachineFor,
  type EntityKind,
  type PropertyValue,
  type StatusHistoryEntry
} from "../../shared/domain";

const TONE_BY_STATUS: Record<string, string> = {
  inbox: "gray",
  todo: "blue",
  doing: "orange",
  done: "green",
  idea: "gray",
  active: "orange",
  waiting: "blue",
  completed: "green",
  archived: "gray"
};

function toneOf(status: string): string {
  return TONE_BY_STATUS[status] ?? "gray";
}

/**
 * 状态流转控件：把状态机白名单直接画成可点的芯片。
 * 不允许到达的状态保留在原位但禁用，让用户看得见「为什么不能这么走」，
 * 而不是从下拉框里神秘消失。
 */
export function StatusFlowField({
  kind,
  value,
  onChange,
  disabled = false,
  label = "状态"
}: {
  kind: EntityKind;
  value: PropertyValue | undefined;
  onChange: (next: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const machine = statusMachineFor(kind);
  const current = canonicalStatus(kind, value);
  const allowed = useMemo(() => new Set(allowedNextStatuses(kind, value)), [kind, value]);
  if (!machine) return null;
  const isLegacy = Boolean(current) && !machine.states.includes(current);

  return (
    <div className="field full-span status-flow-field">
      <span className="status-flow-label">
        {label}
        {isLegacy && <em className="status-flow-legacy" title={`当前值「${current}」不是规范状态，选择任一状态即可归一`}>历史值：{current}</em>}
      </span>
      <div className="status-flow-chips" role="group" aria-label={`${label}流转`}>
        {machine.states.map((state) => {
          const active = state === current;
          const reachable = active || allowed.has(state);
          return (
            <button
              type="button"
              key={state}
              className={`status-chip tone-${toneOf(state)}${active ? " is-active" : ""}${reachable ? "" : " is-blocked"}`}
              aria-pressed={active}
              disabled={disabled || !reachable}
              title={reachable
                ? (active ? "当前状态" : `变更为「${machine.labels[state] ?? state}」`)
                : `不能从「${machine.labels[current] ?? (current || "未设置")}」直接变更为「${machine.labels[state] ?? state}」`}
              onClick={() => { if (!active && reachable) onChange(state); }}
            >
              <span className="status-chip-dot" />
              {machine.labels[state] ?? state}
              {!reachable && <Lock size={11} className="status-chip-lock" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatMoment(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const head = sameYear ? "" : `${date.getFullYear()}-`;
  return `${head}${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const ACTOR_LABELS: Record<string, string> = {
  app: "手动",
  ui: "手动",
  restore: "归档恢复",
  workflow: "工作流",
  script: "脚本"
};

const COLLAPSED_COUNT = 5;

/** 审计历史时间线：倒序展示 frontmatter 里的 status_history。 */
export function StatusHistoryPanel({ kind, history }: { kind: EntityKind; history: PropertyValue | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const entries = useMemo(
    () => readStatusHistory(history).slice().reverse(),
    [history]
  );
  if (!statusMachineFor(kind)) return null;

  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT);
  return (
    <section className="status-history" aria-label="状态变更历史">
      <div className="status-history-head">
        <div><History size={15} /><strong>状态历史</strong></div>
        <span>{entries.length ? `共 ${entries.length} 次变更` : "暂无变更记录"}</span>
      </div>
      {entries.length ? (
        <>
          <ol className="status-history-list">
            {visible.map((entry, index) => <StatusHistoryRow key={`${entry.at}-${index}`} kind={kind} entry={entry} />)}
          </ol>
          {entries.length > COLLAPSED_COUNT && (
            <button type="button" className="status-history-more" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "收起" : `展开其余 ${entries.length - COLLAPSED_COUNT} 条`}
            </button>
          )}
        </>
      ) : (
        <p className="status-history-empty">状态第一次变更后，这里会留下可追溯的记录。</p>
      )}
    </section>
  );
}

function StatusHistoryRow({ kind, entry }: { kind: EntityKind; entry: StatusHistoryEntry }) {
  const from = entry.from ? statusLabel(kind, entry.from) : "新建";
  const to = statusLabel(kind, entry.to);
  return (
    <li className="status-history-row">
      <span className={`status-history-dot tone-${toneOf(canonicalStatus(kind, entry.to))}`} />
      <span className="status-history-transition">
        <em>{from}</em>
        <ArrowRight size={12} />
        <strong>{to}</strong>
      </span>
      <span className="status-history-meta">
        {entry.by && <span className="status-history-actor">{ACTOR_LABELS[entry.by] ?? entry.by}</span>}
        {entry.note && <span className="status-history-note" title={entry.note}>{entry.note}</span>}
        <time>{formatMoment(entry.at)}</time>
      </span>
    </li>
  );
}
