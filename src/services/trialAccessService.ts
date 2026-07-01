import type { User } from "@/types";
import { authService } from "./authService";
import { subscriptionService } from "./subscriptionService";

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
  shouldShowSubscriptionPrompt: boolean;
  tutorVoiceMode: TutorVoiceAccessMode;
  reason: "subscribed" | "trial" | "trial_expired";
}

const DAY_MS = 24 * 60 * 60 * 1000;
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
  async getAccessState(userParam?: User | null, options?: { fresh?: boolean }): Promise<AccessState> {
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
        shouldShowSubscriptionPrompt: false,
        tutorVoiceMode: "generate",
        reason: "subscribed",
      };
      cachedState = { value: state, at: Date.now(), userId };
      return state;
    }

    const entitlement = await subscriptionService.getEntitlement().catch(() => null);
    const isSubscribed = Boolean(entitlement?.isActive);

    const state: AccessState = isSubscribed
      ? {
          isSubscribed: true,
          trial,
          shouldShowSubscriptionPrompt: false,
          tutorVoiceMode: "generate",
          reason: "subscribed",
        }
      : trial.isActive
        ? {
            isSubscribed: false,
            trial,
            shouldShowSubscriptionPrompt: true,
            tutorVoiceMode: "cache-only",
            reason: "trial",
          }
        : {
            isSubscribed: false,
            trial,
            shouldShowSubscriptionPrompt: true,
            tutorVoiceMode: "blocked",
            reason: "trial_expired",
          };

    cachedState = { value: state, at: Date.now(), userId };
    return state;
  },

  clearCache() {
    cachedState = null;
  },
};
