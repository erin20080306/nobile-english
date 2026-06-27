import type { User, OnboardingProfile, UserSettings } from "@/types";
import { storageService, KEYS } from "./storageService";

const DEMO_EMAIL = "erin20080306@gmail.com";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultSettings(userId: string): UserSettings {
  return {
    userId,
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
      level: input.selfRatedLevel,
      cefrLevel: "A2",
      createdAt: new Date().toISOString(),
      isDemo: false,
      onboarded: false,
    };
    users.push(user);
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
    const user = this.getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { ok: false, error: "找不到此帳號，請先註冊" };
    if (user.password !== password) return { ok: false, error: "密碼錯誤" };
    storageService.set(KEYS.session, user.id);
    return { ok: true, user };
  },

  loginDemo(): User {
    let users = this.getUsers();
    let demo = users.find((u) => u.email.toLowerCase() === DEMO_EMAIL);
    if (!demo) {
      demo = {
        id: "demo-erin",
        name: "Erin",
        email: DEMO_EMAIL,
        password: "demo",
        level: "Beginner",
        cefrLevel: "A2",
        createdAt: new Date().toISOString(),
        isDemo: true,
        onboarded: true,
      };
      users.push(demo);
      storageService.set(KEYS.users, users);

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
    storageService.set(KEYS.session, demo.id);
    return demo;
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
};
