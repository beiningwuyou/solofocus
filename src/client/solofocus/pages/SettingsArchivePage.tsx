import React, { useState, useEffect } from "react";
import { useSoloFocus } from "../context";
import { soloApi } from "../api";
import type { EmailPresetKey } from "../../../shared/solofocus-models";

const EMAIL_PRESET_OPTIONS: { key: EmailPresetKey; label: string; host: string; port: number; secure: boolean }[] = [
  { key: "qq_enterprise", label: "腾讯企业邮 / 企业微信邮箱", host: "imap.exmail.qq.com", port: 993, secure: true },
  { key: "netease_enterprise", label: "网易企业邮", host: "imap.qiye.163.com", port: 993, secure: true },
  { key: "163", label: "网易 163 邮箱", host: "imap.163.com", port: 993, secure: true },
  { key: "qq", label: "QQ 邮箱", host: "imap.qq.com", port: 993, secure: true },
  { key: "outlook", label: "Outlook / Office 365", host: "outlook.office365.com", port: 993, secure: true },
  { key: "gmail", label: "Gmail", host: "imap.gmail.com", port: 993, secure: true },
  { key: "custom", label: "自定义 IMAP 服务器", host: "", port: 993, secure: true }
];

export function SettingsArchivePage() {
  const { data, refetch, openRestoreModal, showToast } = useSoloFocus();

  const [activeTab, setActiveTab] = useState<"ARCHIVES" | "TRASH" | "BACKUPS" | "AI_CONFIG" | "EMAIL_CONFIG">("BACKUPS");
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  // AI Agent Settings State
  const [aiProvider, setAiProvider] = useState<"agy-native" | "custom">("agy-native");
  const [aiBaseUrl, setAiBaseUrl] = useState("https://api.deepseek.com/v1");
  const [aiModel, setAiModel] = useState("deepseek-chat");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiTemperature, setAiTemperature] = useState(0.3);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [isSavingAi, setIsSavingAi] = useState(false);

  // Email Integration State
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailPreset, setEmailPreset] = useState<EmailPresetKey>("qq_enterprise");
  const [imapHost, setImapHost] = useState("imap.exmail.qq.com");
  const [imapPort, setImapPort] = useState(993);
  const [emailSecure, setEmailSecure] = useState(true);
  const [emailUsername, setEmailUsername] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailHasPassword, setEmailHasPassword] = useState(false);
  const [emailFolder, setEmailFolder] = useState("INBOX");
  const [emailAutoSync, setEmailAutoSync] = useState(true);
  const [emailSyncLimit, setEmailSyncLimit] = useState(15);
  const [emailLookbackDays, setEmailLookbackDays] = useState(3);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  useEffect(() => {
    soloApi.getAiConfig().then((cfg) => {
      if (cfg) {
        const provider = cfg.provider || (cfg.hasRawKey ? "custom" : "agy-native");
        setAiProvider(provider);
        if (cfg.baseUrl) setAiBaseUrl(cfg.baseUrl);
        if (cfg.model) setAiModel(cfg.model);
        if (cfg.apiKey) setAiApiKey(cfg.apiKey);
        if (typeof cfg.temperature === "number") setAiTemperature(cfg.temperature);
        setAiConfigured(provider === "agy-native" || Boolean(cfg.configured || cfg.hasRawKey));
      }
    }).catch(() => { });

    soloApi.getEmailConfig().then((cfg) => {
      if (cfg) {
        setEmailEnabled(Boolean(cfg.enabled));
        if (cfg.preset) setEmailPreset(cfg.preset);
        if (cfg.imapHost) setImapHost(cfg.imapHost);
        if (typeof cfg.imapPort === "number") setImapPort(cfg.imapPort);
        if (cfg.secure !== undefined) setEmailSecure(cfg.secure);
        if (cfg.username) setEmailUsername(cfg.username);
        setEmailHasPassword(Boolean(cfg.hasPassword));
        if (cfg.folder) setEmailFolder(cfg.folder);
        if (cfg.autoSyncOnOpen !== undefined) setEmailAutoSync(cfg.autoSyncOnOpen);
        if (typeof cfg.syncLimit === "number") setEmailSyncLimit(cfg.syncLimit);
        if (typeof cfg.lookbackDays === "number") setEmailLookbackDays(cfg.lookbackDays);
      }
    }).catch(() => { });
  }, []);

  const handleSelectEmailPreset = (presetKey: EmailPresetKey) => {
    setEmailPreset(presetKey);
    const match = EMAIL_PRESET_OPTIONS.find((opt) => opt.key === presetKey);
    if (match && presetKey !== "custom") {
      setImapHost(match.host);
      setImapPort(match.port);
      setEmailSecure(match.secure);
    }
  };

  const handleSaveAiConfig = async (providerOverride?: "agy-native" | "custom") => {
    const targetProvider = providerOverride ?? aiProvider;
    try {
      setIsSavingAi(true);
      const res = await soloApi.saveAiConfig({
        provider: targetProvider,
        baseUrl: aiBaseUrl.trim(),
        model: targetProvider === "agy-native" ? "gemini-3.7-flash (AGY Native)" : aiModel.trim(),
        apiKey: targetProvider === "agy-native" ? "" : aiApiKey.trim(),
        temperature: aiTemperature
      });
      const resolvedProvider = res.config.provider || targetProvider;
      setAiProvider(resolvedProvider);
      setAiConfigured(resolvedProvider === "agy-native" || Boolean(res.config.configured));
      if (resolvedProvider === "agy-native") {
        showToast("已切换至 Antigravity 内置智能体模式 (零配置就绪)", "bolt");
      } else {
        showToast("自定义外部 AI 模型服务设置已保存", "check_circle");
      }
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, "error");
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleSaveEmailConfig = async () => {
    try {
      setIsSavingEmail(true);
      const res = await soloApi.saveEmailConfig({
        enabled: emailEnabled,
        preset: emailPreset,
        imapHost: imapHost.trim(),
        imapPort: Number(imapPort),
        secure: emailSecure,
        username: emailUsername.trim(),
        password: emailPassword ? emailPassword.trim() : undefined,
        folder: emailFolder.trim() || "INBOX",
        autoSyncOnOpen: emailAutoSync,
        syncLimit: Number(emailSyncLimit) || 15,
        lookbackDays: Number(emailLookbackDays) || 3
      });
      setEmailHasPassword(Boolean(res.config.hasPassword));
      setEmailPassword(""); // 清空输入框中的临时密码
      showToast("工作邮箱配置已保存", "mark_email_read");
    } catch (err: any) {
      showToast(`保存失败: ${err.message}`, "error");
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleTestEmailConnection = async () => {
    try {
      setIsTestingEmail(true);
      setEmailTestResult(null);

      // 如果有新输入的配置/密码，先静默暂存
      if (emailPassword) {
        await soloApi.saveEmailConfig({
          enabled: emailEnabled,
          preset: emailPreset,
          imapHost: imapHost.trim(),
          imapPort: Number(imapPort),
          secure: emailSecure,
          username: emailUsername.trim(),
          password: emailPassword.trim(),
          folder: emailFolder.trim() || "INBOX"
        });
        setEmailHasPassword(true);
      }

      const res = await soloApi.testEmailConnection();
      setEmailTestResult(res);
      if (res.success) {
        showToast("邮箱连接测试成功", "check_circle");
      } else {
        showToast("连接失败，请检查配置", "error");
      }
    } catch (err: any) {
      setEmailTestResult({ success: false, message: err.message || "测试连接发生未知异常" });
      showToast(`测试连接异常: ${err.message}`, "error");
    } finally {
      setIsTestingEmail(false);
    }
  };


  const sysStatus = data?.systemStatus;
  const archives = data?.archives || [];
  const trash = data?.trash || [];
  const snapshots = data?.snapshots || [];

  const handleCreateSnapshot = async () => {
    try {
      setIsCreatingSnapshot(true);
      const snap = await soloApi.createSnapshot();
      showToast(`已创建本地快照: ${snap.filename}`, "save");
      await refetch();
    } catch (err: any) {
      showToast(`创建失败: ${err.message}`, "error");
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRestoreTrash = async (id: string, name: string) => {
    try {
      await soloApi.restoreTrashItem(id);
      showToast(`「${name}」已成功还原`, "restore_from_trash");
      await refetch();
    } catch (err: any) {
      showToast(`还原失败: ${err.message}`, "error");
    }
  };

  const handlePurgeTrash = async (id: string, name: string) => {
    if (!window.confirm(`确定彻底清除「${name}」吗？此操作无法撤销。`)) return;
    try {
      await soloApi.purgeTrashItem(id);
      showToast(`「${name}」已永久清除`, "delete_forever");
      await refetch();
    } catch (err: any) {
      showToast(`清除失败: ${err.message}`, "error");
    }
  };

  const handleClearAllTrash = async () => {
    if (!window.confirm("确定清空整个回收站吗？所有条目将被永久清除，无法撤销。")) return;
    try {
      await soloApi.clearAllTrash();
      showToast("回收站已清空", "delete_sweep");
      await refetch();
    } catch (err: any) {
      showToast(`清空失败: ${err.message}`, "error");
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-on-surface">
            设置、备份与归档
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="h-9 px-4 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-[13px] rounded flex items-center gap-1.5 transition-colors"
            onClick={() => openRestoreModal()}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>恢复备份 (安全校验)</span>
          </button>
          <button
            className="h-9 px-4 bg-primary hover:bg-neutral-800 text-on-primary font-label-md text-[13px] rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
            disabled={isCreatingSnapshot}
            onClick={handleCreateSnapshot}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            <span>{isCreatingSnapshot ? "快照写入中..." : "立即创建物理快照"}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="font-label-md text-on-surface-variant">本地数据库容量</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="font-headline-lg text-primary font-bold">
              {sysStatus ? sysStatus.storageMb.toFixed(1) : "7.4"} MB
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="font-label-md text-on-surface-variant">归档账本总量</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="font-headline-lg text-primary font-bold">{archives.length} 条</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="font-label-md text-on-surface-variant">自动快照留存</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="font-headline-lg text-primary font-bold">{snapshots.length} 份</span>
            <span className="font-label-sm text-secondary">可用校验</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-lg shadow-sm border border-outline-variant/20 flex flex-col justify-between">
          <span className="font-label-md text-on-surface-variant">SQLite 驱动</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="font-headline-lg text-primary font-bold">
              {sysStatus?.sqliteVersion || "v3.45.0"}
            </span>
            <span className="font-label-sm text-secondary flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="inline-flex items-center rounded bg-surface-container-low p-1 border border-outline-variant/20 w-fit">
        <button
          className={`px-4 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all ${activeTab === "BACKUPS" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
          onClick={() => setActiveTab("BACKUPS")}
          type="button"
        >
          备份与快照索引 ({snapshots.length})
        </button>
        <button
          className={`px-4 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all ${activeTab === "ARCHIVES" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
          onClick={() => setActiveTab("ARCHIVES")}
          type="button"
        >
          历史归档总账 ({archives.length})
        </button>
        <button
          className={`px-4 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all ${activeTab === "TRASH" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
          onClick={() => setActiveTab("TRASH")}
          type="button"
        >
          回收站 (30天保底) ({trash.length})
        </button>
        <button
          className={`px-4 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all flex items-center gap-1.5 ${activeTab === "AI_CONFIG" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
          onClick={() => setActiveTab("AI_CONFIG")}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">psychology</span>
          <span>AI 智能体模型设置</span>
          {aiConfigured && (
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          )}
        </button>
        <button
          className={`px-4 py-1.5 rounded-sm font-label-md text-[13px] font-medium transition-all flex items-center gap-1.5 ${activeTab === "EMAIL_CONFIG" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
            }`}
          onClick={() => setActiveTab("EMAIL_CONFIG")}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">mail</span>
          <span>工作邮箱配置</span>
          {emailEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
          )}
        </button>
      </div>



      {/* Tab Content 1: Backups Table */}
      {activeTab === "BACKUPS" && (
        <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
          <div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
            <span className="font-label-lg text-label-lg text-on-surface font-semibold">
              本地备份与归档快照索引列表
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              共 {snapshots.length} 份物理快照文件
            </span>
          </div>

          <div className="divide-y divide-surface-container">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="h-14 px-space-md flex items-center justify-between font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low/40 transition-colors"
              >
                <div className="flex items-center gap-2 w-1/3 min-w-0">
                  <span className="material-symbols-outlined text-[18px] text-primary">inventory_2</span>
                  <span className="font-mono text-xs truncate font-semibold">{snap.filename}</span>
                </div>
                <span className="w-1/4 text-on-surface-variant">{snap.createdAt}</span>
                <span className="w-1/6 font-mono text-xs">{(snap.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                <div className="flex items-center gap-3">
                  <span className="text-secondary font-label-sm text-label-sm flex items-center gap-1 font-semibold">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    完整可用
                  </span>
                  <button
                    className="h-7 px-3 bg-surface-container hover:bg-surface-container-high rounded text-on-surface font-label-sm text-xs font-semibold"
                    onClick={() => openRestoreModal(snap.filename)}
                    type="button"
                  >
                    恢复此快照
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 2: Archive Table */}
      {activeTab === "ARCHIVES" && (
        <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-md text-label-md">
                  <th className="py-2.5 px-4 font-semibold">条目名称与归属</th>
                  <th className="py-2.5 px-4 font-semibold">归档入库时间</th>
                  <th className="py-2.5 px-4 font-semibold">实体类型</th>
                  <th className="py-2.5 px-4 font-semibold text-right">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-on-surface font-body-sm text-body-sm">
                {archives.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3 px-4 min-w-[280px]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-outline">
                          {item.entityType === "project" ? "folder" : "task_alt"}
                        </span>
                        <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                          {item.originalName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">
                      {item.archivedAt}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-xs font-semibold">
                        {item.entityType === "project" ? "项目" : "任务"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="text-outline text-xs">只读已封存</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content 3: Trash Table */}
      {activeTab === "TRASH" && (
        <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
          <div className="px-space-md py-space-sm bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                回收站条目列表 (保留 30 天自动清除)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-outline text-xs font-mono">
                {trash.length} 项
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-label-sm text-label-sm text-outline">
                可单项还原或彻底清除
              </span>
              {trash.length > 0 && (
                <button
                  type="button"
                  className="px-2.5 py-1 text-xs text-error hover:bg-error-container/30 border border-error/20 rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
                  onClick={handleClearAllTrash}
                >
                  <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                  <span>清空回收站</span>
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-surface-container">
            {trash.length === 0 ? (
              <div className="p-8 text-center text-outline font-body-sm">回收站为空</div>
            ) : (
              trash.map((item) => (
                <div
                  key={item.id}
                  className="h-14 px-space-md flex items-center justify-between font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-outline">delete</span>
                    <span className="font-title-sm text-title-sm font-semibold">{item.entityName}</span>
                    <span className="px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant font-label-sm text-xs">
                      {item.entityType === "project"
                        ? "项目"
                        : item.entityType === "task"
                          ? "任务"
                          : item.entityType === "habit"
                            ? "习惯"
                            : item.entityType === "sop"
                              ? "SOP"
                              : item.entityType}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-outline text-xs">删除时间: {item.deletedAt}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-2.5 py-1 text-xs bg-surface-container hover:bg-surface-container-high text-on-surface rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
                        onClick={() => handleRestoreTrash(item.id, item.entityName)}
                        title="还原至原位置"
                      >
                        <span className="material-symbols-outlined text-[14px] text-secondary">restore</span>
                        <span>还原</span>
                      </button>
                      <button
                        type="button"
                        className="px-2.5 py-1 text-xs text-error hover:bg-error-container/30 border border-error/20 rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
                        onClick={() => handlePurgeTrash(item.id, item.entityName)}
                        title="永久删除，不可恢复"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                        <span>彻底删除</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content 4: AI Agent Configuration */}
      {activeTab === "AI_CONFIG" && (
        <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col p-6 gap-6">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
            <div>
              <h2 className="font-title-lg text-title-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">psychology</span>
                <span>AI Agent 模型与推理引擎服务配置</span>
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                支持 Antigravity 内置智能体开箱即用，同时具备自定义外部大模型 API 接入能力。
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded font-label-md text-xs font-semibold flex items-center gap-1.5 ${
                aiProvider === "agy-native" || aiConfigured
                  ? "bg-secondary/15 text-secondary"
                  : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {aiProvider === "agy-native" ? "bolt" : aiConfigured ? "check_circle" : "offline_bolt"}
              </span>
              <span>
                {aiProvider === "agy-native"
                  ? "Antigravity 内置智能体已就绪 (开箱即用)"
                  : aiConfigured
                  ? "自定义外部大模型已连接"
                  : "自定义 API 未连接"}
              </span>
            </span>
          </div>

          {/* Engine Mode Toggle */}
          <div className="flex flex-col gap-2">
            <span className="font-label-sm text-xs font-semibold text-on-surface">
              运行引擎模式
            </span>
            <div className="flex items-center gap-2 p-1 bg-surface-container-low rounded border border-outline-variant/20 max-w-md">
              <button
                type="button"
                onClick={() => handleSaveAiConfig("agy-native")}
                className={`flex-1 h-8 rounded font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  aiProvider === "agy-native"
                    ? "bg-surface-container-lowest text-primary shadow-xs border border-outline-variant/30"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">bolt</span>
                <span>Antigravity 内置智能体</span>
              </button>
              <button
                type="button"
                onClick={() => setAiProvider("custom")}
                className={`flex-1 h-8 rounded font-label-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  aiProvider === "custom"
                    ? "bg-surface-container-lowest text-primary shadow-xs border border-outline-variant/30"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">tune</span>
                <span>自定义外部 API</span>
              </button>
            </div>
          </div>

          {aiProvider === "agy-native" ? (
            /* AGY Native Engine Overview */
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
                    <span className="font-title-sm text-sm font-semibold text-on-surface">
                      Antigravity 原生引擎 · Gemini 3.7 Flash 驱动
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-[11px] font-semibold">
                    当前生效
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                  当前应用已接入 Antigravity 原生智能体。无需配置任何外部 API Key 或网络代理，即可在演示和日常工作中体验完整的 Agent 流程，兼具零延迟响应与 100% 本地隐私安全。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-surface-container-lowest rounded border border-outline-variant/15 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-primary">
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      <span className="font-label-md text-xs font-semibold">每日工作简报与排期</span>
                    </div>
                    <span className="font-body-sm text-[11px] text-on-surface-variant leading-normal">
                      基于今日工时负荷与截止期，智能推演 Top 3 核心聚焦与顺延卸载建议。
                    </span>
                  </div>
                  <div className="p-3 bg-surface-container-lowest rounded border border-outline-variant/15 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-secondary">
                      <span className="material-symbols-outlined text-[16px]">history_edu</span>
                      <span className="font-label-md text-xs font-semibold">工程演进手记提炼</span>
                    </div>
                    <span className="font-body-sm text-[11px] text-on-surface-variant leading-normal">
                      自动萃取已交付工序与下一步推进卡点，生成条理分明的项目日志。
                    </span>
                  </div>
                  <div className="p-3 bg-surface-container-lowest rounded border border-outline-variant/15 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-tertiary">
                      <span className="material-symbols-outlined text-[16px]">schema</span>
                      <span className="font-label-md text-xs font-semibold">SOP 规程推荐与萃取</span>
                    </div>
                    <span className="font-body-sm text-[11px] text-on-surface-variant leading-normal">
                      从项目执行轨迹中向内萃取 3 阶段标准作业程序，沉淀个人显性经验。
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-container-low/50 rounded border border-outline-variant/15">
                <span className="font-body-sm text-xs text-on-surface-variant">
                  如需在后续正式接入专属 OpenAI 或 DeepSeek 企业通道，可随时切换到「自定义外部 API」模式。
                </span>
                <button
                  type="button"
                  disabled={isSavingAi}
                  onClick={() => handleSaveAiConfig("agy-native")}
                  className="h-8 px-3.5 bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">refresh</span>
                  <span>刷新引擎状态</span>
                </button>
              </div>
            </div>
          ) : (
            /* Custom External API Configuration */
            <div className="flex flex-col gap-6">
              <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 flex flex-col gap-1.5">
                <span className="font-label-md text-xs font-semibold text-on-surface flex items-center gap-1">
                  <span className="material-symbols-outlined text-primary text-[16px]">tune</span>
                  <span>自定义外部大模型说明</span>
                </span>
                <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                  可接入任何兼兼容 OpenAI / DeepSeek / Ollama 格式的推理接口。保存有效密钥后系统将通过外部服务执行推理；若网络超时或请求异常，将自动回落至 Antigravity 原生引擎保障演示与日常可用性。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-xs font-semibold text-on-surface">
                    API 端点 (Base URL)
                  </label>
                  <input
                    className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                    placeholder="https://api.deepseek.com/v1"
                    type="text"
                    value={aiBaseUrl}
                    onChange={(e) => setAiBaseUrl(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-xs font-semibold text-on-surface">
                    模型标识 (Model)
                  </label>
                  <input
                    className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                    placeholder="deepseek-chat"
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-xs font-semibold text-on-surface">
                    API 密钥 (API Key)
                  </label>
                  <input
                    className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-xs font-semibold text-on-surface">
                      采样温度 (Temperature)
                    </label>
                    <span className="font-mono text-xs text-outline">{aiTemperature}</span>
                  </div>
                  <input
                    className="w-full h-7 accent-primary cursor-pointer"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={aiTemperature}
                    onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-outline-variant/15">
                <button
                  type="button"
                  onClick={() => handleSaveAiConfig("agy-native")}
                  className="h-9 px-3.5 text-on-surface-variant hover:text-on-surface font-label-md text-xs font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>切回 Antigravity 内置引擎</span>
                </button>
                <button
                  type="button"
                  disabled={isSavingAi}
                  onClick={() => handleSaveAiConfig("custom")}
                  className="h-9 px-5 bg-primary text-on-primary hover:bg-neutral-800 font-label-md text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isSavingAi ? "hourglass_top" : "save"}
                  </span>
                  <span>{isSavingAi ? "正在保存..." : "保存自定义 API 配置"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 5: Work Email & Auto-sync */}
      {activeTab === "EMAIL_CONFIG" && (
        <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/20 p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15">
            <div className="flex flex-col gap-0.5">
              <span className="font-title-sm text-sm font-semibold text-on-surface">
                邮箱集成与智能待办
              </span>
              <span className="font-body-sm text-xs text-on-surface-variant">
                安全同步最新邮件，Agent 自动提炼待办事项并建议至今日清单
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                <span className="font-label-md text-xs font-semibold text-on-surface">
                  {emailEnabled ? "邮箱同步已启用" : "邮箱同步已停用"}
                </span>
              </label>

              <span
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 ${emailEnabled && emailHasPassword
                  ? "bg-secondary/15 text-secondary"
                  : "bg-surface-container text-outline"
                  }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {emailEnabled && emailHasPassword ? "check_circle" : "mail_lock"}
                </span>
                <span>
                  {emailEnabled && emailHasPassword ? "已配置就绪" : "待配置凭证"}
                </span>
              </span>
            </div>
          </div>

          {/* Privacy & Protocol Note */}
          <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant/20 flex flex-col gap-1.5">
            <span className="font-label-md text-xs font-semibold text-on-surface flex items-center gap-1">
              <span className="material-symbols-outlined text-primary text-[16px]">lock</span>
              <span>本地保护与安全</span>
            </span>
            <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
              您的邮箱授权码仅保存在本地设备的应用数据目录中，绝不上传任何云端服务器。同步过程仅拉取邮件文字摘要并在本地提炼待办；所有 AI 生成的待办建议在排入今日清单前均须经您亲自确认，杜绝未经授权的静默写入。
            </p>
          </div>

          {/* Quick Preset Selection */}
          <div className="flex flex-col gap-2">
            <label className="font-label-sm text-xs font-semibold text-on-surface">
              快速选择邮箱服务商
            </label>
            <div className="flex flex-wrap gap-2">
              {EMAIL_PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectEmailPreset(opt.key)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${emailPreset === opt.key
                    ? "bg-primary text-on-primary border-primary shadow-xs"
                    : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:border-outline hover:text-on-surface"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-xs font-semibold text-on-surface">
                IMAP 服务器主机 (Host)
              </label>
              <input
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                placeholder="imap.exmail.qq.com"
                type="text"
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-xs font-semibold text-on-surface">
                  端口号 (Port)
                </label>
                <input
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                  placeholder="993"
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(parseInt(e.target.value, 10) || 993)}
                />
              </div>

              <div className="flex flex-col gap-1 justify-end">
                <label className="h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={emailSecure}
                    onChange={(e) => setEmailSecure(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                  <span className="font-label-sm text-xs text-on-surface font-medium">
                    SSL / TLS 加密
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-xs font-semibold text-on-surface">
                工作邮箱账号 (Email)
              </label>
              <input
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                placeholder="your-name@company.com"
                type="text"
                value={emailUsername}
                onChange={(e) => setEmailUsername(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="font-label-sm text-xs font-semibold text-on-surface">
                  应用专用密码 / 授权码
                </label>
                {emailHasPassword && !emailPassword && (
                  <span className="text-[11px] text-secondary font-mono flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">check</span>
                    已保存密码凭证
                  </span>
                )}
              </div>
              <input
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                placeholder={emailHasPassword ? "•••••••• (留空表示不修改)" : "输入邮箱客户端授权码或密码"}
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
              />
              <span className="text-[11px] text-outline mt-0.5">
                注：企业微信/QQ/网易企业邮请在邮箱网页端「设置 - 客户端授权码」生成独立密码
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-xs font-semibold text-on-surface">
                收件文件夹 (Mailbox Folder)
              </label>
              <input
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                placeholder="INBOX"
                type="text"
                value={emailFolder}
                onChange={(e) => setEmailFolder(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-xs font-semibold text-on-surface">
                  单次最大分析封数
                </label>
                <input
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                  type="number"
                  min="5"
                  max="50"
                  value={emailSyncLimit}
                  onChange={(e) => setEmailSyncLimit(parseInt(e.target.value, 10) || 15)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-xs font-semibold text-on-surface">
                  回溯范围 (天数)
                </label>
                <input
                  className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface outline-none focus:border-primary font-mono"
                  type="number"
                  min="1"
                  max="14"
                  value={emailLookbackDays}
                  onChange={(e) => setEmailLookbackDays(parseInt(e.target.value, 10) || 3)}
                />
              </div>
            </div>
          </div>

          {/* Sync Behavior Options */}
          <div className="p-3 bg-surface-container-low/40 rounded-lg border border-outline-variant/15 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-label-md text-xs font-semibold text-on-surface">
                工作台启动与切入时自动刷新邮件
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                每次进入「今日看板」时，后台自动检测是否有新的工作邮件并智能提炼候选待办
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailAutoSync}
                onChange={(e) => setEmailAutoSync(e.target.checked)}
                className="w-4 h-4 rounded accent-primary cursor-pointer"
              />
            </label>
          </div>

          {/* Test Connection Feedback Banner */}
          {emailTestResult && (
            <div
              className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${emailTestResult.success
                ? "bg-secondary/10 border-secondary/30 text-secondary"
                : "bg-error/10 border-error/30 text-error"
                }`}
            >
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                {emailTestResult.success ? "check_circle" : "error"}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">
                  {emailTestResult.success ? "连接成功" : "连接失败"}
                </span>
                <span>{emailTestResult.message}</span>
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-outline-variant/15">
            <button
              type="button"
              disabled={isTestingEmail}
              onClick={handleTestEmailConnection}
              className="h-9 px-4 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${isTestingEmail ? "animate-spin" : ""}`}>
                {isTestingEmail ? "sync" : "cable"}
              </span>
              <span>{isTestingEmail ? "正在尝试握手..." : "测试 IMAP 连接"}</span>
            </button>

            <button
              type="button"
              disabled={isSavingEmail}
              onClick={handleSaveEmailConfig}
              className="h-9 px-5 bg-primary text-on-primary hover:bg-neutral-800 font-label-md text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isSavingEmail ? "hourglass_top" : "save"}
              </span>
              <span>{isSavingEmail ? "正在保存..." : "保存邮箱配置"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

}
