"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, Database, RefreshCw, XCircle } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { useUser } from "@/hooks/useUser";
import { supabaseBrowserClient } from "@/services/supabaseBrowserClient";

const ADMIN_EMAIL = "erin20080306@gmail.com";

type PlanPeriod = "monthly" | "yearly";

type PaymentRequest = {
  id: string;
  user_email: string;
  plan_period: PlanPeriod;
  product_id: string;
  amount_twd: number;
  status: "pending" | "approved" | "rejected";
  promo_code: string | null;
  created_at: string;
  reviewed_at?: string | null;
  review_note?: string | null;
};

type SubscriptionRecord = {
  id: string;
  user_email: string;
  action: string;
  plan_period: string;
  product_id: string;
  amount_twd: number;
  starts_at: string;
  expires_at: string;
  status: string;
  source: string;
  admin_email: string;
  note: string | null;
  created_at: string;
};

type AdminPayload = {
  available: boolean;
  error?: string;
  requests: PaymentRequest[];
  records: SubscriptionRecord[];
};

function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addPeriod(startDate: string, period: PlanPeriod) {
  const date = new Date(`${startDate}T00:00:00`);
  if (period === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ManualSubscriptionsAdminPage() {
  const router = useRouter();
  const { user, ready } = useUser({ requireOnboarded: true });
  const today = useMemo(() => taipeiDateKey(), []);

  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    email: "",
    period: "monthly" as PlanPeriod,
    amountTwd: 399,
    startDate: today,
    expiresAt: addPeriod(today, "monthly"),
    note: "",
  });

  useEffect(() => {
    if (!ready) return;
    if (!user || user.email.toLowerCase() !== ADMIN_EMAIL) {
      router.replace("/dashboard");
      return;
    }
    void loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  async function accessToken() {
    if (!supabaseBrowserClient) return "";
    const { data } = await supabaseBrowserClient.auth.getSession();
    return data.session?.access_token || "";
  }

  async function adminFetch(init?: RequestInit) {
    const token = await accessToken();
    if (!token) throw new Error("請用管理員 Google 帳號重新登入。 ");
    return fetch("/api/admin/manual-subscriptions", {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
  }

  async function loadData() {
    setLoading(true);
    setMessage("");
    try {
      const response = await adminFetch();
      const data = (await response.json().catch(() => null)) as AdminPayload | null;
      if (!response.ok || !data) throw new Error(data?.error || "無法讀取資料");
      setPayload(data);
    } catch (error) {
      setPayload(null);
      setMessage(error instanceof Error ? error.message : "無法讀取資料");
    } finally {
      setLoading(false);
    }
  }

  function changePeriod(period: PlanPeriod) {
    setForm((current) => ({
      ...current,
      period,
      amountTwd: period === "monthly" ? 399 : 1290,
      expiresAt: addPeriod(current.startDate, period),
    }));
  }

  function changeStartDate(startDate: string) {
    setForm((current) => ({
      ...current,
      startDate,
      expiresAt: addPeriod(startDate, current.period),
    }));
  }

  async function activateManually() {
    if (!form.email.trim()) {
      setMessage("請輸入會員 Email。");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await adminFetch({
        method: "POST",
        body: JSON.stringify({ action: "activate", ...form }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "開通失敗");
      setMessage("已成功開通 Premium，並寫入資料庫操作紀錄。");
      setForm((current) => ({ ...current, email: "", note: "" }));
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "開通失敗");
    } finally {
      setSaving(false);
    }
  }

  async function reviewRequest(requestId: string, action: "approve" | "reject") {
    setActingId(requestId);
    setMessage("");
    try {
      const response = await adminFetch({
        method: "POST",
        body: JSON.stringify({ action, requestId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || "處理失敗");
      setMessage(action === "approve" ? "已核准並完成開通與紀錄。" : "已標記為未通過。");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "處理失敗");
    } finally {
      setActingId(null);
    }
  }

  const pendingRequests = payload?.requests.filter((item) => item.status === "pending") || [];

  return (
    <div className="min-h-[100dvh] pb-24">
      <AppHeader title="手動開通與付款通知" subtitle="核對轉帳、開通會員並保留資料庫紀錄" back />

      <div className="space-y-4 px-5">
        {message && (
          <div className="rounded-2xl bg-cream px-4 py-3 text-sm font-bold text-ink">
            {message}
          </div>
        )}

        {payload && !payload.available && (
          <div className="rounded-2xl bg-peachLight px-4 py-3 text-sm font-bold text-peachDeep">
            {payload.error}
          </div>
        )}

        <section className="rounded-[28px] bg-white p-5 shadow-softer">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-ink">手動開通 Premium</h2>
              <p className="text-xs font-bold text-inkSoft">開通後會更新 profiles，並新增一筆不可遺漏的操作紀錄。</p>
            </div>
            <Database className="text-lilacDeep" size={24} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-extrabold text-inkSoft md:col-span-2">
              會員 Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="member@gmail.com"
                className="mt-1 w-full rounded-2xl bg-cream px-3 py-3 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-lilacDeep"
              />
            </label>

            <label className="text-xs font-extrabold text-inkSoft">
              方案
              <select
                value={form.period}
                onChange={(event) => changePeriod(event.target.value as PlanPeriod)}
                className="mt-1 w-full rounded-2xl bg-cream px-3 py-3 text-sm font-bold text-ink outline-none"
              >
                <option value="monthly">月費方案</option>
                <option value="yearly">年費方案</option>
              </select>
            </label>

            <label className="text-xs font-extrabold text-inkSoft">
              收款金額
              <input
                type="number"
                min={0}
                value={form.amountTwd}
                onChange={(event) => setForm((current) => ({ ...current, amountTwd: Number(event.target.value) }))}
                className="mt-1 w-full rounded-2xl bg-cream px-3 py-3 text-sm font-bold text-ink outline-none"
              />
            </label>

            <label className="text-xs font-extrabold text-inkSoft">
              開始日期
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => changeStartDate(event.target.value)}
                className="mt-1 w-full rounded-2xl bg-cream px-3 py-3 text-sm font-bold text-ink outline-none"
              />
            </label>

            <label className="text-xs font-extrabold text-inkSoft">
              到期日期
              <input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                className="mt-1 w-full rounded-2xl bg-cream px-3 py-3 text-sm font-bold text-ink outline-none"
              />
            </label>

            <label className="text-xs font-extrabold text-inkSoft md:col-span-2">
              備註
              <input
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="例如：銀行轉帳已核對"
                className="mt-1 w-full rounded-2xl bg-cream px-3 py-3 text-sm font-bold text-ink outline-none"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void activateManually()}
            disabled={saving || !payload?.available}
            className="mt-4 w-full rounded-3xl bg-lilacDeep py-3 text-sm font-extrabold text-white shadow-softer active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "開通並記錄中..." : "開通 Premium 並寫入紀錄"}
          </button>
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-softer">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
                <Clock size={20} className="text-peachDeep" /> 待核對付款
              </h2>
              <p className="text-xs font-bold text-inkSoft">使用者按「已付款，通知管理員」後會出現在這裡。</p>
            </div>
            <button type="button" onClick={() => void loadData()} className="rounded-full bg-cream p-2 text-lilacDeep">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading ? (
            <p className="py-4 text-center text-sm font-bold text-inkSoft">讀取中...</p>
          ) : pendingRequests.length ? (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="rounded-2xl bg-cream p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-ink">{request.user_email}</p>
                      <p className="text-xs font-bold text-inkSoft">
                        {request.plan_period === "monthly" ? "月費" : "年費"} · NT$ {request.amount_twd} · {formatDate(request.created_at)}
                      </p>
                    </div>
                    <span className="rounded-full bg-peachLight px-2.5 py-1 text-[10px] font-extrabold text-peachDeep">待核對</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={actingId === request.id}
                      onClick={() => void reviewRequest(request.id, "approve")}
                      className="flex items-center justify-center gap-1 rounded-2xl bg-mintDeep py-2.5 text-xs font-extrabold text-white disabled:opacity-50"
                    >
                      <CheckCircle size={15} /> 核准並開通
                    </button>
                    <button
                      type="button"
                      disabled={actingId === request.id}
                      onClick={() => void reviewRequest(request.id, "reject")}
                      className="flex items-center justify-center gap-1 rounded-2xl bg-white py-2.5 text-xs font-extrabold text-peachDeep disabled:opacity-50"
                    >
                      <XCircle size={15} /> 未查到款項
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-cream px-4 py-4 text-center text-sm font-bold text-inkSoft">目前沒有待核對的付款通知。</p>
          )}
        </section>

        <section className="rounded-[28px] bg-white p-5 shadow-softer">
          <h2 className="mb-3 text-lg font-extrabold text-ink">最近手動開通紀錄</h2>
          {payload?.records.length ? (
            <div className="space-y-2">
              {payload.records.slice(0, 30).map((record) => (
                <div key={record.id} className="rounded-2xl bg-cream px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-ink">{record.user_email}</p>
                      <p className="text-[11px] font-bold text-inkSoft">
                        {formatDate(record.starts_at)} ～ {formatDate(record.expires_at)}
                      </p>
                      <p className="text-[10px] font-bold text-inkSoft">
                        NT$ {record.amount_twd} · {record.source === "bank_transfer_request" ? "轉帳通知核准" : "管理員手動開通"}
                      </p>
                    </div>
                    <span className="rounded-full bg-mintLight px-2 py-1 text-[10px] font-extrabold text-mintDeep">已記錄</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-cream px-4 py-4 text-center text-sm font-bold text-inkSoft">尚無手動開通紀錄。</p>
          )}
        </section>
      </div>
    </div>
  );
}
