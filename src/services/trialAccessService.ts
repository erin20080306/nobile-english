import type { User } from "@/types";
import { authService } from "./authService";
import { subscriptionService } from "./subscriptionService";
import type { PromoTrialInfo } from "@/types/subscription";

export const TRIAL_DAYS = 7;
export const ADMIN_EMAIL = "erin20080306@gmail.com";

export type TutorVoiceAccessMode = "generate" | "cache-only" | "blocked";

export interface TrialInfo {
  startedAt: string;
  endsAt: string;
  daysLeft: number;
  isActive: boolean;
  isExpired: boolean;
}

export interface AccessState {
  isSubscribed: boolean;
  trial: TrialInfo;
  promoTrial?: PromoTrialInfo | null;
  shouldShowSubscriptionPrompt: boolean;
  tutorVoiceMode: TutorVoiceAccessMode;
  reason: "subscribed" | "trial" | "promo_trial" | "trial_expired";
  showReason?: "limit_reached" | "cooldown_expired";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24小時冷卻
const PROMPT_DISMISSAL_KEY = "subscription_prompt_dismissed_at";
let cachedState: { value: AccessState; at: number; userId: string } | null = null;
const CACHE_MS = 60 * 1000;

export function isAdminUser(user?: User | null) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL;
}

function safeDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

export function getTrialInfo(user?: User | null): TrialInfo {
  const started = safeDate(user?.createdAt);
  const ends = new Date(started.getTime() + TRIAL_DAYS * DAY_MS);
  const now = Date.now();
  const remainingMs = ends.getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(remainingMs / DAY_MS));

  return {
    startedAt: started.toISOString(),
    endsAt: ends.toISOString(),
    daysLeft,
    isActive: remainingMs > 0,
    isExpired: remainingMs <= 0,
  };
}

export const trialAccessService = {
  async getAccessState(userParam?: User | null, options?: { fresh?: boolean; forceShow?: boolean }): Promise<AccessState> {
    const user = userParam ?? authService.getCurrentUser();
    const userId = user?.id || "anonymous";

    if (
      !options?.fresh &&
      cachedState &&
      cachedState.userId === userId &&
      Date.now() - cachedState.at < CACHE_MS
    ) {
      return cachedState.value;
    }

    const trial = getTrialInfo(user);
    if (isAdminUser(user)) {
      const state: AccessState = {
        isSubscribed: true,
        trial,
        promoTrial: null,
        shouldShowSubscriptionPrompt: false,
        tutorVoiceMode: "generate",
        reason: "subscribed",
      };
      cachedState = { value: state, at: Date.now(), userId };
      return state;
    }

    const entitlement = await subscriptionService.getEntitlement().catch(() => null);
    const isSubscribed = Boolean(entitlement?.isActive);
    const promoTrial = entitlement?.promoTrial?.isActive ? entitlement.promoTrial : null;

    // 檢查冷卻機制
    const lastDismissed = localStorage.getItem(PROMPT_DISMISSAL_KEY);
    const isCooldownActive = lastDismissed && (Date.now() - parseInt(lastDismissed)) < COOLDOWN_MS;

    const state: AccessState = isSubscribed
      ? {
          isSubscribed: true,
          trial,
          promoTrial: null,
          shouldShowSubscriptionPrompt: false,
          tutorVoiceMode: "generate",
          reason: "subscribed",
        }
      : promoTrial
        ? {
            isSubscribed: false,
            trial,
            promoTrial,
            shouldShowSubscriptionPrompt: false,
            tutorVoiceMode: "cache-only",
            reason: "promo_trial",
          }
      : trial.isActive
        ? {
            isSubscribed: false,
            trial,
            promoTrial: null,
            shouldShowSubscriptionPrompt: false, // 試用用戶不顯示提示
            tutorVoiceMode: "cache-only",
            reason: "trial",
          }
        : {
            isSubscribed: false,
            trial,
            promoTrial: null,
            shouldShowSubscriptionPrompt: !isCooldownActive || Boolean(options?.forceShow),
            tutorVoiceMode: "blocked",
            reason: "trial_expired",
            showReason: options?.forceShow ? "limit_reached" : undefined,
          };

    cachedState = { value: state, at: Date.now(), userId };
    return state;
  },

  dismissSubscriptionPrompt() {
    localStorage.setItem(PROMPT_DISMISSAL_KEY, Date.now().toString());
    this.clearCache();
  },

  forceShowSubscriptionPrompt() {
    return this.getAccessState(undefined, { fresh: true, forceShow: true });
  },

  clearCache() {
    cachedState = null;
  },
};
