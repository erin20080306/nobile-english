"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen, Zap, CheckCircle, AlertCircle, Clock,
  RefreshCw, Globe, Users, ArrowLeft, Settings,
  Database, Volume2, Send, ChevronRight, KeyRound, ExternalLink,
  Cpu, BarChart3, Cloud, ChevronDown,
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
}

interface TtsProviderStatus {
  active: "gemini" | "google" | "polly" | "stub";
  override: "gemini" | "google" | "polly" | null;
  geminiConfigured: boolean;
  googleConfigured: boolean;
  pollyConfigured: boolean;
}

interface GeminiModelStatus {
  active: string;
  defaultModel: string;
  fallbackModel: string;
  override: string | null;
  supportedModels: readonly string[];
}

interface ApiUsageEntry {
  apiName: string;
  today: number;
  last7Days: number;
  last30Days: number;
}

interface AdminSubscriptionStats {
  appUsers: {
    total: number;
    activeToday: number;
    activeThirtyDays: number;
  };
  subscribers: {
    total: number;
    storeOrProfile: number;
    paypal: number;
  };
  promoTrials?: {
    available: boolean;
    error?: string;
    total: number;
    active: number;
    expired: number;
    redemptions: Array<{
      id: string;
      promoCode: string;
      userId: string;
      userEmail: string;
      status: string;
      startsAt: string | null;
      expiresAt: string | null;
      trialDays: number;
      maxFeatureUses: number;
      redeemedSlot: number;
      createdAt: string | null;
      daysLeft: number;
      isActive: boolean;
      todayUsage: {
        total: number;
        features: Array<{ featureKey: string; usedCount: number }>;
      };
    }>;
  };
  cloudSync?: {
    users: number;
    dataRows: number;
    learningRecords: number;
    learningRecordsByType?: Array<{ type: string; count: number }>;
    latestUpdatedAt: string | null;
  };
  googleActivity?: {
    pageActivityAvailable: boolean;
    error?: string;
    users: Array<{
      userId: string;
      email: string;
      name: string | null;
      firstSeenAt: string | null;
      lastSeenAt: string | null;
      totalPageVisits: number;
      pages: Array<{
        path: string;
        title: string | null;
        visitCount: number;
        firstSeenAt: string | null;
        lastSeenAt: string | null;
      }>;
    }>;
  };
}

function apiRequestUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const origin = window.location.origin;
  return /^https?:\/\//.test(origin) ? `${origin}${normalizedPath}` : normalizedPath;
}

async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiRequestUrl(path), {
    ...init,
    credentials: init?.credentials ?? "same-origin",
  });
}

async function readApiJson<T = Record<string, unknown>>(response: Response): Promise<T & { error?: string }> {
  const text = await response.text();
  if (!text) return {} as T & { error?: string };
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return {
      error: `伺服器回傳格式異常（HTTP ${response.status}）。可能是請求逾時，請再按一次或查看 Vercel Logs。`,
    } as T & { error?: string };
  }
}

function formatAdminDate(value?: string | null): string {
  if (!value) return "尚無";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚無";
  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function learningRecordTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    scene: "場景",
    dialogue: "對話",
    exam: "測驗",
    custom: "自訂",
    word: "單字",
    reading_article: "每日文章",
    grammar: "文法",
  };
  return labels[type] || type;
}

function promoTrialFeatureLabel(type: string): string {
  const labels: Record<string, string> = {
    dialoguePractice: "對話",
    scenePractice: "場景",
    wordReview: "單字",
    grammarPractice: "文法",
    readingArticle: "每日文章",
    gardenDailyBonus: "農場補給",
    gardenPurchase: "農場商店",
    customScene: "自訂場景",
  };
  return labels[type] || type;
}

function promoTrialStatusLabel(status: string, isActive: boolean): string {
  if (isActive) return "有效中";
  if (status === "expired") return "已到期";
  if (status === "cancelled") return "已取消";
  return status === "active" ? "已到期" : status;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, ready } = useUser({ requireOnboarded: true });

  const [articleStatuses, setArticleStatuses] = useState<ArticleStatus[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ supabase: "checking" });
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [log, setLog] = useState<{ msg: string; type: "ok" | "error" | "info" }[]>([]);
  const [articleLoading, setArticleLoading] = useState(true);
  const [envVars, setEnvVars] = useState<Record<string, boolean> | null>(null);
  const [ttsProviderStatus, setTtsProviderStatus] = useState<TtsProviderStatus | null>(null);
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [geminiModelStatus, setGeminiModelStatus] = useState<GeminiModelStatus | null>(null);
  const [switchingModel, setSwitchingModel] = useState(false);
  const [apiUsage, setApiUsage] = useState<ApiUsageEntry[] | null>(null);
  const [apiUsageLoading, setApiUsageLoading] = useState(false);
  const [subscriptionStats, setSubscriptionStats] = useState<AdminSubscriptionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user || user.email !== ADMIN_EMAIL) {
      router.replace("/dashboard");
      return;
    }
    checkSystem();
    loadArticleStatuses();
    checkEnvVars();
    loadTtsProviderStatus();
    loadGeminiModelStatus();
    loadApiUsage();
    loadSubscriptionStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  async function loadGeminiModelStatus() {
    try {
      const res = await fetchApi("/api/admin/gemini-model");
      if (res.ok) setGeminiModelStatus(await readApiJson<GeminiModelStatus>(res));
    } catch {
      setGeminiModelStatus(null);
    }
  }

  async function switchGeminiModel(model: string) {
    setSwitchingModel(true);
    try {
      const res = await fetchApi("/api/admin/gemini-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const data = await readApiJson<GeminiModelStatus>(res);
      if (res.ok) {
        setGeminiModelStatus(data);
        addLog(`✅ Gemini 模型已切換為：${model === "auto" ? "自動（預設）" : model}`, "ok");
      } else {
        addLog(`❌ 切換失敗：${data.error || "未知錯誤"}`, "error");
      }
    } catch (e) {
      addLog(`❌ 切換錯誤：${e instanceof Error ? e.message : String(e)}`, "error");
    }
    setSwitchingModel(false);
  }

  async function loadApiUsage() {
    setApiUsageLoading(true);
    try {
      const res = await fetchApi("/api/admin/api-usage");
      if (res.ok) {
        const data = await readApiJson<{ usage?: ApiUsageEntry[] }>(res);
        setApiUsage(data.usage || []);
      }
    } catch {
      setApiUsage(null);
    }
    setApiUsageLoading(false);
  }

  async function loadTtsProviderStatus() {
    try {
      const res = await fetchApi("/api/admin/tts-provider");
      if (res.ok) setTtsProviderStatus(await readApiJson<TtsProviderStatus>(res));
    } catch {
      setTtsProviderStatus(null);
    }
  }

  async function switchTtsProvider(provider: "gemini" | "google" | "polly" | "auto") {
    setSwitchingProvider(true);
    try {
      const res = await fetchApi("/api/admin/tts-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await readApiJson<TtsProviderStatus>(res);
      if (res.ok) {
        setTtsProviderStatus(data);
        addLog(`✅ AI 語音提供商已切換為：${provider === "auto" ? "自動" : provider}`, "ok");
      } else {
        addLog(`❌ 切換失敗：${data.error || "未知錯誤"}`, "error");
      }
    } catch (e) {
      addLog(`❌ 切換錯誤：${e instanceof Error ? e.message : String(e)}`, "error");
    }
    setSwitchingProvider(false);
  }

  async function checkEnvVars() {
    try {
      const res = await fetchApi("/api/env-check");
      if (res.ok) {
        const data = await readApiJson<{ vars?: Record<string, boolean> }>(res);
        setEnvVars(data.vars || null);
      }
    } catch {
      setEnvVars(null);
    }
  }

  function addLog(msg: string, type: "ok" | "error" | "info" = "info") {
    setLog((prev) => [{ msg: `${new Date().toLocaleTimeString()} ${msg}`, type }, ...prev.slice(0, 19)]);
  }

  async function loadSubscriptionStats() {
    setStatsLoading(true);
    try {
      const res = await fetchApi("/api/admin/subscription-stats", { cache: "no-store" });
      if (res.ok) {
        setSubscriptionStats(await readApiJson<AdminSubscriptionStats>(res));
      } else {
        setSubscriptionStats(null);
      }
    } catch {
      setSubscriptionStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  async function checkSystem() {
    setSystemStatus({ supabase: "checking" });
    try {
      const res = await fetchApi("/api/articles/today?language=en");
      setSystemStatus((s) => ({ ...s, supabase: res.status !== 500 ? "ok" : "error" }));
    } catch {
      setSystemStatus((s) => ({ ...s, supabase: "error" }));
    }
  }

  async function loadArticleStatuses() {
    setArticleLoading(true);
    const statuses: ArticleStatus[] = [];
    for (const lang of LEARNING_LANGUAGES) {
      try {
        const res = await fetchApi(`/api/articles/today?language=${lang.code}`);
        if (res.ok) {
          const data = await readApiJson<{
            title?: string;
            sentences?: Array<{ audio_url?: string }>;
          }>(res);
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
      const res = await fetchApi("/api/articles/daily-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, prewarm: false, includeAudio: false }),
      });
      const data = await readApiJson(res);
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
      const res = await fetchApi("/api/articles/prewarm", { method: "POST" });
      const data = await readApiJson(res);
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
      const res = await fetchApi("/api/articles/publish", { method: "POST" });
      const data = await readApiJson(res);
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
    addLog("=== 一鍵更新今日文章（生成 + 發布）===", "info");
    try {
      const res = await fetchApi("/api/articles/daily-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, prewarm: false, includeAudio: false }),
      });
      const data = await readApiJson<{
        success?: boolean;
        skipped?: boolean;
        articlesCreated?: number;
        topic?: string;
        error?: string;
        results?: Array<{ lang: string; success: boolean; title?: string; error?: string }>;
      }>(res);
      if (res.ok && data.success) {
        if (data.skipped) {
          addLog(`ℹ️ 今日文章已存在，跳過生成`, "info");
        } else {
          addLog(`✅ 成功更新 ${data.articlesCreated}/5 篇文章，主題：${data.topic}`, "ok");
          addLog(`ℹ️ 詞彙與音檔可另外按「預熱音檔」處理`, "info");
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
      const res = await fetchApi("/api/articles/daily-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, prewarm: false, includeAudio: false }),
      });
      const data = await readApiJson<{ skipped?: boolean; articlesCreated?: number; error?: string }>(res);
      addLog(res.ok ? `✅ ${data.skipped ? "已存在" : `生成成功（${data.articlesCreated} 篇）`}` : `❌ 失敗：${data.error}`, res.ok ? "ok" : "error");
    } catch (e) { addLog(`❌ ${e instanceof Error ? e.message : String(e)}`, "error"); }
  }

  async function runPrewarmOnly() {
    addLog("預熱音檔...", "info");
    try {
      const res = await fetchApi("/api/articles/prewarm", { method: "POST" });
      const data = await readApiJson<{ error?: string }>(res);
      addLog(res.ok ? `✅ 預熱成功` : `❌ 預熱失敗：${data.error}`, res.ok ? "ok" : "error");
    } catch (e) { addLog(`❌ ${e instanceof Error ? e.message : String(e)}`, "error"); }
  }

  async function runPublishOnly() {
    addLog("重新發布...", "info");
    try {
      const res = await fetchApi("/api/articles/daily-create", { method: "POST" });
      const data = await readApiJson<{ error?: string }>(res);
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
            <button onClick={() => { checkSystem(); checkEnvVars(); loadSubscriptionStats(); }} className="text-xs text-lilacDeep flex items-center gap-1 hover:underline">
              <RefreshCw size={12} /> 重新檢查
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusColor[systemStatus.supabase]}`}>
              {statusIcon[systemStatus.supabase]} Supabase
            </span>
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusColor[envVars?.GEMINI_API_KEY ? "ok" : "error"]}`}>
              {statusIcon[envVars?.GEMINI_API_KEY ? "ok" : "error"]} Gemini AI／TTS
            </span>
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusColor[envVars?.GNEWS_API_KEY ? "ok" : "error"]}`}>
              {statusIcon[envVars?.GNEWS_API_KEY ? "ok" : "error"]} GNews（時事新聞來源）
            </span>
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${statusColor[envVars?.KOREAN_DICTIONARY_API_KEY ? "ok" : "error"]}`}>
              {statusIcon[envVars?.KOREAN_DICTIONARY_API_KEY ? "ok" : "error"]} Urimal Saem（韓文字典）
            </span>
          </div>
          <p className="text-xs text-inkSoft mt-2">
            AI 文字生成（每日文章、導師回覆）與預設 TTS 已全面改用 Gemini。GNews 用於抓取真實時事新聞當作文章素材，未設定時會改用一般主題。Urimal Saem 用於韓文字典查詢。
          </p>
        </div>

        {/* App Users and Subscribers */}
        <div className="bg-white rounded-2xl p-4 shadow-softer">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-ink flex items-center gap-2"><Users size={16} /> 使用者與訂閱</p>
            <button onClick={loadSubscriptionStats} className="text-xs text-lilacDeep flex items-center gap-1 hover:underline">
              <RefreshCw size={12} className={statsLoading ? "animate-spin" : ""} /> 重新整理
            </button>
          </div>
          {statsLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lilacDeep" />
            </div>
          ) : subscriptionStats ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-lilacLight px-3 py-2">
                  <p className="text-xs font-bold text-lilacDeep">登入 App 使用者</p>
                  <p className="text-2xl font-extrabold text-ink">{subscriptionStats.appUsers.total}</p>
                </div>
                <div className="rounded-xl bg-mintLight px-3 py-2">
                  <p className="text-xs font-bold text-mintDeep">訂閱人數</p>
                  <p className="text-2xl font-extrabold text-ink">{subscriptionStats.subscribers.total}</p>
                </div>
                <div className="rounded-xl bg-sand px-3 py-2">
                  <p className="text-xs font-bold text-inkSoft">今日活躍</p>
                  <p className="text-lg font-extrabold text-ink">{subscriptionStats.appUsers.activeToday}</p>
                </div>
                <div className="rounded-xl bg-sand px-3 py-2">
                  <p className="text-xs font-bold text-inkSoft">30 天活躍</p>
                  <p className="text-lg font-extrabold text-ink">{subscriptionStats.appUsers.activeThirtyDays}</p>
                </div>
                <div className="rounded-xl bg-sand px-3 py-2">
                  <p className="text-xs font-bold text-inkSoft">PayPal 訂閱</p>
                  <p className="text-lg font-extrabold text-ink">{subscriptionStats.subscribers.paypal}</p>
                </div>
                <div className="rounded-xl bg-sand px-3 py-2">
                  <p className="text-xs font-bold text-inkSoft">商店/Profile</p>
                  <p className="text-lg font-extrabold text-ink">{subscriptionStats.subscribers.storeOrProfile}</p>
                </div>
                <div className="rounded-xl bg-lilacLight px-3 py-2">
                  <p className="text-xs font-bold text-lilacDeep">30 天試用</p>
                  <p className="text-lg font-extrabold text-ink">{subscriptionStats.promoTrials?.total ?? 0}</p>
                </div>
                <div className="rounded-xl bg-mintLight px-3 py-2">
                  <p className="text-xs font-bold text-mintDeep">優惠有效中</p>
                  <p className="text-lg font-extrabold text-ink">{subscriptionStats.promoTrials?.active ?? 0}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatsExpanded((value) => !value)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-lilacLight px-3 py-2 text-xs font-extrabold text-lilacDeep active:scale-[0.98] transition"
              >
                {statsExpanded ? "收合詳細紀錄" : "展開詳細紀錄"}
                <ChevronDown size={14} className={`transition ${statsExpanded ? "rotate-180" : ""}`} />
              </button>
              {statsExpanded && subscriptionStats.cloudSync && (
                <div className="mt-3 rounded-xl bg-cream px-3 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-ink">
                    <Cloud size={14} className="text-lilacDeep" /> 帳號雲端同步
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white px-2 py-2">
                      <p className="text-[10px] font-bold text-inkSoft">同步帳號</p>
                      <p className="text-lg font-extrabold text-ink">{subscriptionStats.cloudSync.users}</p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2">
                      <p className="text-[10px] font-bold text-inkSoft">App 資料列</p>
                      <p className="text-lg font-extrabold text-ink">{subscriptionStats.cloudSync.dataRows}</p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2">
                      <p className="text-[10px] font-bold text-inkSoft">學習紀錄</p>
                      <p className="text-lg font-extrabold text-ink">{subscriptionStats.cloudSync.learningRecords}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-bold text-inkSoft">
                    最近同步：{formatAdminDate(subscriptionStats.cloudSync.latestUpdatedAt)}
                  </p>
                  {subscriptionStats.cloudSync.learningRecordsByType?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {subscriptionStats.cloudSync.learningRecordsByType.map((item) => (
                        <span key={item.type} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-inkSoft">
                          {learningRecordTypeLabel(item.type)} {item.count}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
              {statsExpanded && subscriptionStats.promoTrials && (
                <div className="mt-3 rounded-xl bg-cream px-3 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-ink">
                    <KeyRound size={14} className="text-lilacDeep" /> 30 天優惠碼兌換
                  </p>
                  {!subscriptionStats.promoTrials.available && (
                    <p className="mb-2 rounded-xl bg-peachLight px-2 py-2 text-xs font-bold text-peachDeep">
                      尚未建立優惠碼資料表：{subscriptionStats.promoTrials.error || "請執行 promo trial migration"}
                    </p>
                  )}
                  {subscriptionStats.promoTrials.redemptions.length ? (
                    <div className="space-y-2">
                      {subscriptionStats.promoTrials.redemptions.map((redemption) => (
                        <div key={redemption.id || redemption.userId} className="rounded-xl bg-white px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-extrabold text-ink">
                                {redemption.userEmail || redemption.userId || "未知帳號"}
                              </p>
                              <p className="text-[10px] font-bold text-inkSoft">
                                兌換：{formatAdminDate(redemption.createdAt)} · 到期：{formatAdminDate(redemption.expiresAt)}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold ${
                              redemption.isActive ? "bg-mintLight text-mintDeep" : "bg-sand text-inkSoft"
                            }`}>
                              {promoTrialStatusLabel(redemption.status, redemption.isActive)}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-1.5">
                            <div className="rounded-lg bg-cream px-2 py-1">
                              <p className="text-[10px] font-bold text-inkSoft">名額</p>
                              <p className="text-xs font-extrabold text-ink">#{redemption.redeemedSlot || "-"}</p>
                            </div>
                            <div className="rounded-lg bg-cream px-2 py-1">
                              <p className="text-[10px] font-bold text-inkSoft">剩餘</p>
                              <p className="text-xs font-extrabold text-ink">{redemption.daysLeft} 天</p>
                            </div>
                            <div className="rounded-lg bg-cream px-2 py-1">
                              <p className="text-[10px] font-bold text-inkSoft">今日使用</p>
                              <p className="text-xs font-extrabold text-ink">{redemption.todayUsage.total} 次</p>
                            </div>
                          </div>
                          {redemption.todayUsage.features.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {redemption.todayUsage.features.map((feature) => (
                                <span
                                  key={`${redemption.id}:${feature.featureKey}`}
                                  className="rounded-full bg-lilacLight px-2 py-1 text-[10px] font-extrabold text-lilacDeep"
                                >
                                  {promoTrialFeatureLabel(feature.featureKey)} {feature.usedCount}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-[10px] font-bold text-inkSoft">今天尚未使用優惠試用額度。</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-inkSoft">目前沒有人兌換 30 天優惠碼。</p>
                  )}
                </div>
              )}
              {statsExpanded && subscriptionStats.googleActivity && (
                <div className="mt-3 rounded-xl bg-cream px-3 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-ink">
                    <Users size={14} className="text-lilacDeep" /> 其他 Google 帳號活動
                  </p>
                  {!subscriptionStats.googleActivity.pageActivityAvailable && (
                    <p className="mb-2 rounded-xl bg-peachLight px-2 py-2 text-xs font-bold text-peachDeep">
                      尚未建立頁面活動表：{subscriptionStats.googleActivity.error || "請執行 app_user_page_activity migration"}
                    </p>
                  )}
                  {subscriptionStats.googleActivity.users.length ? (
                    <div className="space-y-2">
                      {subscriptionStats.googleActivity.users.map((activity) => (
                        <div key={activity.email} className="rounded-xl bg-white px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-extrabold text-ink">{activity.email}</p>
                              <p className="text-[10px] font-bold text-inkSoft">
                                首次：{formatAdminDate(activity.firstSeenAt)} · 最後：{formatAdminDate(activity.lastSeenAt)}
                              </p>
                            </div>
                            <span className="rounded-full bg-lilacLight px-2 py-1 text-[10px] font-extrabold text-lilacDeep">
                              {activity.totalPageVisits} 次
                            </span>
                          </div>
                          {activity.pages.length ? (
                            <div className="mt-2 space-y-1">
                              {activity.pages.slice(0, 4).map((page) => (
                                <div key={`${activity.email}:${page.path}`} className="flex items-center gap-2 rounded-lg bg-cream px-2 py-1">
                                  <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-inkSoft">
                                    {page.path}
                                  </span>
                                  <span className="text-[10px] font-extrabold text-ink">{page.visitCount} 次</span>
                                  <span className="text-[10px] font-bold text-inkSoft">{formatAdminDate(page.lastSeenAt)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-[10px] font-bold text-inkSoft">已有 Google 登入紀錄，尚無頁面活動紀錄。</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-inkSoft">目前沒有其他 Google 帳號活動。</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-peachDeep">無法讀取統計資料，請確認 Supabase migration 已執行。</p>
          )}
        </div>

        {/* AI Voice Provider */}
        <div className="bg-white rounded-2xl p-4 shadow-softer">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-ink flex items-center gap-2"><Volume2 size={16} /> AI 語音提供商</p>
            <button onClick={loadTtsProviderStatus} className="text-xs text-lilacDeep flex items-center gap-1 hover:underline">
              <RefreshCw size={12} /> 重新整理
            </button>
          </div>
          {ttsProviderStatus ? (
            <>
              <p className="text-sm text-inkSoft mb-3">
                目前使用：<span className="font-bold text-ink">
                  {ttsProviderStatus.active === "gemini" ? "Gemini TTS" : ttsProviderStatus.active === "google" ? "Google TTS（便宜）" : ttsProviderStatus.active === "polly" ? "Amazon Polly（便宜）" : "尚未設定，暫用系統語音"}
                </span>
                {ttsProviderStatus.override && <span className="ml-1 text-xs text-lilacDeep">（手動指定）</span>}
              </p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => switchTtsProvider("auto")}
                  disabled={switchingProvider}
                  className={`py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 active:scale-95 transition ${
                    !ttsProviderStatus.override ? "bg-lilacDeep text-white" : "bg-sand text-inkSoft"
                  }`}
                >
                  自動（推薦）
                </button>
                <button
                  onClick={() => switchTtsProvider("gemini")}
                  disabled={switchingProvider || !ttsProviderStatus.geminiConfigured}
                  className={`py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 active:scale-95 transition ${
                    ttsProviderStatus.override === "gemini" ? "bg-lilacDeep text-white" : "bg-sand text-inkSoft"
                  }`}
                  title={ttsProviderStatus.geminiConfigured ? "" : "尚未設定 GEMINI_API_KEY"}
                >
                  Gemini
                </button>
                <button
                  onClick={() => switchTtsProvider("google")}
                  disabled={switchingProvider || !ttsProviderStatus.googleConfigured}
                  className={`py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 active:scale-95 transition ${
                    ttsProviderStatus.override === "google" ? "bg-lilacDeep text-white" : "bg-sand text-inkSoft"
                  }`}
                  title={ttsProviderStatus.googleConfigured ? "" : "尚未設定 GOOGLE_TTS_API_KEY"}
                >
                  Google TTS
                </button>
                <button
                  onClick={() => switchTtsProvider("polly")}
                  disabled={switchingProvider || !ttsProviderStatus.pollyConfigured}
                  className={`py-2.5 rounded-xl font-bold text-xs disabled:opacity-40 active:scale-95 transition ${
                    ttsProviderStatus.override === "polly" ? "bg-lilacDeep text-white" : "bg-sand text-inkSoft"
                  }`}
                  title={ttsProviderStatus.pollyConfigured ? "" : "尚未設定 AWS 金鑰"}
                >
                  Amazon Polly
                </button>
              </div>
              <p className="text-xs text-inkSoft mt-2">
                此設定套用於 AI 導師語音與每日文章朗讀。
              </p>
            </>
          ) : (
            <p className="text-sm text-inkSoft">載入中...</p>
          )}
        </div>

        {/* Gemini Model Switcher */}
        <div className="bg-white rounded-2xl p-4 shadow-softer">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-ink flex items-center gap-2"><Cpu size={16} /> AI 模型管理</p>
            <button onClick={loadGeminiModelStatus} className="text-xs text-lilacDeep flex items-center gap-1 hover:underline">
              <RefreshCw size={12} /> 重新整理
            </button>
          </div>
          {geminiModelStatus ? (
            <>
              <p className="text-sm text-inkSoft mb-1">
                目前使用：<span className="font-bold text-ink font-mono">{geminiModelStatus.active}</span>
                {geminiModelStatus.override && <span className="ml-1 text-xs text-lilacDeep">（手動指定）</span>}
              </p>
              <p className="text-xs text-inkSoft mb-3">
                預設模型：<span className="font-mono">{geminiModelStatus.defaultModel}</span>
                {" "}· 超量自動改用：<span className="font-mono">{geminiModelStatus.fallbackModel}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => switchGeminiModel("auto")}
                  disabled={switchingModel}
                  className={`py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 active:scale-95 transition ${
                    !geminiModelStatus.override ? "bg-lilacDeep text-white" : "bg-sand text-inkSoft"
                  }`}
                >
                  自動（預設 + 超量 fallback）
                </button>
                {geminiModelStatus.supportedModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => switchGeminiModel(m)}
                    disabled={switchingModel}
                    className={`py-2.5 rounded-xl font-bold text-xs font-mono disabled:opacity-50 active:scale-95 transition ${
                      geminiModelStatus.override === m ? "bg-lilacDeep text-white" : "bg-sand text-inkSoft"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-xs text-inkSoft mt-2">
                此設定套用於 AI 導師回覆、每日文章生成與字典 AI 查詢。當主要模型遇到超量（quota）或流量限制時，系統會自動改用較便宜的 fallback 模型重試一次；也可以在這裡手動固定指定某個模型。
              </p>
            </>
          ) : (
            <p className="text-sm text-inkSoft">載入中...</p>
          )}
        </div>

        {/* API Call Usage */}
        <div className="bg-white rounded-2xl p-4 shadow-softer">
          <div className="flex items-center justify-between mb-3">
            <p className="font-extrabold text-ink flex items-center gap-2"><BarChart3 size={16} /> API 呼叫次數</p>
            <button onClick={loadApiUsage} className="text-xs text-lilacDeep flex items-center gap-1 hover:underline">
              <RefreshCw size={12} className={apiUsageLoading ? "animate-spin" : ""} /> 重新整理
            </button>
          </div>
          {apiUsageLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lilacDeep" />
            </div>
          ) : apiUsage && apiUsage.length > 0 ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-2 px-2 text-xs font-bold text-inkSoft">
                <span className="col-span-2">API</span>
                <span className="text-right">今日</span>
                <span className="text-right">近30天</span>
              </div>
              {apiUsage.map((entry) => (
                <div key={entry.apiName} className="grid grid-cols-4 gap-2 items-center bg-cream rounded-xl px-2 py-2">
                  <span className="col-span-2 text-xs font-mono text-ink truncate">{entry.apiName}</span>
                  <span className="text-right text-sm font-bold text-ink">{entry.today}</span>
                  <span className="text-right text-sm font-bold text-lilacDeep">{entry.last30Days}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-inkSoft">尚無呼叫紀錄，或資料庫遷移尚未套用（api_usage_counters）。</p>
          )}
          <p className="text-xs text-inkSoft mt-2">
            涵蓋 Gemini（依模型分別統計）、Google TTS、Amazon Polly 的呼叫次數，可用於觀察是否接近付費額度。
          </p>
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
              <><Send size={18} /> 一鍵更新今日文章（生成 → 發布）</>
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
              <span>重新生成</span>
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
              onClick={() => window.open("https://aistudio.google.com", "_blank")}
              className="py-3 px-4 rounded-xl bg-sand text-inkSoft font-bold text-sm text-left flex items-center gap-2 active:scale-95 transition"
            >
              <Zap size={16} /> Gemini / Google 後台
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
