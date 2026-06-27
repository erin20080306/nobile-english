"use client";

import { useMemo, useState } from "react";
import { Bug, Download, Mail, Send, Upload } from "lucide-react";
import { authService } from "@/services/authService";
import { storageService, KEYS } from "@/services/storageService";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

const FEEDBACK_EMAIL = "erin20080306@gmail.com";

type FeedbackCategory = "錯誤" | "語音" | "對話" | "測驗" | "單字" | "建議";

interface FeedbackReport {
  id: string;
  category: FeedbackCategory;
  title: string;
  message: string;
  contactEmail: string;
  attachedFile?: { name: string; size: number; type: string; preview: string };
  diagnostics: ReturnType<typeof collectDiagnostics>;
  createdAt: string;
}

function collectDiagnostics() {
  const user = authService.getCurrentUser();
  const device = authService.getDeviceInfo(user);
  const records = storageService.get<unknown[]>(KEYS.records, []);
  const examResults = storageService.get<unknown[]>(KEYS.examResults, []);
  const wrongQuestions = storageService.get<unknown[]>(KEYS.wrongQuestions, []);
  const savedWords = storageService.get<unknown[]>(KEYS.savedWords, []);
  const savedSentences = storageService.get<unknown[]>(KEYS.savedSentences, []);

  return {
    at: new Date().toISOString(),
    url: typeof window === "undefined" ? "" : window.location.href,
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    app: "Mobile English",
    account: user
      ? {
          email: user.email,
          provider: user.provider || "local",
          level: user.level,
          cefrLevel: user.cefrLevel,
          activeProfileId: user.activeProfileId || "",
        }
      : null,
    device: {
      name: device.currentDeviceName,
      shortId: device.shortId,
      boundHere: device.isBoundHere,
      maxDevices: device.maxDevices,
    },
    counts: {
      records: records.length,
      examResults: examResults.length,
      wrongQuestions: wrongQuestions.length,
      savedWords: savedWords.length,
      savedSentences: savedSentences.length,
    },
  };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FeedbackPage() {
  const user = useMemo(() => authService.getCurrentUser(), []);
  const [category, setCategory] = useState<FeedbackCategory>("錯誤");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email || FEEDBACK_EMAIL);
  const [fileInfo, setFileInfo] = useState<FeedbackReport["attachedFile"]>();
  const [sent, setSent] = useState("");

  const diagnostics = useMemo(() => collectDiagnostics(), []);

  async function onFile(file?: File) {
    if (!file) {
      setFileInfo(undefined);
      return;
    }
    let preview = "";
    if (/^(text|application\/json)/.test(file.type) || /\.(log|txt|json)$/i.test(file.name)) {
      preview = (await file.text()).slice(0, 20000);
    }
    setFileInfo({ name: file.name, size: file.size, type: file.type || "unknown", preview });
  }

  function buildReport(): FeedbackReport {
    return {
      id: Math.random().toString(36).slice(2),
      category,
      title: title.trim() || "Mobile English 意見回饋",
      message: message.trim(),
      contactEmail: contactEmail.trim() || FEEDBACK_EMAIL,
      attachedFile: fileInfo,
      diagnostics,
      createdAt: new Date().toISOString(),
    };
  }

  function saveReport(report: FeedbackReport) {
    const reports = storageService.get<FeedbackReport[]>(KEYS.feedbackReports, []);
    storageService.set(KEYS.feedbackReports, [report, ...reports].slice(0, 20));
  }

  function submit() {
    const report = buildReport();
    saveReport(report);
    const body = [
      `類型：${report.category}`,
      `標題：${report.title}`,
      `聯絡 Email：${report.contactEmail}`,
      "",
      report.message || "（未填寫描述）",
      "",
      `頁面：${report.diagnostics.url}`,
      `裝置：${report.diagnostics.device.name} / ${report.diagnostics.device.shortId}`,
      report.attachedFile ? `附件日誌：${report.attachedFile.name} (${report.attachedFile.size} bytes)` : "附件日誌：無",
      "",
      "完整診斷可在頁面下載 JSON。",
    ].join("\n");
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(report.title)}&body=${encodeURIComponent(body)}`;
    setSent("已建立回饋紀錄並開啟 Email 草稿");
  }

  function downloadReport() {
    downloadJson(`mobile-english-feedback-${Date.now()}.json`, buildReport());
  }

  return (
    <div className="min-h-[100dvh] pb-4">
      <AppHeader title="意見回饋" subtitle={`寄至 ${FEEDBACK_EMAIL}`} />
      <div className="px-5 space-y-4">
        <div className="card space-y-3">
          <p className="font-bold text-ink flex items-center gap-2"><Bug size={18} className="text-peachDeep" /> 回報內容</p>
          <div className="flex flex-wrap gap-2">
            {(["錯誤", "語音", "對話", "測驗", "單字", "建議"] as FeedbackCategory[]).map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`chip transition ${category === item ? "bg-lilacDeep text-white" : "bg-cream text-ink"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="標題"
            className="w-full rounded-2xl bg-cream px-4 py-3 outline-none text-ink"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="描述發生的情況..."
            rows={6}
            className="w-full resize-none rounded-2xl bg-cream px-4 py-3 outline-none text-ink"
          />
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="聯絡 Email"
            className="w-full rounded-2xl bg-cream px-4 py-3 outline-none text-ink"
          />
        </div>

        <label className="card flex items-center gap-3 active:scale-[0.99] transition">
          <span className="h-12 w-12 rounded-2xl bg-mint flex items-center justify-center text-mintDeep">
            <Upload size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-ink">上傳日誌檔</span>
            <span className="block text-sm text-inkSoft truncate">{fileInfo ? fileInfo.name : "支援 .log / .txt / .json / 截圖"}</span>
          </span>
          <input className="hidden" type="file" accept=".log,.txt,.json,image/*" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>

        <div className="card space-y-2">
          <p className="font-bold text-ink">診斷摘要</p>
          <Row label="頁面" value={diagnostics.url || "目前頁面"} />
          <Row label="裝置" value={`${diagnostics.device.name} · ${diagnostics.device.shortId}`} />
          <Row label="學習紀錄" value={`${diagnostics.counts.records} 筆`} />
          <Row label="錯題" value={`${diagnostics.counts.wrongQuestions} 題`} />
        </div>

        {sent && <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-bold text-mintDeep">{sent}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={downloadReport} className="btn-secondary flex items-center justify-center gap-2 !px-3">
            <Download size={18} /> 日誌
          </button>
          <button onClick={submit} className="btn-primary flex items-center justify-center gap-2 !px-3">
            <Send size={18} /> 送出
          </button>
        </div>

        <a href={`mailto:${FEEDBACK_EMAIL}`} className="btn-secondary w-full flex items-center justify-center gap-2">
          <Mail size={18} /> 直接寄信
        </a>
      </div>
      <BottomNav />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-cream py-1.5 last:border-0">
      <span className="text-sm text-inkSoft">{label}</span>
      <span className="max-w-[62%] truncate text-right text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}
