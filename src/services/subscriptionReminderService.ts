import type { AccessState } from "./trialAccessService";
import type { TrialUsageKey } from "./trialUsageService";

export type SubscriptionPromptReason = "login" | "limit" | "expired";

type LimitPromptScope = "session" | "daily" | "lifetime";

const LOGIN_PROMPT_KEY = "subscription_login_prompt_seen";
const LIMIT_PROMPT_KEY = "subscription_limit_prompt_seen";

function storage(kind: "session" | "local") {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function safeUserId(userId?: string | null) {
  return userId || "anonymous";
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loginKey(userId?: string | null) {
  return `${LOGIN_PROMPT_KEY}:${safeUserId(userId)}`;
}

function limitKey(userId: string | undefined | null, feature: TrialUsageKey, scope: LimitPromptScope) {
  const suffix = scope === "daily" ? todayKey() : scope;
  return `${LIMIT_PROMPT_KEY}:${safeUserId(userId)}:${feature}:${suffix}`;
}

export const subscriptionReminderService = {
  shouldShowLoginReminder(userId: string | undefined | null, access?: AccessState | null) {
    if (!access || access.isSubscribed) return false;
    return storage("session")?.getItem(loginKey(userId)) !== "1";
  },

  markLoginReminderShown(userId?: string | null) {
    storage("session")?.setItem(loginKey(userId), "1");
  },

  shouldShowLimitReminder(
    userId: string | undefined | null,
    feature: TrialUsageKey,
    access?: AccessState | null,
    scope: LimitPromptScope = "session"
  ) {
    if (!access || access.isSubscribed) return false;
    return storage("session")?.getItem(limitKey(userId, feature, scope)) !== "1";
  },

  markLimitReminderShown(userId: string | undefined | null, feature: TrialUsageKey, scope: LimitPromptScope = "session") {
    storage("session")?.setItem(limitKey(userId, feature, scope), "1");
  },
};
