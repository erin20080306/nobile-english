import type { AccountProfile, User, OnboardingProfile, UserSettings } from "@/types";
import { storageService, KEYS } from "./storageService";

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

function defaultSettings(userId: string): UserSettings {
  return {
    userId,
    targetLanguage: "en",
    pronunciationOn: true,
    showChineseGlobal: true,
    sceneChinese: true,
    dialogueChinese: true,
    wordReviewChinese: true,
    sentenceReviewChinese: true,
    examChinese: true,
  };
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
    return { ok: true, user: bound.user };
  },

  loginWithGoogle(): { ok: boolean; error?: string; user?: User } {
    let users = this.getUsers();
    let demo = users.find((u) => u.email.toLowerCase() === DEMO_EMAIL);
    if (!demo) {
      demo = {
        id: "demo-erin",
        name: "Erin",
        email: DEMO_EMAIL,
        password: "demo",
        provider: "google",
        level: "Beginner",
        cefrLevel: "A2",
        createdAt: now(),
        isDemo: true,
        onboarded: true,
      };
      users.push(demo);

      const profile: OnboardingProfile = {
        userId: demo.id,
        language: "English",
        learningGoal: "日常會話",
        interests: ["旅遊", "職場", "日常生活", "科技"],
        dailyGoalMinutes: 15,
        chineseSetting: "always",
        selfRatedLevel: "Beginner",
      };
      storageService.set(KEYS.onboarding, profile);
      storageService.set(KEYS.settings, defaultSettings(demo.id));
    }
    const bound = bindCurrentDevice({ ...demo, provider: "google" });
    if (!bound.ok || !bound.user) return { ok: false, error: bound.error };
    users = users.map((u) => (u.id === bound.user!.id ? bound.user! : u));
    storageService.set(KEYS.users, users);
    storageService.set(KEYS.session, bound.user.id);
    return { ok: true, user: bound.user };
  },

  loginDemo(): User {
    const result = this.loginWithGoogle();
    if (result.ok && result.user) return result.user;
    throw new Error(result.error || "登入失敗");
  },

  logout() {
    storageService.remove(KEYS.session);
  },

  setOnboarded(value: boolean) {
    const user = this.getCurrentUser();
    if (!user) return;
    const users = this.getUsers().map((u) => (u.id === user.id ? { ...u, onboarded: value } : u));
    storageService.set(KEYS.users, users);
  },

  updateLevel(level: User["level"], cefr: User["cefrLevel"]) {
    const user = this.getCurrentUser();
    if (!user) return;
    const users = this.getUsers().map((u) =>
      u.id === user.id ? { ...u, level, cefrLevel: cefr } : u
    );
    storageService.set(KEYS.users, users);
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
    return { ok: true, user: next };
  },
};
