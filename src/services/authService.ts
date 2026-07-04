import type { AccountProfile, User, OnboardingProfile, UserSettings } from "@/types";
import { storageService, KEYS } from "./storageService";
import { cloudSyncService } from "./cloudSyncService";
import { supabaseBrowserClient } from "./supabaseBrowserClient";

const DEMO_EMAIL = "erin20080306@gmail.com";
const MAX_BOUND_DEVICES = 1;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now() {
  return new Date().toISOString();
}

function deviceName() {
  if (typeof navigator === "undefined") return "目前手機";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android 手機";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows 裝置";
  return "目前裝置";
}

function currentDeviceId() {
  let id = storageService.get<string | null>(KEYS.deviceId, null);
  if (!id) {
    id = `phone-${uid()}`;
    storageService.set(KEYS.deviceId, id);
  }
  return id;
}

function profileFor(name: string): AccountProfile {
  return { id: `profile-${uid()}`, name: name.trim() || "學習者", createdAt: now() };
}

function ensureProfiles(user: User): User {
  if (user.profiles?.length) return user;
  const profile = profileFor(user.name || "Erin");
  return { ...user, profiles: [profile], activeProfileId: profile.id };
}

function bindCurrentDevice(user: User): { ok: boolean; error?: string; user?: User } {
  const id = currentDeviceId();
  const name = deviceName();
  const prepared = ensureProfiles(user);

  if (prepared.deviceId && prepared.deviceId !== id) {
    return {
      ok: false,
      error: "此帳戶已綁定另一支手機。為了保護學習資料，同一帳戶只能綁定 1 支手機。",
    };
  }

  return {
    ok: true,
    user: {
      ...prepared,
      deviceId: prepared.deviceId || id,
      deviceName: prepared.deviceName || name,
      deviceBoundAt: prepared.deviceBoundAt || now(),
      lastDeviceSeenAt: now(),
    },
  };
}

function pushProfileIfCloud(userId: string, users: User[]) {
  const user = users.find((u) => u.id === userId);
  if (user) void cloudSyncService.pushProfile(userId, user);
}

function defaultSettings(userId: string): UserSettings {
  return {
    userId,
    targetLanguage: "en",
    speechRateByLanguage: {
      en: 1,
      ja: 0.95,
      ko: 0.95,
      it: 1,
      es: 1,
    },
    pronunciationOn: true,
    showChineseGlobal: true,
    sceneChinese: true,
    dialogueChinese: true,
    wordReviewChinese: true,
    sentenceReviewChinese: true,
    examChinese: true,
  };
}

function trackAppLogin(user: User) {
  if (typeof fetch === "undefined") return;
  fetch("/api/account/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider || "local",
    }),
  }).catch((error) => {
    console.warn("App heartbeat failed:", error);
  });
}

export const authService = {
  DEMO_EMAIL,
  MAX_BOUND_DEVICES,

  getUsers(): User[] {
    return storageService.get<User[]>(KEYS.users, []);
  },

  getCurrentUser(): User | null {
    const id = storageService.get<string | null>(KEYS.session, null);
    if (!id) return null;
    return this.getUsers().find((u) => u.id === id) || null;
  },

  register(input: {
    name: string;
    email: string;
    password: string;
    learningGoal: string;
    dailyGoalMinutes: number;
    selfRatedLevel: User["level"];
    showChinese: boolean;
  }): { ok: boolean; error?: string; user?: User } {
    const users = this.getUsers();
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      return { ok: false, error: "此 Email 已經註冊過了" };
    }
    const user: User = {
      id: uid(),
      name: input.name,
      email: input.email,
      password: input.password,
      provider: "local",
      deviceId: currentDeviceId(),
      deviceName: deviceName(),
      deviceBoundAt: now(),
      lastDeviceSeenAt: now(),
      level: input.selfRatedLevel,
      cefrLevel: "A2",
      createdAt: now(),
      isDemo: false,
      onboarded: false,
    };
    users.push(ensureProfiles(user));
    storageService.set(KEYS.users, users);

    // seed onboarding partial + settings
    const profile: Partial<OnboardingProfile> = {
      userId: user.id,
      language: "English",
      learningGoal: input.learningGoal,
      dailyGoalMinutes: input.dailyGoalMinutes,
    };
    storageService.set(KEYS.onboarding, profile);
    const settings = defaultSettings(user.id);
    settings.showChineseGlobal = input.showChinese;
    storageService.set(KEYS.settings, settings);

    return { ok: true, user };
  },

  login(email: string, password: string): { ok: boolean; error?: string; user?: User } {
    const users = this.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { ok: false, error: "找不到此帳號，請先註冊" };
    if (user.password !== password) return { ok: false, error: "密碼錯誤" };
    const bound = bindCurrentDevice({ ...user, provider: user.provider || "local" });
    if (!bound.ok || !bound.user) return { ok: false, error: bound.error };
    storageService.set(
      KEYS.users,
      users.map((u) => (u.id === user.id ? bound.user! : u))
    );
    storageService.set(KEYS.session, bound.user.id);
    trackAppLogin(bound.user);
    return { ok: true, user: bound.user };
  },

  // Real Google login via Supabase Auth. Triggers a full-page OAuth redirect;
  // the actual session/account reconciliation happens in hydrateFromSupabaseSession
  // once the user is redirected back to /auth/callback.
  async loginWithGoogle(): Promise<{ ok: boolean; error?: string }> {
    if (!supabaseBrowserClient) {
      return { ok: false, error: "登入服務尚未設定" };
    }
    const { error } = await supabaseBrowserClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  // Called once on /auth/callback (and defensively on app bootstrap) after a
  // real Supabase Auth session is established. Restores this account's cloud
  // data if it has any, or seeds the cloud account from whatever is on this
  // device (e.g. data from local testing) the first time it ever signs in.
  async hydrateFromSupabaseSession(supabaseUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  }): Promise<User> {
    const uid = supabaseUser.id;
    cloudSyncService.setActiveUser(uid);

    const cloudProfile = await cloudSyncService.pullProfile(uid);
    await cloudSyncService.pullAll(uid);

    let user: User;
    if (cloudProfile) {
      user = cloudProfile;
    } else {
      const meta = supabaseUser.user_metadata || {};
      user = ensureProfiles({
        id: uid,
        name: String(meta.full_name || meta.name || "學習者"),
        email: supabaseUser.email || "",
        provider: "google",
        level: "Beginner",
        cefrLevel: "A2",
        createdAt: now(),
        isDemo: false,
        onboarded: false,
      });
      if (!storageService.get(KEYS.settings, null)) {
        storageService.set(KEYS.settings, defaultSettings(uid), { skipSync: true });
      }
    }

    const others = this.getUsers().filter((u) => u.id !== uid);
    storageService.set(KEYS.users, [...others, user], { skipSync: true });
    storageService.set(KEYS.session, uid, { skipSync: true });

    await cloudSyncService.pushProfile(uid, user);

    // After pulling cloud data, check if user has learning data and update onboarded flag
    const { learningService } = await import("@/services/learningService");
    const hasLearningData = learningService.getPlan() || learningService.getLevelResult();
    if (hasLearningData && !user.onboarded) {
      user = { ...user, onboarded: true };
      const updatedUsers = this.getUsers().map((u) => (u.id === uid ? user : u));
      storageService.set(KEYS.users, updatedUsers, { skipSync: true });
      await cloudSyncService.pushProfile(uid, user);
    }

    // Always mirror the merged current device state back to cloud on Google
    // login. This covers returning accounts that log in from a device with
    // newer local learning records or app state.
    await cloudSyncService.pushAll(uid);

    trackAppLogin(user);
    return user;
  },

  loginWithApple(appleUser: { id: string; email: string; name: string }): { ok: boolean; error?: string; user?: User } {
    let users = this.getUsers();
    let user = users.find(
      (u) => u.id === appleUser.id || u.email.toLowerCase() === appleUser.email.toLowerCase()
    );
    if (!user) {
      user = {
        id: appleUser.id,
        name: appleUser.name,
        email: appleUser.email,
        provider: "apple",
        level: "Beginner",
        cefrLevel: "A2",
        createdAt: now(),
        isDemo: false,
        onboarded: false,
      } as User;
      users.push(ensureProfiles(user));
      storageService.set(KEYS.settings, defaultSettings(user.id));
    }
    const bound = bindCurrentDevice({ ...user, provider: "apple" });
    if (!bound.ok || !bound.user) return { ok: false, error: bound.error };
    users = users.map((u) => (u.id === bound.user!.id ? bound.user! : u));
    storageService.set(KEYS.users, users);
    storageService.set(KEYS.session, bound.user.id);
    trackAppLogin(bound.user);
    return { ok: true, user: bound.user };
  },

  logout() {
    storageService.remove(KEYS.session);
    cloudSyncService.setActiveUser(null);
    if (supabaseBrowserClient) void supabaseBrowserClient.auth.signOut();
  },

  setOnboarded(value: boolean) {
    const user = this.getCurrentUser();
    if (!user) return;
    const users = this.getUsers().map((u) => (u.id === user.id ? { ...u, onboarded: value } : u));
    storageService.set(KEYS.users, users);
    pushProfileIfCloud(user.id, users);
  },

  updateLevel(level: User["level"], cefr: User["cefrLevel"]) {
    const user = this.getCurrentUser();
    if (!user) return;
    const users = this.getUsers().map((u) =>
      u.id === user.id ? { ...u, level, cefrLevel: cefr } : u
    );
    storageService.set(KEYS.users, users);
    pushProfileIfCloud(user.id, users);
  },

  getDeviceInfo(user?: User | null) {
    const targetUser = user ?? this.getCurrentUser();
    const id = currentDeviceId();
    return {
      currentDeviceId: id,
      shortId: id.slice(-8).toUpperCase(),
      currentDeviceName: deviceName(),
      boundDeviceId: targetUser?.deviceId || "",
      boundDeviceName: targetUser?.deviceName || "",
      isBoundHere: !targetUser?.deviceId || targetUser.deviceId === id,
      maxDevices: MAX_BOUND_DEVICES,
    };
  },

  addProfile(name: string): { ok: boolean; error?: string; user?: User } {
    const clean = name.trim();
    if (clean.length < 2) return { ok: false, error: "請輸入至少 2 個字的學習者名稱" };
    const user = this.getCurrentUser();
    if (!user) return { ok: false, error: "尚未登入" };
    const nextProfile = profileFor(clean);
    const next = ensureProfiles({
      ...user,
      profiles: [...(user.profiles || []), nextProfile],
      activeProfileId: nextProfile.id,
    });
    const users = this.getUsers().map((u) => (u.id === user.id ? next : u));
    storageService.set(KEYS.users, users);
    pushProfileIfCloud(user.id, users);
    return { ok: true, user: next };
  },

  switchProfile(profileId: string): { ok: boolean; error?: string; user?: User } {
    const user = this.getCurrentUser();
    if (!user) return { ok: false, error: "尚未登入" };
    const prepared = ensureProfiles(user);
    if (!prepared.profiles?.some((p) => p.id === profileId)) return { ok: false, error: "找不到此學習者" };
    const next = { ...prepared, activeProfileId: profileId };
    const users = this.getUsers().map((u) => (u.id === user.id ? next : u));
    storageService.set(KEYS.users, users);
    pushProfileIfCloud(user.id, users);
    return { ok: true, user: next };
  },
};
