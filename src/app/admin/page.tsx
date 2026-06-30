"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen, Zap, CheckCircle, AlertCircle, Clock,
  RefreshCw, Globe, Users, ArrowLeft, Settings,
  Database, Volume2, Send, ChevronRight, KeyRound, ExternalLink,
} from "lucide-react";
import { LEARNING_LANGUAGES } from "@/data/learningLanguages";
import { useUser } from "@/hooks/useUser";

const ADMIN_EMAIL = "erin20080306@gmail.com";

interface ArticleStatus {
  language: string;
  flag: string;
  zhName: string;
  status: "published" | "ready" | "draft" | "missing";
  title?: string;
  sentenceCount?: number;
  audioCount?: number;
}

interface SystemStatus {
  supabase: "ok" | "error" | "checking";
  openai: "ok" | "error" | "checking";
}

export default function AdminPage() {
  const router = useRouter();
  const { user, ready } = useUser({ requireOnboarded: true });

  const [articleStatuses, setArticleStatuses] = useState<ArticleStatus[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ supabase: "checking", openai: "checking" });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [log, setLog] = useState<{ msg: string; type: "ok" | "error" | "info" }[]>([]);
  const [articleLoading, setArticleLoading] = useState(true);
  const [envVars, setEnvVars] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user || user.email !== ADMIN_EMAIL) {
      router.replace("/dashboard");
      return;
    }
    checkSystem();
    loadArticleStatuses();
    checkEnvVars();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  async function checkEnvVars() {
    try {
      const res = await fetch("/api/env-check");
      if (res.ok) {
        const data = await res.json();
        setEnvVars(data.vars);
      }
    } catch {
      setEnvVars(null);
    }
  }

  function addLog(msg: string, type: "ok" | "error" | "info" = "info") {
    setLog((prev) => [{ msg: `${new Date().toLocaleTimeString()} ${msg}`, type }, ...prev.slice(0, 19)]);
  }

  async function checkSystem() {
    setSystemStatus({ supabase: "checking", openai: "checking" });
    try {
      const res = await fetch("/api/articles/today?language=en");
      setSystemStatus((s) => ({ ...s, supabase: res.status !== 500 ? "ok" : "error" }));
    } catch {
      setSystemStatus((s) => ({ ...s, supabase: "error" }));
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "test", voice: "nova" }),
      });
      setSystemStatus((s) => ({ ...s, openai: res.ok ? "ok" : "error" }));
    } catch {
      setSystemStatus((s) => ({ ...s, openai: "error" }));
    }
  }

  async function loadArticleStatuses() {
    setArticleLoading(true);
    const statuses: ArticleStatus[] = [];
    for (const lang of LEARNING_LANGUAGES) {
      try {
        const res = await fetch(`/api/articles/today?language=${lang.code}`);
        if (res.ok) {
          const data = await res.json();
          statuses.push({
            language: lang.code,
            flag: lang.flag,
            zhName: lang.zhName,
            status: "published",
            title: data.title,
            sentenceCount: data.sentences?.length ?? 0,
            audioCount: data.sentences?.filter((s: { audio_url?: string }) => s.audio_url).length ?? 0,
          });
        } else {
          statuses.push({ language: lang.code, flag: lang.flag, zhName: lang.zhName, status: "missing" });
        }
      } catch {
        statuses.push({ language: lang.code, flag: lang.flag, zhName: lang.zhName, status: "missing" });
      }
    }
    setArticleStatuses(statuses);
    setArticleLoading(false);
  }

  async function runGenerate() {
    setLoadingAction("generate");
    addLog("開始生成今日文章...", "info");
    try {
      const res = await fetch("/api/articles/generate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog(`✅ 文章生成完成：${JSON.stringify(data).slice(0, 80)}`, "ok");
      } else {
        addLog(`❌ 生成失敗：${data.error || "未知錯誤"}`, "error");
      }
    } catch (e) {
      addLog(`❌ 生成錯誤：${e instanceof Error ? e.message : String(e)}`, "error");
    }
    setLoadingAction(null);
    await loadArticleStatuses();
  }

  async function runPrewarm() {
    setLoadingAction("prewarm");
    addLog("開始預熱音檔...", "info");
    try {
      const res = await fetch("/api/articles/prewarm", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog(`✅ 預熱完成：${JSON.stringify(data).slice(0, 80)}`, "ok");
      } else {
        addLog(`❌ 預熱失敗：${data.error || "未知錯誤"}`, "error");
      }
    } catch (e) {
      addLog(`❌ 預熱錯誤：${e instanceof Error ? e.message : String(e)}`, "error");
    }
    setLoadingAction(null);
    await loadArticleStatuses();
  }

  async function runPublish() {
    setLoadingAction("publish");
    addLog("開始發布文章...", "info");
    try {
      const res = await fetch("/api/articles/publish", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addLog(`✅ 發布成功：${JSON.stringify(data).slice(0, 80)}`, "ok");
      } else {
        addLog(`❌ 發布失敗：${data.error || "未知錯誤"}`, "error");
      }
    } catch (e) {
      addLog(`❌ 發布錯誤：${e instanceof Error ? e.message : String(e)}`, "error");
    }
    setLoadingAction(null);
    await loadArticleStatuses();
  }

  async function runFullPipeline() {
    setLoadingAction("pipeline");
    addLog("=== 一鍵建立今日文章（生成 + 預熱 + 發布）===", "info");
    try {
      const res = await fetch("/api/articles/daily-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prewarm: true, includeAudio: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.skipped) {
          addLog(`ℹ️ 今日文章已存在，跳過生成`, "info");
        } else {
          addLog(`✅ 成功建立 ${data.articlesCreated}/5 篇文章，主題：${data.topic}`, "ok");
          if (data.prewarm?.results?.length) {
            const audioReady = data.prewarm.results.reduce(
              (sum: number, item: { audioCreated?: number; audioCached?: number }) =>
                sum + (item.audioCreated ?? 0) + (item.audioCached ?? 0),
              0
            );
            addLog(`✅ 預熱完成：${data.prewarm.results.length} 篇，音檔 ${audioReady} 筆`, "ok");
          }
          data.results?.forEach((r: { lang: string; success: boolean; title?: string; error?: string }) => {
            addLog(`  ${r.success ? "✅" : "❌"} ${r.lang}: ${r.title ?? r.error}`, r.success ? "ok" : "error");
          });
        }
      } else {
        addLog(`❌ 建立失敗：${data.error}`, "error");
      }
    } catch (e) {
      addLog(`❌ ${e instanceof Error ? e.message : String(e)}`, "error");
    }
    setLoadingAction(null);
    await loadArticleStatuses();
  }

  async function runGenerateOnly() {
    addLog("生成文章中...", "info");
    try {
      const res = await fetch("/api/articles/daily-create", { method: "POST" });
      const data = await res.json();
      addLog(res.ok ? `✅ ${data.skipped ? "已存在" : `生成成功（${data.articlesCreated} 篇）`}` : `❌ 失敗：${data.error}`, res.ok ? "ok" : "error");
    } catch (e) { addLog(`❌ ${e instanceof Error ? e.message : String(e)}`, "error"); }
  }

  async function runPrewarmOnly() {
    addLog("預熱音檔...", "info");
    try {
      const res = await fetch("/api/articles/prewarm", { method: "POST" });
      const data = await res.json();
      addLog(res.ok ? `✅ 預熱成功` : `❌ 預熱失敗：${data.error}`, res.ok ? "ok" : "error");
    } catch (e) { addLog(`❌ ${e instanceof Error ? e.message : String(e)}`, "error"); }
  }

  async function runPublishOnly() {
    addLog("重新發布...", "info");
    try {
      const res = await fetch("/api/articles/daily-create", { method: "POST" });
      const data = await res.json();
      addLog(res.ok ? `✅ 完成` : `❌ 失敗：${data.error}`, res.ok ? "ok" : "error");
    } catch (e) { addLog(`❌ ${e instanceof Error ? e.message : String(e)}`, "error"); }
  }

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lilacDeep" />
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) return null;

  const statusColor = {
    ok: "text-mintDeep bg-mintLight",
    error: "text-peachDeep bg-peachLight",
    checking: "text-inkSoft bg-sand",
  };

  const statusIcon = {
    ok: <CheckCircle size={14} />,
    error: <AlertCircle size={14} />,
    checking: <RefreshCw size={14} className="animate-spin" />,
  };

  const articleStatusColor = {
    published: "border-mintDeep bg-mintLight/30 text-mintDeep",
    ready: "border-sky bg-sky/20 text-skyDeep",
    draft: "border-sand bg-sand/50 text-inkSoft",
    missing: "border-peachDeep bg-peachLight/30 text-peachDeep",
  };

  const articleStatusLabel = {
    published: "已發布",
    ready: "待發布",
    draft: "草稿",
    missing: "未生成",
  };

  return (
    <div className="min-h-screen bg-cream pb-10">
      {/* Header */}
      <div className="bg-lilacDeep text-white p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition">
            <ArrowLeft size={20} />
          </button>
          <Settings size={20} />
          <h1 className="text-lg font-extrabold flex-1">管理後台</h1>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{user.email}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Env Vars Status – show warning if any missing */}
        {envVars && Object.values(envVars).some((v) => !v) && (
          <div className="bg-peachLight border-2 border-peachDeep rounded-2xl p-4">
            <p className="font-extrabold text-peachDeep flex items-center gap-2 mb-2"><KeyRound size={16} /> 環境變數未設定</p>
            <div className="space-y-1.5 mb-3">
              {Object.entries(envVars).map(([key, set]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  {set
                    ? <CheckCircle size={14} className="text-mintDeep flex-shrink-0" />
                    : <AlertCircle size={14} className="text-peachDeep flex-shrink-0" />}
                  <span className={`font-mono ${set ? "text-mintDeep" : "text-peachDeep font-bold"}`}>{key}</span>
                  {!set && <span className="text-peachDeep">← 未設定</span>}
                </div>
              ))}
            </div>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-peachDeep px-3 py-2 rounded-xl active:scale-95 transition"
            >
              <ExternalLink size={13} /> 前往 Vercel → Settings → Environment Variables
            </a>
            <p className="text-xs text-peachDeep mt-2">設定完成後需重新部署才生效。</p>
          </div>
        )}

        {/* System Status */}
        <div className="bg-white rounded-2xl p-4 shadow-softer">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-ink flex items-center gap-2"><Database size={16} /> 系統狀態</p>
            <button onClick={() => { checkSystem(); checkEnvVars(); }} className="text-xs text-lilacDeep flex items-center gap-1 hover:underline">
              <RefreshCw size={12} /> 重新檢查
            </button>
          </div>
          <div className="flex gap-3">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusColor[systemStatus.supabase]}`}>
              {statusIcon[systemStatus.supabase]} Supabase
            </span>
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusColor[systemStatus.openai]}`}>
              {statusIcon[systemStatus.openai]} OpenAI TTS
            </span>
          </div>
        </div>

        {/* Today Article Status */}
        <div className="bg-white rounded-2xl p-4 shadow-softer">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-ink flex items-center gap-2"><BookOpen size={16} /> 今日文章狀態</p>
            <button onClick={loadArticleStatuses} className="text-xs text-lilacDeep flex items-center gap-1 hover:underline">
              <RefreshCw size={12} className={articleLoading ? "animate-spin" : ""} /> 重新整理
            </button>
          </div>
          <div className="space-y-2">
            {articleLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lilacDeep" />
              </div>
            ) : articleStatuses.map((s) => (
              <motion.div
                key={s.language}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 ${articleStatusColor[s.status]}`}
              >
                <span className="text-xl">{s.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-ink truncate">
                    {s.title ?? `${s.zhName} — 尚無文章`}
                  </p>
                  {s.status === "published" && (
                    <p className="text-xs text-inkSoft">
                      {s.sentenceCount} 句 · {s.audioCount}/{s.sentenceCount} 音檔
                    </p>
                  )}
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/60">
                  {articleStatusLabel[s.status]}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-4 shadow-softer">
          <p className="font-extrabold text-ink mb-3 flex items-center gap-2"><Zap size={16} /> 快速操作</p>

          {/* Full pipeline */}
          <button
            onClick={runFullPipeline}
            disabled={loadingAction !== null}
            className="w-full mb-3 py-3 rounded-xl bg-lilacDeep text-white font-extrabold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition"
          >
            {loadingAction === "pipeline" ? (
              <><RefreshCw size={18} className="animate-spin" /> 執行中...</>
            ) : (
              <><Send size={18} /> 一鍵完整流程（生成 → 預熱 → 發布）</>
            )}
          </button>

          {/* Individual actions */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={runGenerate}
              disabled={loadingAction !== null}
              className="py-3 rounded-xl bg-sky/20 text-skyDeep font-bold text-sm flex flex-col items-center gap-1 disabled:opacity-50 active:scale-95 transition"
            >
              {loadingAction === "generate"
                ? <RefreshCw size={18} className="animate-spin" />
                : <Globe size={18} />}
              <span>生成文章</span>
            </button>
            <button
              onClick={runPrewarm}
              disabled={loadingAction !== null}
              className="py-3 rounded-xl bg-peachLight text-peachDeep font-bold text-sm flex flex-col items-center gap-1 disabled:opacity-50 active:scale-95 transition"
            >
              {loadingAction === "prewarm"
                ? <RefreshCw size={18} className="animate-spin" />
                : <Volume2 size={18} />}
              <span>預熱音檔</span>
            </button>
            <button
              onClick={runPublish}
              disabled={loadingAction !== null}
              className="py-3 rounded-xl bg-mintLight text-mintDeep font-bold text-sm flex flex-col items-center gap-1 disabled:opacity-50 active:scale-95 transition"
            >
              {loadingAction === "publish"
                ? <RefreshCw size={18} className="animate-spin" />
                : <CheckCircle size={18} />}
              <span>發布文章</span>
            </button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl p-4 shadow-softer">
          <p className="font-extrabold text-ink mb-3 flex items-center gap-2"><ChevronRight size={16} /> 快速連結</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push("/reading")}
              className="py-3 px-4 rounded-xl bg-lilacLight text-lilacDeep font-bold text-sm text-left flex items-center gap-2 active:scale-95 transition"
            >
              <BookOpen size={16} /> 預覽今日文章
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="py-3 px-4 rounded-xl bg-sand text-inkSoft font-bold text-sm text-left flex items-center gap-2 active:scale-95 transition"
            >
              <Users size={16} /> 返回 Dashboard
            </button>
            <button
              onClick={() => window.open("https://supabase.com/dashboard", "_blank")}
              className="py-3 px-4 rounded-xl bg-sand text-inkSoft font-bold text-sm text-left flex items-center gap-2 active:scale-95 transition"
            >
              <Database size={16} /> Supabase 後台
            </button>
            <button
              onClick={() => window.open("https://platform.openai.com", "_blank")}
              className="py-3 px-4 rounded-xl bg-sand text-inkSoft font-bold text-sm text-left flex items-center gap-2 active:scale-95 transition"
            >
              <Zap size={16} /> OpenAI 後台
            </button>
          </div>
        </div>

        {/* Action Log */}
        {log.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-softer">
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold text-ink flex items-center gap-2"><Clock size={16} /> 操作記錄</p>
              <button onClick={() => setLog([])} className="text-xs text-inkSoft hover:underline">清除</button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {log.map((l, i) => (
                <p key={i} className={`text-xs font-mono px-2 py-1 rounded ${
                  l.type === "ok" ? "bg-mintLight text-mintDeep" :
                  l.type === "error" ? "bg-peachLight text-peachDeep" :
                  "bg-sand text-inkSoft"
                }`}>
                  {l.msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <p className="text-center text-xs text-inkSoft">
          管理後台 · 僅限 {ADMIN_EMAIL}
        </p>
      </div>
    </div>
  );
}
